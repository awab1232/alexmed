import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/api/api_error.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../library/data/library_repository.dart';
import '../../library/presentation/library_widgets.dart' show shortDate;
import '../data/book_models.dart';
import '../data/book_repository.dart';

/// A study book (the web's app/books/[bookId]): what to study, and — while
/// the server is still working — honest per-stage progress with retries.
/// All processing is on the server, so leaving never stops it. The screen
/// polls only while it is on top and the app is in the foreground, starting
/// at [pollInterval] and slowing down (up to 5×) while nothing changes.
class BookScreen extends ConsumerStatefulWidget {
  const BookScreen({
    super.key,
    required this.bookId,
    this.pollInterval = const Duration(seconds: 3),
  });

  final String bookId;
  final Duration pollInterval;

  @override
  ConsumerState<BookScreen> createState() => _BookScreenState();
}

class _BookScreenState extends ConsumerState<BookScreen>
    with WidgetsBindingObserver {
  static const _backoff = [1, 1, 1, 2, 2, 3, 3, 4, 5];
  static const _resumeEvery = Duration(seconds: 60);

  BookDetail? _book;
  CoverageReport? _coverage;
  CoverageDetail? _detail;
  ExamFocusTile? _examFocus;
  List<BookPage> _failedPages = const [];
  String? _failedPagesKey;
  Object? _error;

  Timer? _timer;
  bool _foreground = true;
  bool _loading = false;
  int _quietTicks = 0;
  String? _lastSignature;
  DateTime? _lastResume;

  bool _starting = false;
  bool _startFailed = false;
  final _retrying = <String>{};

  BookRepository get _repo => ref.read(bookRepositoryProvider);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final foreground = state == AppLifecycleState.resumed;
    if (foreground == _foreground) return;
    _foreground = foreground;
    if (foreground) {
      _quietTicks = 0;
      _refresh();
    } else {
      _timer?.cancel();
    }
  }

  bool get _visible =>
      mounted && _foreground && (ModalRoute.of(context)?.isCurrent ?? true);

  Future<void> _refresh() async {
    if (_loading) return;
    _timer?.cancel();
    _loading = true;
    try {
      final book = await _repo.get(widget.bookId);
      final coverageDue =
          _coverage == null ||
          _coverage!.totalPages == 0 ||
          _coverage!.visualPending > 0;
      final detailDue = _detail == null || !_detail!.complete;
      final examFocusDue = _book == null || (_examFocus?.busy ?? false);
      final results = await Future.wait([
        coverageDue ? _repo.coverage(widget.bookId) : Future.value(_coverage),
        detailDue ? _repo.coverageDetail(widget.bookId) : Future.value(_detail),
        examFocusDue && book.hasChapters
            ? _repo.examFocus(widget.bookId).catchError((_) => _examFocus)
            : Future.value(_examFocus),
      ]);
      final detail = results[1] as CoverageDetail?;
      await _loadFailedPages(book, detail);
      if (!mounted) return;
      setState(() {
        _book = book;
        _coverage = results[0] as CoverageReport?;
        _detail = detail;
        _examFocus = results[2] as ExamFocusTile?;
        _error = null;
      });
      _resumeStalled(book);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      _loading = false;
      _schedule();
    }
  }

  /// Page rows carry the page text, so they are fetched only when some page
  /// failed (for its retry button) — and again only when that set changes.
  Future<void> _loadFailedPages(BookDetail book, CoverageDetail? detail) async {
    final failed = detail?.failedPages ?? const <int>[];
    final key = failed.join(',');
    if (!book.isOwner || failed.isEmpty) {
      _failedPages = const [];
      _failedPagesKey = key;
      return;
    }
    if (key == _failedPagesKey) return;
    final pages = await _repo.pages(widget.bookId);
    _failedPages = pages.where((p) => p.textFailed).toList();
    _failedPagesKey = key;
  }

  /// The web's safety net: while an owner's analysis runs, ask the server
  /// every minute to re-queue chapters that stopped moving.
  void _resumeStalled(BookDetail book) {
    if (!book.analysisInFlight) return;
    final now = DateTime.now();
    if (_lastResume != null && now.difference(_lastResume!) < _resumeEvery) {
      return;
    }
    _lastResume = now;
    unawaited(_repo.resumeAnalysis(widget.bookId).catchError((_) {}));
  }

  bool get _keepPolling {
    final book = _book;
    if (book == null) return _error is! NotFoundException;
    return book.needsPolling ||
        book.toolsState == StudyToolsState.generating ||
        (_coverage?.visualPending ?? 0) > 0 ||
        (_examFocus?.busy ?? false);
  }

  void _schedule() {
    if (!mounted || !_foreground || !_keepPolling) return;
    final signature = _signature();
    _quietTicks = signature == _lastSignature ? _quietTicks + 1 : 0;
    _lastSignature = signature;
    final factor = _backoff[_quietTicks.clamp(0, _backoff.length - 1)];
    _timer = Timer(widget.pollInterval * factor, _tick);
  }

  void _tick() {
    // Another screen on top: check again later without using the network.
    if (!_visible) {
      if (mounted && _foreground) {
        _timer = Timer(widget.pollInterval, _tick);
      }
      return;
    }
    _refresh();
  }

  String _signature() {
    final book = _book;
    return [
      book?.status.name,
      for (final c in book?.chapters ?? const <BookChapter>[]) c.status.name,
      _coverage?.visualPending,
      _detail?.coverage,
      _examFocus?.status,
      _error?.runtimeType,
    ].join('|');
  }

  Future<void> _run(String key, Future<void> Function() action) async {
    setState(() => _retrying.add(key));
    try {
      await action();
      _quietTicks = 0;
      await _refresh();
    } catch (error) {
      if (mounted) showNlToast(context, apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _retrying.remove(key));
    }
  }

  Future<void> _startAnalysis() async {
    setState(() {
      _starting = true;
      _startFailed = false;
    });
    try {
      await _repo.startAnalysis(widget.bookId);
      _quietTicks = 0;
      ref.invalidate(booksProvider);
      await _refresh();
    } catch (_) {
      if (mounted) setState(() => _startFailed = true);
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final book = _book;
    if (book == null) {
      return Scaffold(
        appBar: AppBar(),
        body: switch (_error) {
          null => const Center(child: CircularProgressIndicator()),
          NotFoundException() => NlEmptyState(
            title: l10n.bookNotFound,
            expression: NiroExpression.shocked,
          ),
          final error => NlErrorView(error: error, onRetry: _refresh),
        },
      );
    }

    final pipelineReady =
        book.chaptersPhaseDone &&
        book.failedChapters.isEmpty &&
        (_detail?.complete ?? false);

    return Scaffold(
      appBar: AppBar(),
      body: RefreshIndicator(
        onRefresh: () {
          _quietTicks = 0;
          return _refresh();
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            NlSpace.page,
            0,
            NlSpace.page,
            NlSpace.xxxl,
          ),
          children: [
            _Header(book: book),
            const SizedBox(height: NlSpace.xl),
            ..._failureBanners(l10n, book),
            _StudySection(
              book: book,
              examFocus: _examFocus,
              starting: _starting,
              startFailed: _startFailed,
              onStart: _startAnalysis,
            ),
            if (book.hasFile) ...[
              const SizedBox(height: NlSpace.xl),
              NlGroup(
                children: [
                  NlRow(
                    icon: LucideIcons.fileText,
                    label: l10n.bookSource,
                    value: l10n.bookSourceMeta(
                      book.pageCount,
                      book.createdAt == null
                          ? ''
                          : shortDate(
                              book.createdAt!,
                              Localizations.localeOf(context),
                            ),
                    ),
                    trailing: Text(
                      l10n.bookSourceView,
                      style: NlText.button.copyWith(
                        fontSize: 14,
                        color: NlColors.niroDeep,
                      ),
                    ),
                    onTap: () => context.push(Routes.bookRead(book.id)),
                  ),
                ],
              ),
            ],
            const SizedBox(height: NlSpace.xl),
            _ProcessingDetails(
              book: book,
              coverage: _coverage,
              detail: _detail,
              ready: pipelineReady,
            ),
            ..._retryLists(l10n, book),
          ],
        ),
      ),
    );
  }

  List<Widget> _failureBanners(AppLocalizations l10n, BookDetail book) {
    final banners = <Widget>[];
    if (book.status == BookStatus.failed) {
      banners.add(
        _Banner(
          tone: _Tone.error,
          text: book.extractionError ?? l10n.bookFailedDefault,
          actions: book.isOwner
              ? [
                  NlButton(
                    label: l10n.bookRetryExtraction,
                    icon: LucideIcons.rotateCcw,
                    kind: NlButtonKind.secondary,
                    loading: _retrying.contains('extraction'),
                    onPressed: () => _run(
                      'extraction',
                      () => _repo.retryExtraction(book.id),
                    ),
                  ),
                  NlButton(
                    label: l10n.bookUploadAnother,
                    kind: NlButtonKind.ghost,
                    onPressed: () => context.pushReplacement(Routes.uploadBook),
                  ),
                ]
              : const [],
        ),
      );
    }
    if (book.status == BookStatus.partialFailed) {
      final chapters = book.failedChapters.length;
      banners.add(
        _Banner(
          tone: _Tone.warning,
          text: _failedPages.isEmpty
              ? l10n.bookPartialChapters(chapters)
              : l10n.bookPartialChaptersPages(chapters, _failedPages.length),
        ),
      );
    }
    if (book.lowConfidenceSplit) {
      banners.add(_Banner(tone: _Tone.warning, text: l10n.bookLowConfidence));
    }
    return [
      for (final b in banners) ...[b, const SizedBox(height: NlSpace.md)],
    ];
  }

  List<Widget> _retryLists(AppLocalizations l10n, BookDetail book) {
    final pending = book.chapters
        .where((c) => c.status != ChapterStatus.complete)
        .toList();
    // Parts are processing units, not places to study: only unfinished
    // ones are listed (their progress, and retry for failed ones).
    final showChapters = pending.isNotEmpty && !book.chaptersNotStarted;
    if (_failedPages.isEmpty && !showChapters) return const [];
    return [
      const SizedBox(height: NlSpace.xl),
      NlGroup(
        children: [
          for (final page in _failedPages)
            _RetryRow(
              failed: true,
              title: l10n.pageNumber(page.pageNumber),
              detail: page.textError ?? l10n.pageTextFailedDefault,
              busy: _retrying.contains(page.id),
              onRetry: () => _run(page.id, () async {
                await _repo.retryPageText(page.id);
                _failedPagesKey = null;
              }),
            ),
          if (showChapters)
            for (final chapter in pending)
              _RetryRow(
                failed: chapter.status == ChapterStatus.failed,
                title: chapter.title,
                detail:
                    '${l10n.mirrorBatchPages(chapter.startPage, chapter.endPage)} · '
                    '${chapter.status == ChapterStatus.failed ? (chapter.errorMessage ?? l10n.chapterFailedDefault) : l10n.chapterAnalyzing}',
                busy: _retrying.contains(chapter.id),
                onRetry: chapter.status == ChapterStatus.failed && book.isOwner
                    ? () =>
                          _run(chapter.id, () => _repo.retryChapter(chapter.id))
                    : null,
              ),
        ],
      ),
    ];
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.book});
  final BookDetail book;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final owner =
        book.ownerName ??
        (book.ownerUsername != null ? '@${book.ownerUsername}' : null);
    final (IconData, String, Color)? status =
        book.toolsState == StudyToolsState.ready && book.failedChapters.isEmpty
        ? (LucideIcons.circleCheck, l10n.bookReady, NlColors.correct)
        : book.isExtracting
        ? (LucideIcons.loaderCircle, l10n.bookReading, NlColors.niroDeep)
        : book.toolsState == StudyToolsState.generating
        ? (LucideIcons.loaderCircle, l10n.bookPreparing, NlColors.niroDeep)
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: AutoDirText(book.title, style: NlText.display),
        ),
        const SizedBox(height: NlSpace.sm),
        Wrap(
          spacing: NlSpace.md,
          runSpacing: NlSpace.xs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              [
                l10n.bookMeta(book.pageCount),
                if (book.hasChapters) l10n.bookMetaParts(book.chapters.length),
              ].join('، '),
              style: NlText.secondary,
            ),
            if (status != null)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(status.$1, size: 15, color: status.$3),
                  const SizedBox(width: 4),
                  Text(
                    status.$2,
                    style: NlText.caption.copyWith(
                      color: status.$3,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
          ],
        ),
        if (!book.isOwner && owner != null) ...[
          const SizedBox(height: NlSpace.sm),
          NlBadge(l10n.bookSharedFrom(isolate(owner))),
        ],
      ],
    );
  }
}

