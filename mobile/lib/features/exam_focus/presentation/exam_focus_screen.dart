import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_error.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../study/presentation/study_widgets.dart';
import '../data/exam_focus_models.dart';
import '../data/exam_focus_repository.dart';
import '../domain/exam_focus_text.dart';

/// 🔥 Exam Focus (the web's app/books/[bookId]/exam-focus): the whole file
/// as swipeable high-yield cards. The owner's first open starts the
/// server-side generation; later visits load the saved deck — it never
/// regenerates on its own. Filters and search run on the server over the
/// whole deck; cards load 40 at a time, a page ahead of the student.
class ExamFocusScreen extends ConsumerStatefulWidget {
  const ExamFocusScreen({
    super.key,
    required this.bookId,
    this.pollInterval = const Duration(seconds: 3),
    this.searchDelay = const Duration(milliseconds: 300),
  });

  final String bookId;
  final Duration pollInterval;
  final Duration searchDelay;

  @override
  ConsumerState<ExamFocusScreen> createState() => _ExamFocusScreenState();
}

class _ExamFocusScreenState extends ConsumerState<ExamFocusScreen> {
  static const _pageSize = 40;
  static const _prefetchAhead = 5;
  static const _resumeEvery = Duration(seconds: 60);

  ExamFocusDeck? _deck;
  bool _loaded = false;
  Object? _error;
  String? _startError;
  bool _startTried = false;
  bool _busy = false;
  Timer? _poll;
  DateTime? _lastResume;

  // Cards for the current filter.
  final _items = <ExamFocusCard>[];
  int _total = 0;
  int? _next = 0;
  bool _fetching = false;
  bool _cardsLoaded = false;
  int _request = 0;

  String? _category;
  bool _savedOnly = false;
  bool _searchOpen = false;
  String _search = '';
  final _searchInput = TextEditingController();
  Timer? _searchTimer;

  late PageController _page = PageController();
  int _index = 0;

  ExamFocusRepository get _repo => ref.read(examFocusRepositoryProvider);
  bool get _unfiltered => _category == null && !_savedOnly && _search.isEmpty;

  @override
  void initState() {
    super.initState();
    _loadDeck();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _searchTimer?.cancel();
    _searchInput.dispose();
    _page.dispose();
    super.dispose();
  }

