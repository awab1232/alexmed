import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../library/data/library_models.dart' show bookDisplayTitle;
import '../data/question_answers.dart';
import '../data/question_file_models.dart';
import '../data/question_file_repository.dart';
import '../domain/question_rules.dart';
import 'question_deck_view.dart';

/// One question file — the web's app/books/question-files/[bookId]: what
/// was really found in the file (a stated answer is distinct from "no
/// answer in the source"; an AI-suggested one is labelled), while it is
/// extracted, failed (with the reason and a retry), or ready as cards.
///
/// Polls like the web while the file is extracted or its images /
/// explanations are still being added — only while this screen is on top
/// and the app is in the foreground, backing off while nothing changes.
class QuestionFileScreen extends ConsumerStatefulWidget {
  const QuestionFileScreen({
    super.key,
    required this.fileId,
    this.pollBase = const Duration(seconds: 3),
  });

  final String fileId;
  final Duration pollBase;

  @override
  ConsumerState<QuestionFileScreen> createState() => _QuestionFileScreenState();
}

class _QuestionFileScreenState extends ConsumerState<QuestionFileScreen>
    with WidgetsBindingObserver {
  // Multiples of pollBase: 3 s, slowing to 15 s while nothing changes.
  static const _backoff = [1, 1, 1, 2, 2, 3, 3, 4, 5];

  /// A complete file whose coverage never reports done (no image pages)
  /// stops being polled after this many unchanged answers.
  static const _maxQuietTicks = 24;

  QuestionFileDetail? _file;
  Object? _error;
  Timer? _timer;
  bool _foreground = true;
  bool _loading = false;
  int _quietTicks = 0;
  String? _signature;
  bool _retrying = false;

  QuestionFileRepository get _repo => ref.read(questionFileRepositoryProvider);

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
      final file = await _repo.get(widget.fileId);
      if (!mounted) return;
      final c = file.content.coverage;
      final signature =
          '${file.status}|${file.questions.length}|${c.imagePagesProcessed}|'
          '${c.questionsAiComplete}|${c.done}';
      _quietTicks = signature == _signature ? _quietTicks + 1 : 0;
      _signature = signature;
      setState(() {
        _file = file;
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      _loading = false;
      _schedule();
    }
  }

  void _schedule() {
    final file = _file;
    if (!mounted) return;
    final working = file == null ? _error != null : file.stillWorking;
    if (!working) return;
    if (file?.status == QuestionFileStatus.complete &&
        _quietTicks >= _maxQuietTicks) {
      return;
    }
    final step = _backoff[_quietTicks.clamp(0, _backoff.length - 1)];
    _timer = Timer(widget.pollBase * step, () {
      if (_visible) {
        _refresh();
      } else {
        _schedule();
      }
    });
  }

  Future<void> _retry() async {
    setState(() => _retrying = true);
    try {
      await _repo.retryExtraction(widget.fileId);
      ref.invalidate(questionFilesProvider);
      _quietTicks = 0;
      await _refresh();
    } catch (error) {
      if (mounted) showNlToast(context, apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _retrying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final file = _file;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          file == null
              ? l10n.qfTitle
              : isolate(bookDisplayTitle(file.fileName)),
        ),
      ),
      body: file == null
          ? (_error != null
                ? NlErrorView(error: _error!, onRetry: _refresh)
                : const Padding(
                    padding: EdgeInsets.all(NlSpace.page),
                    child: NlListSkeleton(),
                  ))
          : _body(context, l10n, file),
    );
  }

  Widget _body(
    BuildContext context,
    AppLocalizations l10n,
    QuestionFileDetail file,
  ) {
    final questions = file.questions;
    final banner = switch (file.status) {
      QuestionFileStatus.extracting => _Banner(
        icon: LucideIcons.loaderCircle,
        spinning: true,
        text: l10n.qfExtracting,
      ),
      QuestionFileStatus.failed => _Banner(
        icon: LucideIcons.circleAlert,
        error: true,
        text: file.extractionError?.isNotEmpty == true
            ? file.extractionError!
            : l10n.qfFailed,
        action: NlButton(
          label: l10n.qfRetry,
          kind: NlButtonKind.secondary,
          icon: LucideIcons.rotateCcw,
          loading: _retrying,
          onPressed: _retry,
        ),
      ),
      _ when file.stillWorking && questions.isNotEmpty => _Banner(
        icon: LucideIcons.sparkles,
        text: l10n.qfEnriching(
          file.content.coverage.questionsAiComplete,
          file.content.coverage.questionsTotal,
        ),
      ),
      _ => null,
    };

    if (questions.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(NlSpace.page),
        children: [
          ?banner,
          if (file.status == QuestionFileStatus.complete)
            NlEmptyState(inline: true, title: l10n.qfNoQuestions),
        ],
      );
    }

    final answers =
        ref.watch(questionAnswersProvider)[file.id] ??
        const <String, CardAnswer>{};
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            NlSpace.page,
            0,
            NlSpace.page,
            NlSpace.xs,
          ),
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              l10n.qfExtractedCount(questions.length),
              style: NlText.caption,
            ),
          ),
        ),
        if (banner != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: NlSpace.page),
            child: banner,
          ),
        Expanded(
          child: QuestionDeckView(
            questions: questions,
            answers: answers,
            initialIndex: ref.read(questionPositionProvider)[file.id] ?? 0,
            onIndexChanged: (i) =>
                ref.read(questionPositionProvider.notifier).set(file.id, i),
            onAnswer: (questionId, answer) => ref
                .read(questionAnswersProvider.notifier)
                .set(file.id, questionId, answer),
          ),
        ),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.icon,
    required this.text,
    this.error = false,
    this.spinning = false,
    this.action,
  });

  final IconData icon;
  final String text;
  final bool error;
  final bool spinning;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final fg = error ? NlColors.wrong : NlColors.ink2;
    return Container(
      margin: const EdgeInsets.only(bottom: NlSpace.sm),
      padding: const EdgeInsets.all(NlSpace.md),
      decoration: BoxDecoration(
        color: error ? NlColors.wrongSoft : NlColors.markerSoft,
        borderRadius: BorderRadius.circular(NlRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: spinning
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(icon, size: 17, color: fg),
              ),
              const SizedBox(width: NlSpace.sm),
              Expanded(
                child: AutoDirText(
                  text,
                  style: NlText.body.copyWith(color: fg),
                ),
              ),
            ],
          ),
          if (action != null)
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: Padding(
                padding: const EdgeInsets.only(top: NlSpace.sm),
                child: action,
              ),
            ),
        ],
      ),
    );
  }
}