class _StudySection extends StatelessWidget {
  const _StudySection({
    required this.book,
    required this.examFocus,
    required this.starting,
    required this.startFailed,
    required this.onStart,
  });

  final BookDetail book;
  final ExamFocusTile? examFocus;
  final bool starting;
  final bool startFailed;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = book.toolsState;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(l10n.bookStudyTitle, style: NlText.title),
        ),
        const SizedBox(height: NlSpace.md),
        if (!book.hasChapters)
          Text(l10n.bookToolsAfterReading, style: NlText.secondary)
        else ...[
          _ExamFocusPanel(book: book, deck: examFocus),
          const SizedBox(height: NlSpace.lg),
          if (state == StudyToolsState.locked && book.isOwner) ...[
            Text(l10n.bookGenerateBody, style: NlText.secondary),
            const SizedBox(height: NlSpace.md),
            NlButton(
              label: l10n.bookGenerate,
              icon: LucideIcons.sparkles,
              kind: NlButtonKind.primary,
              expand: true,
              loading: starting,
              onPressed: starting ? null : onStart,
            ),
            if (startFailed) ...[
              const SizedBox(height: NlSpace.sm),
              Text(
                l10n.bookGenerateError,
                style: NlText.caption.copyWith(color: NlColors.wrong),
              ),
            ],
            const SizedBox(height: NlSpace.lg),
          ],
          if (state == StudyToolsState.locked && !book.isOwner) ...[
            Text(l10n.bookSharedNotStarted, style: NlText.secondary),
            const SizedBox(height: NlSpace.lg),
          ],
          if (state == StudyToolsState.generating) ...[
            Row(
              children: [
                Expanded(
                  child: Text(l10n.bookPreparing, style: NlText.rowLabel),
                ),
                Text(
                  isolateLtr('${book.analysisPercent}%'),
                  style: NlText.rowLabel,
                ),
              ],
            ),
            const SizedBox(height: NlSpace.sm),
            NlProgressBar(
              value: book.analysisPercent / 100,
              semanticsLabel: l10n.bookPreparing,
            ),
            const SizedBox(height: NlSpace.lg),
          ],
          _ToolList(book: book),
        ],
      ],
    );
  }
}

