import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
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
    }
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
        final notice = _CoverageNotice(
          content: content,
          tool: widget.tool,
          errors: prep.errors,
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
  });

  final StudyContent content;
  final StudyTool tool;
  final List<String> errors;

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
      child: Text(
        parts.join(' · '),
        style: NlText.caption.copyWith(color: warn ? NlColors.ink : null),
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