  Future<void> _loadDeck() async {
    _poll?.cancel();
    try {
      var deck = await _repo.get(widget.bookId);
      // First open → start (the server returns the existing deck if any).
      if (deck == null && !_startTried) {
        _startTried = true;
        try {
          await _repo.start(widget.bookId);
          deck = await _repo.get(widget.bookId);
        } catch (error) {
          if (mounted) {
            setState(() {
              _startError = apiErrorText(context, error);
              _loaded = true;
            });
          }
          return;
        }
      }
      if (!mounted) return;
      final wasProcessing = _deck?.processing ?? false;
      setState(() {
        _deck = deck;
        _loaded = true;
        _error = null;
        _startError = null;
      });
      if (deck == null) return;
      if (deck.processing) {
        _resumeIfStalled(deck);
        _poll = Timer(widget.pollInterval, _loadDeck);
      } else if (deck.ready && (!_cardsLoaded || wasProcessing)) {
        await _reloadCards(restore: true);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error;
          _loaded = true;
        });
      }
    }
  }

  void _resumeIfStalled(ExamFocusDeck deck) {
    if (!deck.isOwner) return;
    final now = DateTime.now();
    if (_lastResume != null && now.difference(_lastResume!) < _resumeEvery) {
      return;
    }
    // The first minute is normal work; re-queue only after that.
    if (_lastResume == null) {
      _lastResume = now;
      return;
    }
    _lastResume = now;
    unawaited(_repo.resume(widget.bookId).catchError((_) {}));
  }

  /// New filter / search → start from the first card (or the remembered
  /// place for the unfiltered deck).
  Future<void> _reloadCards({bool restore = false}) async {
    final request = ++_request;
    final saved = ref.read(examFocusPositionProvider)[widget.bookId] ?? 0;
    final start = _unfiltered && restore ? saved : 0;
    setState(() {
      _items.clear();
      _total = 0;
      _next = 0;
      _cardsLoaded = false;
      _index = start;
      final old = _page;
      _page = PageController(initialPage: start);
      WidgetsBinding.instance.addPostFrameCallback((_) => old.dispose());
    });
    // Fill up to a restored position deep in the deck.
    while (mounted && request == _request && _next != null) {
      await _fetchPage(request);
      if (_items.length > start + _prefetchAhead) break;
    }
    if (mounted && request == _request) {
      setState(() {
        _cardsLoaded = true;
        if (_total > 0 && _index > _total - 1) _index = _total - 1;
      });
    }
  }

  Future<void> _fetchPage(int request) async {
    final cursor = _next;
    if (_fetching || cursor == null) return;
    _fetching = true;
    try {
      final page = await _repo.cards(
        widget.bookId,
        category: _category,
        bookmarkedOnly: _savedOnly,
        search: _search,
        cursor: cursor,
        limit: _pageSize,
      );
      if (!mounted || request != _request) return;
      setState(() {
        _items.addAll(page.items);
        _total = page.total;
        _next = page.next;
      });
    } catch (error) {
      if (mounted && request == _request) {
        showNlToast(context, apiErrorText(context, error));
        setState(() => _next = cursor); // allow a retry on the next swipe
      }
    } finally {
      _fetching = false;
    }
  }

  void _onPage(int index) {
    setState(() => _index = index);
    if (_unfiltered) {
      ref.read(examFocusPositionProvider.notifier).set(widget.bookId, index);
    }
    if (_next != null && index >= _items.length - _prefetchAhead) {
      _fetchPage(_request);
    }
  }

  void _go(int delta) {
    final target = (_index + delta).clamp(0, _total == 0 ? 0 : _total - 1);
    _page.animateToPage(
      target,
      duration: NlMotion.normal,
      curve: NlMotion.ease,
    );
  }

  void _setFilter({String? category, bool savedOnly = false}) {
    setState(() {
      _category = category;
      _savedOnly = savedOnly;
    });
    _reloadCards(restore: true);
  }

  void _onSearch(String value) {
    _searchTimer?.cancel();
    _searchTimer = Timer(widget.searchDelay, () {
      final next = value.trim();
      if (next == _search) return;
      _search = next;
      _reloadCards(restore: true);
    });
  }

  Future<void> _toggleBookmark(int index) async {
    final card = _items[index];
    final next = !card.bookmarked;
    setState(() => _items[index] = card.withBookmark(next));
    try {
      await _repo.setBookmark(card.id, next);
      final deck = await _repo.get(widget.bookId);
      if (mounted && deck != null) setState(() => _deck = deck);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        final i = _items.indexWhere((c) => c.id == card.id);
        if (i >= 0) _items[i] = card;
      });
      showNlToast(context, apiErrorText(context, error));
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      _cardsLoaded = false;
      await _loadDeck();
    } catch (error) {
      if (mounted) showNlToast(context, apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmRegenerate() async {
    final l10n = AppLocalizations.of(context);
    final ok = await showNlConfirm(
      context,
      title: l10n.efRegenerate,
      message: l10n.efRegenerateConfirm,
      confirmLabel: l10n.efRegenerate,
      destructive: true,
    );
    if (ok && mounted) {
      ref.read(examFocusPositionProvider.notifier).set(widget.bookId, 0);
      await _run(() => _repo.regenerate(widget.bookId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final deck = _deck;

    PreferredSizeWidget bar({List<Widget> actions = const [], String? sub}) =>
        AppBar(
          toolbarHeight: kToolbarHeight + 8,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(isolateLtr('Exam Focus')),
              Text(sub ?? l10n.efSubtitle, style: NlText.caption),
            ],
          ),
          actions: actions,
        );

    Widget message(String title, String body, [Widget? action]) => Scaffold(
      appBar: bar(),
      body: NlEmptyState(
        title: title,
        message: body,
        expression: NiroExpression.shocked,
        actionLabel: null,
        onAction: null,
      ).withAction(action),
    );

    if (_startError != null && deck == null) {
      return message(
        l10n.efStartFailed,
        _startError!,
        NlButton(
          label: l10n.efTryAgain,
          onPressed: () {
            _startTried = false;
            setState(() => _loaded = false);
            _loadDeck();
          },
        ),
      );
    }
    final error = _error;
    if (error != null && deck == null) {
      return message(
        l10n.efUnavailable,
        error is RejectedException && error.code == 'PRECONDITION_FAILED'
            ? error.message
            : l10n.efCannotOpen,
      );
    }
    if (!_loaded || deck == null) {
      return Scaffold(
        appBar: bar(),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: NlSpace.md),
              Text(l10n.efPreparing, style: NlText.secondary),
            ],
          ),
        ),
      );
    }

    if (deck.processing) {
      return Scaffold(
        appBar: bar(),
        body: _Progress(deck: deck),
      );
    }

    final failedUnits = deck.units.where((u) => u.failed).toList();
    if (deck.status == 'failed' || deck.totalCards == 0) {
      return message(
        failedUnits.isNotEmpty ? l10n.efAnalysisFailed : l10n.efNothingFound,
        deck.errorMessage ?? l10n.efTryRegenerate,
        !deck.isOwner
            ? null
            : NlButton(
                label: failedUnits.isNotEmpty
                    ? l10n.actionRetry
                    : l10n.efRegenerate,
                icon: LucideIcons.rotateCcw,
                loading: _busy,
                onPressed: _busy
                    ? null
                    : failedUnits.isNotEmpty
                    ? () => _run(() => _repo.retryFailed(widget.bookId))
                    : _confirmRegenerate,
              ),
      );
    }

    return Scaffold(
      appBar: bar(
        sub: l10n.efCardCount(deck.totalCards),
        actions: [
          IconButton(
            tooltip: l10n.efSearch,
            icon: Icon(_searchOpen ? LucideIcons.searchX : LucideIcons.search),
            onPressed: () => setState(() => _searchOpen = !_searchOpen),
          ),
          if (deck.isOwner)
            IconButton(
              tooltip: l10n.efRegenerate,
              icon: const Icon(LucideIcons.rotateCcw),
              onPressed: _busy ? null : _confirmRegenerate,
            ),
        ],
      ),
      body: Column(
        children: [
          ?_notice(l10n, deck, failedUnits),
          if (_searchOpen)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                NlSpace.page,
                NlSpace.sm,
                NlSpace.page,
                0,
              ),
              child: TextField(
                controller: _searchInput,
                autofocus: true,
                onChanged: _onSearch,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: l10n.efSearchHint,
                  prefixIcon: const Icon(LucideIcons.search, size: 18),
                  suffixIcon: _searchInput.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: l10n.efClearSearch,
                          icon: const Icon(LucideIcons.x, size: 18),
                          onPressed: () {
                            _searchInput.clear();
                            _onSearch('');
                            setState(() {});
                          },
                        ),
                ),
              ),
            ),
          _Filters(
            deck: deck,
            category: _category,
            savedOnly: _savedOnly,
            onAll: () => _setFilter(),
            onSaved: () => _setFilter(savedOnly: !_savedOnly),
            onCategory: (c) => _setFilter(category: _category == c ? null : c),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: NlSpace.page),
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: NlProgressBar(
                value: _total == 0 ? 0 : (_index + 1) / _total,
                semanticsLabel: l10n.efProgress,
              ),
            ),
          ),
          Expanded(child: _stage(l10n)),
        ],
      ),
      bottomNavigationBar: _Nav(
        index: _index,
        total: _total,
        onPrevious: () => _go(-1),
        onNext: () => _go(1),
      ),
    );
  }

  Widget? _notice(
    AppLocalizations l10n,
    ExamFocusDeck deck,
    List<ExamFocusUnit> failedUnits,
  ) {
    String? text;
    Widget? action;
    if (deck.status == 'partial_failed' && failedUnits.isNotEmpty) {
      text = l10n.efPartial(
        failedUnits.map((u) => pageRange(u.pageStart, u.pageEnd)).join('، '),
      );
      if (deck.isOwner) {
        action = TextButton(
          onPressed: _busy
              ? null
              : () => _run(() => _repo.retryFailed(widget.bookId)),
          child: Text(l10n.actionRetry),
        );
      }
    } else if (deck.coverage != null && !deck.coverage!.complete) {
      final c = deck.coverage!;
      text = [
        l10n.efCoverage(c.coveredContentPages, c.contentPages),
        if (c.pagesWithoutText > 0) l10n.efNoTextPages(c.pagesWithoutText),
      ].join(' · ');
    }
    if (text == null) return null;
    return Container(
      width: double.infinity,
      color: NlColors.markerSoft,
      padding: const EdgeInsets.symmetric(
        horizontal: NlSpace.page,
        vertical: NlSpace.xs,
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text,
              style: NlText.caption.copyWith(color: NlColors.ink),
            ),
          ),
          ?action,
        ],
      ),
    );
  }

  Widget _stage(AppLocalizations l10n) {
    if (!_cardsLoaded && _items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_total == 0) {
      return NlEmptyState(
        title: l10n.efNoMatch,
        message: l10n.efNoMatchHint,
        expression: NiroExpression.sleepy,
      );
    }
    // Dragging the card left goes to the next one, as on the web.
    return Directionality(
      textDirection: TextDirection.ltr,
      child: PageView.builder(
        controller: _page,
        itemCount: _total,
        onPageChanged: _onPage,
        itemBuilder: (context, i) {
          if (i >= _items.length) {
            if (_next != null) {
              WidgetsBinding.instance.addPostFrameCallback(
                (_) => _fetchPage(_request),
              );
            }
            return const Center(child: CircularProgressIndicator());
          }
          return Padding(
            padding: const EdgeInsets.fromLTRB(
              NlSpace.page,
              NlSpace.md,
              NlSpace.page,
              NlSpace.md,
            ),
            child: ExamFocusCardView(
              card: _items[i],
              position: i + 1,
              total: _total,
              onBookmark: () => _toggleBookmark(i),
              onSource: _items[i].sourcePages.isEmpty
                  ? null
                  : () => showPageImageSheet(
                      context,
                      bookId: widget.bookId,
                      page: _items[i].sourcePages.first,
                    ),
            ),
          );
        },
      ),
    );
  }
}