/// The page's one ink panel: Exam Focus has its own whole-file pipeline,
/// so it opens as soon as the pages are read.
class _ExamFocusPanel extends StatelessWidget {
  const _ExamFocusPanel({required this.book, required this.deck});

  final BookDetail book;
  final ExamFocusTile? deck;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final deck = this.deck;
    final unavailable = !book.isOwner && deck == null;
    final caption = unavailable
        ? l10n.examFocusSharedMissing
        : deck != null && deck.ready
        ? l10n.examFocusReadyCount(deck.totalCards)
        : deck != null && deck.busy
        ? l10n.examFocusBusy
        : l10n.examFocusIdle;
    final open = unavailable
        ? null
        : () => context.push(Routes.bookExamFocus(book.id));
    return Material(
      color: NlColors.ink,
      borderRadius: BorderRadius.circular(NlRadius.lg),
      child: InkWell(
        borderRadius: BorderRadius.circular(NlRadius.lg),
        onTap: open,
        child: Padding(
          padding: const EdgeInsets.all(NlSpace.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    LucideIcons.flame,
                    size: 18,
                    color: NlColors.marker,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    isolateLtr('Exam Focus'),
                    style: NlText.label.copyWith(color: NlColors.marker),
                  ),
                ],
              ),
              const SizedBox(height: NlSpace.sm),
              Text(
                l10n.examFocusHeadline,
                style: NlText.title.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 4),
              Text(
                caption,
                style: NlText.secondary.copyWith(color: NlColors.rule),
              ),
              if (open != null) ...[
                const SizedBox(height: NlSpace.md),
                NlButton(
                  label: deck == null
                      ? l10n.examFocusPrepare
                      : l10n.examFocusOpen,
                  kind: NlButtonKind.marker,
                  loading: deck?.busy ?? false,
                  onPressed: open,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ToolList extends StatelessWidget {
  const _ToolList({required this.book});
  final BookDetail book;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = book.toolsState;
    final open = state == StudyToolsState.ready && book.completeCount > 0;
    final tools = [
      (
        LucideIcons.layers3,
        l10n.toolCards,
        l10n.toolCardsPurpose,
        l10n.toolCardsCount(book.totalCards),
        Routes.bookStudy(book.id, 'cards'),
      ),
      (
        LucideIcons.clipboardList,
        l10n.toolMcqs,
        l10n.toolMcqsPurpose,
        l10n.toolMcqsCount(book.totalMcqs),
        Routes.bookStudy(book.id, 'mcqs'),
      ),
      (
        LucideIcons.notebookText,
        l10n.toolSummary,
        l10n.toolSummaryPurpose,
        null,
        Routes.bookStudy(book.id, 'explanation'),
      ),
      (
        LucideIcons.workflow,
        l10n.toolMindmap,
        l10n.toolMindmapPurpose,
        null,
        Routes.bookMindmap(book.id),
      ),
      (
        LucideIcons.gamepad2,
        l10n.toolMatch,
        l10n.toolMatchPurpose,
        null,
        Routes.bookMatch(book.id),
      ),
    ];
    return NlGroup(
      children: [
        for (final (icon, label, purpose, count, route) in tools)
          NlRow(
            icon: icon,
            label: label,
            value: purpose,
            onTap: open ? () => context.push(route) : null,
            trailing: open
                ? (count == null
                      ? null
                      : Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(count, style: NlText.caption),
                            const SizedBox(width: 4),
                            Icon(
                              Directionality.of(context) == TextDirection.rtl
                                  ? LucideIcons.chevronLeft
                                  : LucideIcons.chevronRight,
                              size: 18,
                              color: NlColors.ink3,
                            ),
                          ],
                        ))
                : state == StudyToolsState.generating
                ? NlBadge(l10n.toolPreparing)
                : Icon(
                    LucideIcons.lock,
                    size: 16,
                    color: NlColors.ink3,
                    semanticLabel: l10n.toolLocked,
                  ),
          ),
      ],
    );
  }
}

enum _StageState { done, active, pending, failed }

class _ProcessingDetails extends StatelessWidget {
  const _ProcessingDetails({
    required this.book,
    required this.coverage,
    required this.detail,
    required this.ready,
  });

