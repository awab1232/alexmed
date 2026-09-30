import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../exam_focus/data/exam_focus_models.dart';
import '../data/study_models.dart';
import '../data/study_preparation.dart';
import '../data/study_repository.dart';
import 'flashcards_view.dart';
import 'quiz_view.dart';
import 'summary_view.dart';

/// Studying the whole file (the web's app/books/[bookId]/study): cards,
/// questions or the summary over every chapter, in page order. When the
/// owner opens cards / questions that some chapters don't have yet, the
/// same server-side preparation as the web runs first (see
/// [StudyPreparation]).
class StudyScreen extends ConsumerStatefulWidget {
  const StudyScreen({super.key, required this.bookId, required this.tool});

  final String bookId;
  final StudyTool tool;

  @override
  ConsumerState<StudyScreen> createState() => _StudyScreenState();
}

class _StudyScreenState extends ConsumerState<StudyScreen> {
  StudyContent? _content;
  Object? _error;
  KnowledgeCoverage? _knowledge;

  /// The knowledge base (Exam Focus) status, for the owner's rebuild link.
  String? _deckStatus;
  late final StudyPreparation _prep;

  StudyRepository get _repo => ref.read(studyRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _prep = StudyPreparation(
      repo: _repo,
      bookId: widget.bookId,
      tool: widget.tool,
      onReload: _load,
    );
    _load().then((_) {
      final content = _content;
      if (content != null && mounted) _prep.run(content);
    });
  }

  @override
  void dispose() {
    _prep.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final content = await _repo.content(widget.bookId);
      if (mounted) {
        setState(() {
          _content = content;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error);
      return;
    }
    if (widget.tool == StudyTool.summary) return;
    // The coverage matrix and (owner) the knowledge base status — extras
    // on the coverage line; failures just hide them.
    try {
      final knowledgeFuture = _repo.knowledge(widget.bookId, widget.tool);
      final deckFuture = (_content?.isOwner ?? false)
          ? _repo.examFocus(widget.bookId)
          : Future<ExamFocusDeck?>.value();
      final knowledge = await knowledgeFuture;
      final deck = await deckFuture;
      if (!mounted) return;
      setState(() {
        _knowledge = knowledge;
        _deckStatus = deck?.status;
      });
    } catch (_) {}
  }

  Future<void> _rebuild() async {
    final content = _content;
    final knowledge = _knowledge;
    if (content == null || knowledge == null) return;
    final l10n = AppLocalizations.of(context);
    final ok = await showNlConfirm(
      context,
      title: l10n.studyRebuildTitle,
      message: widget.tool == StudyTool.cards
          ? l10n.studyRebuildCardsConfirm
          : l10n.studyRebuildMcqsConfirm,
      confirmLabel: l10n.studyRebuildTitle,
      destructive: true,
    );
    if (!ok || !mounted) return;
    final started = await _prep.rebuild([
      for (final c in content.analyzed)
        if (knowledge.v1ChapterIds.contains(c.id)) c,
    ]);
    if (!started && mounted) showNlToast(context, l10n.studyRebuildNotReady);
  }

  String _toolTitle(AppLocalizations l10n) => switch (widget.tool) {
    StudyTool.cards => l10n.toolCards,
    StudyTool.mcqs => l10n.toolMcqs,
    StudyTool.summary => l10n.summaryTitle,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final content = _content;
    if (content == null) {
      return Scaffold(
        appBar: AppBar(title: Text(_toolTitle(l10n))),
        body: switch (_error) {
          null => const Center(child: CircularProgressIndicator()),
          NotFoundException() => NlEmptyState(
            title: l10n.bookNotFound,
            expression: NiroExpression.shocked,
          ),
          final error => NlErrorView(error: error, onRetry: _load),
        },
      );
    }

    return ValueListenableBuilder(
      valueListenable: _prep.state,
      builder: (context, prep, _) {
        final knowledge = _knowledge;
        final canRebuild =
            content.isOwner &&
            knowledge != null &&
            _deckStatus != 'failed' &&
            content.analyzed.any((c) => knowledge.v1ChapterIds.contains(c.id));
        final notice = _CoverageNotice(
          content: content,
          tool: widget.tool,
          errors: prep.errors,
          knowledge: knowledge,
          onRebuild: canRebuild && !prep.busy ? _rebuild : null,
        );
        if (prep.busy) {
          return Scaffold(
            appBar: _StudyAppBar(title: _toolTitle(l10n), book: content.title),
            body: Column(
              children: [
                notice,
                Expanded(
                  child: _Preparing(state: prep, tool: widget.tool),
                ),
              ],
            ),
          );
        }
        return switch (widget.tool) {
          StudyTool.cards => FlashcardsView(
            content: content,
            notice: notice,
            title: _toolTitle(l10n),
          ),
          StudyTool.mcqs => QuizView(
            content: content,
            notice: notice,
            title: _toolTitle(l10n),
          ),
          StudyTool.summary => SummaryView(
            content: content,
            notice: notice,
            onReload: _load,
          ),
        };
      },
    );
  }
}

/// Tool name with the book's title underneath.
class _StudyAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _StudyAppBar({required this.title, required this.book});