extension on NlEmptyState {
  /// The empty state with an arbitrary action widget under it.
  Widget withAction(Widget? action) => action == null
      ? this
      : Center(
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                NlEmptyState(
                  title: title,
                  message: message,
                  expression: expression,
                  inline: true,
                ),
                const SizedBox(height: NlSpace.lg),
                action,
              ],
            ),
          ),
        );
}

class _Filters extends StatelessWidget {
  const _Filters({
    required this.deck,
    required this.category,
    required this.savedOnly,
    required this.onAll,
    required this.onSaved,
    required this.onCategory,
  });

  final ExamFocusDeck deck;
  final String? category;
  final bool savedOnly;
  final VoidCallback onAll;
  final VoidCallback onSaved;
  final ValueChanged<String> onCategory;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final chips = <Widget>[
      _Chip(
        label: '🔥 ${l10n.efAll} · ${deck.totalCards}',
        on: category == null && !savedOnly,
        onTap: onAll,
      ),
      if (deck.bookmarkedCount > 0 || savedOnly)
        _Chip(
          label: '🔖 ${l10n.efSaved} · ${deck.bookmarkedCount}',
          on: savedOnly,
          onTap: onSaved,
        ),
      for (final f in visibleCategoryFilters(deck.categoryCounts))
        _Chip(
          label:
              '${categoryInfo(f.category).emoji} ${categoryInfo(f.category).label} · ${f.count}',
          on: category == f.category,
          onTap: () => onCategory(f.category),
        ),
    ];
    return SizedBox(
      height: 60,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: NlSpace.page,
          vertical: NlSpace.sm,
        ),
        itemCount: chips.length,
        separatorBuilder: (_, _) => const SizedBox(width: NlSpace.sm),
        itemBuilder: (_, i) => chips[i],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.on, required this.onTap});

  final String label;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: on,
    child: Material(
      color: on ? NlColors.ink : NlColors.sheet,
      shape: StadiumBorder(
        side: BorderSide(color: on ? NlColors.ink : NlColors.rule),
      ),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Center(
            widthFactor: 1,
            child: Text(
              isolate(label),
              style: NlText.caption.copyWith(
                fontWeight: FontWeight.w600,
                color: on ? Colors.white : NlColors.ink2,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/// One high-yield card (English source content, LTR): category badge,
/// topic, title, lines with numbers highlighted, the key takeaway, a note
/// when the source was unclear, and the source pages.
class ExamFocusCardView extends StatelessWidget {
  const ExamFocusCardView({
    super.key,
    required this.card,
    required this.position,
    required this.total,
    required this.onBookmark,
    this.onSource,
  });

  final ExamFocusCard card;
  final int position;
  final int total;
  final VoidCallback onBookmark;
  final VoidCallback? onSource;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final info = categoryInfo(card.category);
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Container(
        decoration: BoxDecoration(
          color: NlColors.sheet,
          borderRadius: BorderRadius.circular(NlRadius.lg),
          border: Border.all(color: NlColors.ink, width: 1.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                NlSpace.lg,
                NlSpace.md,
                NlSpace.sm,
                0,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: NlColors.paper,
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          '${info.emoji} ${info.label.toUpperCase()} · ${info.labelAr}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: NlText.caption.copyWith(
                            color: NlColors.ink,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: NlSpace.sm),
                  IconButton(
                    tooltip: card.bookmarked ? l10n.efUnsave : l10n.efSave,
                    isSelected: card.bookmarked,
                    onPressed: onBookmark,
                    icon: Icon(
                      card.bookmarked
                          ? LucideIcons.bookmarkCheck
                          : LucideIcons.bookmark,
                      color: card.bookmarked
                          ? NlColors.niroDeep
                          : NlColors.ink3,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  NlSpace.lg,
                  NlSpace.sm,
                  NlSpace.lg,
                  NlSpace.md,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (card.topic.isNotEmpty)
                      Text(card.topic, style: NlText.caption),
                    Text(
                      card.title,
                      style: NlText.title.copyWith(fontSize: 20, height: 1.35),
                    ),
                    const SizedBox(height: NlSpace.md),
                    for (final point in card.points)
                      Padding(
                        padding: const EdgeInsets.only(bottom: NlSpace.sm),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(top: 9, right: 10),
                              child: SizedBox.square(
                                dimension: 6,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: NlColors.ink,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ),
                            ),
                            Expanded(
                              child: _Highlighted(text: stripBullet(point)),
                            ),
                          ],
                        ),
                      ),
                    if (card.highlightText.isNotEmpty) ...[
                      const SizedBox(height: NlSpace.sm),
                      Container(
                        padding: const EdgeInsets.all(NlSpace.md),
                        decoration: BoxDecoration(
                          color: NlColors.niroSoft,
                          borderRadius: BorderRadius.circular(NlRadius.md),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              '💡 ${card.highlightLabel.isEmpty ? 'KEY POINT' : card.highlightLabel}',
                              style: NlText.label.copyWith(
                                color: NlColors.niroDeep,
                              ),
                            ),
                            const SizedBox(height: 4),
                            _Highlighted(text: card.highlightText),
                          ],
                        ),
                      ),
                    ],
                    if (card.flag.isNotEmpty) ...[
                      const SizedBox(height: NlSpace.sm),
                      Text.rich(
                        TextSpan(
                          children: [
                            const TextSpan(
                              text: '⚠️ Source note: ',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                            TextSpan(text: card.flag),
                          ],
                        ),
                        style: NlText.caption.copyWith(color: NlColors.ink2),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: NlSpace.sm,
                vertical: 2,
              ),
              child: Row(
                children: [
                  if (card.sourcePages.isNotEmpty)
                    TextButton.icon(
                      onPressed: onSource,
                      icon: const Icon(LucideIcons.bookOpen, size: 15),
                      label: Text('Source: ${pagesLabel(card.sourcePages)}'),
                    ),
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.only(right: NlSpace.sm),
                    child: Text('$position / $total', style: NlText.caption),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Numbers, cutoffs and doses marked with the highlighter.
class _Highlighted extends StatelessWidget {
  const _Highlighted({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Text.rich(
    TextSpan(
      children: [
        for (final s in splitHighlights(text))
          TextSpan(
            text: s.text,
            style: s.highlight
                ? const TextStyle(
                    backgroundColor: NlColors.marker,
                    fontWeight: FontWeight.w700,
                  )
                : null,
          ),
      ],
    ),
    style: NlText.body.copyWith(height: 1.5),
  );
}

class _Nav extends StatelessWidget {
  const _Nav({
    required this.index,
    required this.total,
    required this.onPrevious,
    required this.onNext,
  });

  final int index;
  final int total;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: NlColors.sheet,
        border: Border(top: BorderSide(color: NlColors.rule)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: NlSpace.page,
            vertical: NlSpace.sm,
          ),
          // Left = previous, right = next — matches the swipe (as the web).
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              children: [
                NlButton(
                  label: l10n.flashPrev,
                  icon: LucideIcons.chevronLeft,
                  kind: NlButtonKind.ghost,
                  onPressed: index > 0 ? onPrevious : null,
                ),
                Expanded(
                  child: Text(
                    total == 0 ? '0 / 0' : '${index + 1} / $total',
                    textAlign: TextAlign.center,
                    style: NlText.rowLabel,
                  ),
                ),
                NlButton(
                  label: l10n.flashNext,
                  kind: NlButtonKind.secondary,
                  onPressed: total > 0 && index < total - 1 ? onNext : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Real pipeline progress (the web's ExamFocusProgress): every row is an
/// actual server-side step; units are the page ranges analysed by workers.
class _Progress extends StatelessWidget {
  const _Progress({required this.deck});
  final ExamFocusDeck deck;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final units = deck.units;
    final settled = units.where((u) => u.complete || u.failed).length;
    final failed = units.where((u) => u.failed).length;
    final facts = units.fold<int>(0, (sum, u) => sum + u.factCount);
    final allSettled = settled == units.length;
    final finalizing = deck.status == 'finalizing';
    final stages = [
      (
        l10n.efStageAnalyse,
        l10n.efStageUnits(settled, units.length),
        allSettled ? (failed > 0 ? 'failed' : 'done') : 'active',
      ),
      (
        l10n.efStageExtract,
        l10n.efStageFacts(facts),
        allSettled ? 'done' : (facts > 0 ? 'active' : 'pending'),
      ),
      (l10n.efStageDedupe, null, finalizing ? 'active' : 'pending'),
      (l10n.efStageBuild, null, finalizing ? 'active' : 'pending'),
      (l10n.efStageCoverage, null, finalizing ? 'active' : 'pending'),
    ];
    return ListView(
      padding: const EdgeInsets.all(NlSpace.page),
      children: [
        const Center(
          child: NiroImage(expression: NiroExpression.fired, size: 110),
        ),
        const SizedBox(height: NlSpace.md),
        Text(
          l10n.efProgressTitle,
          style: NlText.title,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: NlSpace.sm),
        Text(
          l10n.efProgressBody,
          style: NlText.secondary,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: NlSpace.lg),
        NlProgressBar(
          value: units.isEmpty ? 0 : settled / units.length,
          semanticsLabel: l10n.efProgressTitle,
        ),
        const SizedBox(height: NlSpace.lg),
        for (final (label, detail, state) in stages)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                _StateIcon(state),
                const SizedBox(width: NlSpace.sm),
                Expanded(child: Text(label, style: NlText.body)),
                if (detail != null) Text(detail, style: NlText.caption),
              ],
            ),
          ),
        const SizedBox(height: NlSpace.md),
        Wrap(
          spacing: NlSpace.sm,
          runSpacing: NlSpace.sm,
          children: [
            for (final u in units)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: NlColors.sheet,
                  borderRadius: BorderRadius.circular(99),
                  border: Border.all(color: NlColors.rule),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _StateIcon(
                      u.complete
                          ? 'done'
                          : u.failed
                          ? 'failed'
                          : u.status == 'processing' || u.status == 'retrying'
                          ? 'active'
                          : 'pending',
                      size: 14,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      l10n.efUnitPages(pageRange(u.pageStart, u.pageEnd)),
                      style: NlText.caption,
                    ),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _StateIcon extends StatelessWidget {
  const _StateIcon(this.state, {this.size = 17});

  final String state;
  final double size;

  @override
  Widget build(BuildContext context) => switch (state) {
    'done' => Icon(
      LucideIcons.circleCheck,
      size: size,
      color: NlColors.correct,
    ),
    'failed' => Icon(
      LucideIcons.circleAlert,
      size: size,
      color: NlColors.wrong,
    ),
    'active' => SizedBox.square(
      dimension: size - 2,
      child: const CircularProgressIndicator(strokeWidth: 2),
    ),
    _ => Icon(LucideIcons.circle, size: size, color: NlColors.ruleStrong),
  };
}