  final BookDetail book;
  final CoverageReport? coverage;
  final CoverageDetail? detail;
  final bool ready;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final coverage = this.coverage;
    final detail = this.detail;
    final hasPages = coverage != null && coverage.totalPages > 0;
    final showStages = !ready && book.status != BookStatus.failed;

    final children = <Widget>[
      if (hasPages)
        Wrap(
          spacing: NlSpace.lg,
          runSpacing: NlSpace.sm,
          children: [
            _Stat(
              l10n.statVisualDone,
              isolateLtr('${coverage.visualDone}/${coverage.totalPages}'),
            ),
            _Stat(l10n.statWithVisuals, '${coverage.pagesWithVisuals}'),
            if (coverage.needsReview > 0)
              _Stat(l10n.statNeedsReview, '${coverage.needsReview}', true),
            if (coverage.failed > 0)
              _Stat(l10n.statFailed, '${coverage.failed}', true),
          ],
        ),
      if (detail != null && detail.totalPages > 0) ...[
        const SizedBox(height: NlSpace.md),
        Text(
          [
            l10n.coverageLine(
              detail.coverage,
              detail.processedPages,
              detail.totalPages,
            ),
            if (detail.missingPages.isNotEmpty)
              l10n.coverageMissing(_pageList(detail.missingPages)),
            if (detail.failedPages.isNotEmpty)
              l10n.coverageFailed(_pageList(detail.failedPages)),
          ].join('. '),
          style: NlText.caption.copyWith(
            color: detail.complete ? NlColors.correct : NlColors.ink2,
          ),
        ),
      ],
      if (showStages) ...[
        const SizedBox(height: NlSpace.md),
        _StageRow(
          l10n.stageReading,
          book.isExtracting ? _StageState.active : _StageState.done,
        ),
        _StageRow(
          l10n.stageChapters,
          book.isExtracting || book.chaptersNotStarted
              ? _StageState.pending
              : book.chaptersPhaseDone
              ? (book.failedChapters.isEmpty
                    ? _StageState.done
                    : _StageState.failed)
              : _StageState.active,
          book.chaptersNotStarted
              ? l10n.stageWaiting
              : book.hasChapters
              ? l10n.stageFraction(book.completeCount, book.chapters.length)
              : null,
        ),
        _StageRow(
          l10n.stageVisuals,
          book.isExtracting || !hasPages
              ? _StageState.pending
              : coverage.visualPending > 0
              ? _StageState.active
              : _StageState.done,
          hasPages
              ? l10n.stageFraction(coverage.visualDone, coverage.totalPages)
              : null,
        ),
        _StageRow(
          l10n.stageCoverage,
          !book.chaptersPhaseDone
              ? _StageState.pending
              : (detail?.complete ?? false)
              ? _StageState.done
              // A failed page never completes by itself: retry it below.
              : (detail?.failedPages.isNotEmpty ?? false)
              ? _StageState.failed
              : _StageState.active,
          detail != null && detail.totalPages > 0
              ? isolateLtr('${detail.coverage}%')
              : null,
        ),
        const SizedBox(height: NlSpace.sm),
        Text(l10n.bookLeaveHint, style: NlText.caption),
      ],
    ];