  final String title;
  final String book;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + 8);

  @override
  Widget build(BuildContext context) => AppBar(
    toolbarHeight: kToolbarHeight + 8,
    title: StudyTitle(title: title, book: book),
  );
}

class StudyTitle extends StatelessWidget {
  const StudyTitle({super.key, required this.title, required this.book});

  final String title;
  final String book;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(title),
      Text(
        isolate(book),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: NlText.caption,
      ),
    ],
  );
}

/// The web's honest coverage line: what was read, analysed and generated
/// from — highlighted whenever anything is short.
class _CoverageNotice extends StatelessWidget {
  const _CoverageNotice({
    required this.content,
    required this.tool,
    required this.errors,
    this.knowledge,
    this.onRebuild,
  });

  final StudyContent content;
  final StudyTool tool;
  final List<String> errors;
  final KnowledgeCoverage? knowledge;
  final VoidCallback? onRebuild;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final m = content.manifest;
    final output =
        m.outputs[switch (tool) {
          StudyTool.cards => 'flashcards',
          StudyTool.mcqs => 'mcqs',
          StudyTool.summary => 'summary',
        }];
    final analyzed = content.analyzed.length;
    final warn =
        m.extractedPages < m.totalPages ||
        analyzed < content.chapters.length ||
        (output?.short ?? false) ||
        errors.isNotEmpty;
    final parts = [
      l10n.studyCoverageRead(m.extractedPages, m.totalPages),
      l10n.studyCoverageAnalyzed(analyzed, content.chapters.length),
      if (output != null && output.requiredChunks > 0)
        l10n.studyCoverageChunks(output.coveredChunks, output.requiredChunks),
      if (m.failedPages.isNotEmpty)
        l10n.studyCoverageFailedPages(m.failedPages.join('، ')),
      if (errors.isNotEmpty) l10n.studyCoverageGenFailed(errors.join('، ')),
    ];
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: NlSpace.page,
        vertical: NlSpace.sm,
      ),
      color: warn ? NlColors.markerSoft : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            parts.join(' · '),
            style: NlText.caption.copyWith(color: warn ? NlColors.ink : null),
          ),
          if ((knowledge?.rows.isNotEmpty ?? false) || onRebuild != null)
            Wrap(
              spacing: NlSpace.sm,
              children: [
                if (knowledge != null && knowledge!.rows.isNotEmpty)
                  _NoticeLink(
                    label: l10n.studyKnowledgeLine(
                      tool == StudyTool.cards ? l10n.toolCards : l10n.toolMcqs,
                      knowledge!.covered(tool),
                      knowledge!.rows.length,
                    ),
                    onTap: () => showKnowledgeMatrix(context, knowledge!, tool),
                  ),
                if (onRebuild != null)
                  _NoticeLink(
                    label: tool == StudyTool.cards
                        ? l10n.studyRebuildCards
                        : l10n.studyRebuildMcqs,
                    onTap: onRebuild!,
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _Preparing extends StatelessWidget {
  const _Preparing({required this.state, required this.tool});

  final PrepState state;
  final StudyTool tool;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final knowledge = state.phase == PrepPhase.knowledge;
    final String title;
    final String body;
    final double? progress;
    if (knowledge) {
      title = l10n.studyKnowledgeTitle;
      body = [
        tool == StudyTool.cards
            ? l10n.studyKnowledgeBodyCards
            : l10n.studyKnowledgeBodyMcqs,
        if (state.unitsTotal > 0)
          l10n.studyKnowledgeUnits(state.unitsDone, state.unitsTotal),
      ].join(' ');
      progress = state.unitsTotal > 0
          ? state.unitsDone / state.unitsTotal
          : null;
    } else {
      title = tool == StudyTool.cards
          ? l10n.studyGeneratingCards
          : l10n.studyGeneratingMcqs;
      body = [
        l10n.studyGeneratingProgress(state.done, state.total),
        if (state.current != null)
          l10n.studyGeneratingNow(state.current!)
        else if (state.waiting > 0)
          l10n.studyGeneratingQueue(state.waiting),
      ].join(' · ');
      progress = state.total > 0 ? state.done / state.total : null;
    }
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(NlSpace.xl),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const NiroImage(expression: NiroExpression.explaining, size: 120),
              const SizedBox(height: NlSpace.lg),
              Text(title, style: NlText.title, textAlign: TextAlign.center),
              const SizedBox(height: NlSpace.sm),
              AutoDirText(body, style: NlText.secondary),
              const SizedBox(height: NlSpace.lg),
              progress == null
                  ? const LinearProgressIndicator(minHeight: 6)
                  : NlProgressBar(value: progress, semanticsLabel: title),
              const SizedBox(height: NlSpace.md),
              Text(
                l10n.studyLeaveHint,
                style: NlText.caption,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Empty tool (no cards / questions yet).
class StudyEmpty extends StatelessWidget {
  const StudyEmpty({super.key, required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => NlEmptyState(
    title: title,
    message: message,
    expression: NiroExpression.sleepy,
  );
}

class _NoticeLink extends StatelessWidget {
  const _NoticeLink({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 36),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Text(
          label,
          style: NlText.caption.copyWith(
            color: NlColors.niroDeep,
            fontWeight: FontWeight.w600,
            decoration: TextDecoration.underline,
          ),
        ),
      ),
    ),
  );
}

/// 🧭 Coverage matrix: each Exam Focus fact → the cards / questions built
/// from it → its pages (the web study page's knowledge sheet).
Future<void> showKnowledgeMatrix(
  BuildContext context,
  KnowledgeCoverage knowledge,
  StudyTool tool,
) {
  final l10n = AppLocalizations.of(context);
  bool covered(KnowledgeRow r) =>
      tool == StudyTool.cards ? r.cardCount > 0 : r.questionCount > 0;
  return showNlSheet<void>(
    context,
    title: l10n.studyMatrixTitle(
      knowledge.covered(tool),
      knowledge.rows.length,
    ),
    builder: (context) => Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.studyMatrixHint, style: NlText.caption),
        const SizedBox(height: NlSpace.sm),
        Flexible(
          child: ListView.separated(
            shrinkWrap: true,
            itemCount: knowledge.rows.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final r = knowledge.rows[i];
              return Opacity(
                opacity: covered(r) ? 1 : 0.55,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: NlSpace.sm),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AutoDirText(
                        '#${r.orderIndex} ${r.title}',
                        style: NlText.rowLabel.copyWith(fontSize: 14),
                      ),
                      Text(
                        [
                          l10n.studyMatrixPages(r.sourcePages.join('، ')),
                          '🃏 ${r.cardCount}',
                          '❓ ${r.questionCount}',
                          if (r.questionTypes.isNotEmpty)
                            r.questionTypes.join('، '),
                        ].join(' · '),
                        style: NlText.caption,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    ),
  );
}