    return DecoratedBox(
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.rule),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          // Open while work is still running, so progress is visible.
          initiallyExpanded: !ready,
          shape: const Border(),
          collapsedShape: const Border(),
          tilePadding: const EdgeInsets.symmetric(horizontal: NlSpace.lg),
          childrenPadding: const EdgeInsets.fromLTRB(
            NlSpace.lg,
            0,
            NlSpace.lg,
            NlSpace.lg,
          ),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          title: Wrap(
            spacing: NlSpace.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(l10n.bookProcessing, style: NlText.rowLabel),
              if (ready)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      LucideIcons.circleCheck,
                      size: 15,
                      color: NlColors.correct,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      l10n.bookProcessingDone,
                      style: NlText.caption.copyWith(color: NlColors.correct),
                    ),
                  ],
                ),
            ],
          ),
          children: children,
        ),
      ),
    );
  }
}

String _pageList(List<int> pages) {
  const shown = 12;
  final head = pages.take(shown).join('، ');
  return pages.length > shown ? '$head…' : head;
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value, [this.alert = false]);

  final String label;
  final String value;
  final bool alert;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: NlText.title.copyWith(
            fontSize: 18,
            color: alert ? NlColors.wrong : NlColors.ink,
          ),
        ),
        Text(label, style: NlText.caption),
      ],
    );
  }
}

class _StageRow extends StatelessWidget {
  const _StageRow(this.label, this.state, [this.detail]);

  final String label;
  final _StageState state;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    final icon = switch (state) {
      _StageState.done => const Icon(
        LucideIcons.circleCheck,
        size: 17,
        color: NlColors.correct,
      ),
      _StageState.active => const SizedBox.square(
        dimension: 15,
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
      _StageState.failed => const Icon(
        LucideIcons.circleAlert,
        size: 17,
        color: NlColors.wrong,
      ),
      _StageState.pending => const Icon(
        LucideIcons.circle,
        size: 17,
        color: NlColors.ruleStrong,
      ),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox.square(dimension: 20, child: Center(child: icon)),
          const SizedBox(width: NlSpace.sm),
          Expanded(
            child: Text(
              label,
              style: NlText.body.copyWith(
                color: state == _StageState.pending
                    ? NlColors.ink3
                    : NlColors.ink,
              ),
            ),
          ),
          if (detail != null) Text(detail!, style: NlText.caption),
        ],
      ),
    );
  }
}

class _RetryRow extends StatelessWidget {
  const _RetryRow({
    required this.failed,
    required this.title,
    required this.detail,
    required this.busy,
    this.onRetry,
  });

  final bool failed;
  final String title;
  final String detail;
  final bool busy;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: NlSpace.lg,
        vertical: NlSpace.md,
      ),
      child: Row(
        children: [
          failed
              ? const Icon(
                  LucideIcons.circleAlert,
                  size: 18,
                  color: NlColors.wrong,
                )
              : const SizedBox.square(
                  dimension: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
          const SizedBox(width: NlSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AutoDirText(title, style: NlText.rowLabel),
                Text(detail, style: NlText.caption),
              ],
            ),
          ),
          if (onRetry != null)
            NlButton(
              label: l10n.actionRetry,
              icon: LucideIcons.rotateCcw,
              kind: NlButtonKind.ghost,
              loading: busy,
              onPressed: busy ? null : onRetry,
            ),
        ],
      ),
    );
  }
}

enum _Tone { error, warning }

class _Banner extends StatelessWidget {
  const _Banner({required this.tone, required this.text, this.actions});

  final _Tone tone;
  final String text;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final error = tone == _Tone.error;
    return Container(
      padding: const EdgeInsets.all(NlSpace.md),
      decoration: BoxDecoration(
        color: error ? NlColors.wrongSoft : NlColors.markerSoft,
        borderRadius: BorderRadius.circular(NlRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                LucideIcons.circleAlert,
                size: 18,
                color: error ? NlColors.wrong : NlColors.ink,
              ),
              const SizedBox(width: NlSpace.sm),
              Expanded(child: AutoDirText(text, style: NlText.body)),
            ],
          ),
          if (actions != null && actions!.isNotEmpty) ...[
            const SizedBox(height: NlSpace.sm),
            Wrap(
              spacing: NlSpace.sm,
              runSpacing: NlSpace.sm,
              children: actions!,
            ),
          ],
        ],
      ),
    );
  }
}
