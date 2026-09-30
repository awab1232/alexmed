import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/study_models.dart';
import '../data/study_repository.dart';
import 'study_screen.dart';
import 'study_widgets.dart';

const _letters = ['A', 'B', 'C', 'D', 'E', 'F'];

/// One question at a time over the whole file's MCQs (the web's
/// components/study/QuizMode): numbered dots (✓ / ✗ once answered), running
/// score, lettered choices. The answer is checked and recorded by the
/// server (`submitMcqAttempt`) — stats and weak points keep working.
/// تلميح removes one wrong choice (down to two), as on the web.
class QuizView extends ConsumerStatefulWidget {
  const QuizView({
    super.key,
    required this.content,
    required this.notice,
    required this.title,
    this.random,
  });

  final StudyContent content;
  final Widget notice;
  final String title;

  /// For tests: which wrong choice تلميح removes.
  final math.Random? random;

  @override
  ConsumerState<QuizView> createState() => _QuizViewState();
}

class _QuizViewState extends ConsumerState<QuizView> {
  late List<StudyMcq> _mcqs = [...widget.content.mcqs];
  final _answers = <String, (int selected, McqResult result)>{};
  final _eliminated = <String, List<int>>{};
  final _page = PageController();
  final _dots = ScrollController();
  late final _random = widget.random ?? math.Random();
  int _index = 0;
  int? _pending;
  bool _saveFailed = false;

  bool get _finished => _mcqs.isNotEmpty && _index >= _mcqs.length;
  int get _score => _answers.values.where((a) => a.$2.isCorrect).length;

  @override
  void didUpdateWidget(covariant QuizView old) {
    super.didUpdateWidget(old);
    final known = {for (final q in _mcqs) q.id};
    final added = widget.content.mcqs.where((q) => !known.contains(q.id));
    if (added.isNotEmpty) setState(() => _mcqs = [..._mcqs, ...added]);
  }

  @override
  void dispose() {
    _page.dispose();
    _dots.dispose();
    super.dispose();
  }

  void _goTo(int index) {
    _page.animateToPage(index, duration: NlMotion.normal, curve: NlMotion.ease);
  }

  void _onPage(int index) {
    setState(() {
      _index = index;
      _saveFailed = false;
    });
    // Keep the current dot in view.
    if (_dots.hasClients) {
      final target = (index * 44.0) - 120;
      _dots.animateTo(
        target.clamp(0.0, _dots.position.maxScrollExtent),
        duration: NlMotion.normal,
        curve: NlMotion.ease,
      );
    }
  }

  Future<void> _choose(StudyMcq mcq, int choice) async {
    if (_answers.containsKey(mcq.id) || _pending != null) return;
    setState(() {
      _pending = choice;
      _saveFailed = false;
    });
    try {
      final result = await ref
          .read(studyRepositoryProvider)
          .submitMcq(mcq.id, choice);
      unawaited(HapticFeedback.lightImpact());
      if (mounted) setState(() => _answers[mcq.id] = (choice, result));
    } catch (_) {
      if (mounted) setState(() => _saveFailed = true);
    } finally {
      if (mounted) setState(() => _pending = null);
    }
  }

  void _hint(StudyMcq mcq) {
    if (_answers.containsKey(mcq.id)) return;
    final removed = _eliminated[mcq.id] ?? const <int>[];
    if (mcq.choices.length - removed.length <= 2) return;
    final candidates = [
      for (var i = 0; i < mcq.choices.length; i++)
        if (i != mcq.correctIndex && !removed.contains(i)) i,
    ];
    if (candidates.isEmpty) return;
    final pick = candidates[_random.nextInt(candidates.length)];
    setState(() => _eliminated[mcq.id] = [...removed, pick]);
  }

  void _restart({required bool onlyWrong}) {
    var start = 0;
    setState(() {
      if (onlyWrong) {
        start = _mcqs.indexWhere(
          (q) => _answers[q.id] != null && !_answers[q.id]!.$2.isCorrect,
        );
        _answers.removeWhere((_, a) => !a.$2.isCorrect);
      } else {
        _answers.clear();
      }
      _eliminated.clear();
    });
    _page.jumpToPage(math.max(0, start));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final appBar = AppBar(
      toolbarHeight: kToolbarHeight + 8,
      title: StudyTitle(title: widget.title, book: widget.content.title),
    );
    if (_mcqs.isEmpty) {
      return Scaffold(
        appBar: appBar,
        body: Column(
          children: [
            widget.notice,
            Expanded(
              child: StudyEmpty(
                title: l10n.quizEmpty,
                message: widget.content.isOwner
                    ? l10n.studyEmptyOwner
                    : l10n.quizEmptyShared,
              ),
            ),
          ],
        ),
      );
    }

    final mcq = _finished ? null : _mcqs[_index];
    final answered = mcq == null ? null : _answers[mcq.id];
    final removed = mcq == null
        ? const <int>[]
        : _eliminated[mcq.id] ?? const <int>[];
    return Scaffold(
      appBar: appBar,
      body: Column(
        children: [
          widget.notice,
          SizedBox(
            height: 56,
            child: ListView.builder(
              controller: _dots,
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: NlSpace.page,
                vertical: NlSpace.sm,
              ),
              itemCount: _mcqs.length,
              itemBuilder: (context, i) => _Dot(
                number: i + 1,
                current: i == _index,
                result: _answers[_mcqs[i].id]?.$2.isCorrect,
                onTap: () => _goTo(i),
              ),
            ),
          ),
          Expanded(
            child: PageView.builder(
              controller: _page,
              itemCount: _mcqs.length + 1,
              onPageChanged: _onPage,
              itemBuilder: (context, i) {
                if (i == _mcqs.length) return _result(l10n);
                final q = _mcqs[i];
                return _Question(
                  mcq: q,
                  index: i,
                  total: _mcqs.length,
                  score: _score,
                  answer: _answers[q.id],
                  removed: _eliminated[q.id] ?? const [],
                  pending: i == _index ? _pending : null,
                  saveFailed: i == _index && _saveFailed,
                  onChoose: (choice) => _choose(q, choice),
                  onSource: () => showPageImageSheet(
                    context,
                    bookId: widget.content.bookId,
                    page: q.sourcePage,
                  ),
                );
              },
            ),
          ),
        ],
      ),
      bottomNavigationBar: mcq == null
          ? null
          : _QuizFooter(
              canBack: _index > 0,
              canHint:
                  answered == null && mcq.choices.length - removed.length > 2,
              answered: answered != null,
              onPrevious: () => _goTo(_index - 1),
              onHint: () => _hint(mcq),
              onNext: () => _goTo(_index + 1),
            ),
    );
  }

  Widget _result(AppLocalizations l10n) {
    final answered = _answers.length;
    final total = _mcqs.length;
    return StudyResult(
      expression: _score == total
          ? NiroExpression.victory
          : NiroExpression.challenge,
      title: l10n.quizResult(_score, total),
      body: answered < total
          ? l10n.quizAnsweredSome(answered, total)
          : _score == total
          ? l10n.quizAllCorrect
          : l10n.quizReviewWrong,
      actions: [
        if (_score < answered)
          NlButton(
            label: l10n.quizRetryWrong,
            icon: LucideIcons.rotateCcw,
            expand: true,
            onPressed: () => _restart(onlyWrong: true),
          ),
        NlButton(
          label: l10n.studyRestart,
          kind: NlButtonKind.secondary,
          expand: true,
          onPressed: () => _restart(onlyWrong: false),
        ),
        NlButton(
          label: l10n.studyBack,
          kind: NlButtonKind.ghost,
          expand: true,
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({
    required this.number,
    required this.current,
    required this.result,
    required this.onTap,
  });

  final int number;
  final bool current;

  /// null = not answered.
  final bool? result;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final (Color bg, Color fg) = switch (result) {
      true => (NlColors.correct, Colors.white),
      false => (NlColors.wrong, Colors.white),
      null =>
        current
            ? (NlColors.ink, Colors.white)
            : (NlColors.sheet, NlColors.ink2),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: Semantics(
        button: true,
        selected: current,
        label: l10n.quizDot(number),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: bg,
              shape: BoxShape.circle,
              border: Border.all(
                color: current ? NlColors.marker : NlColors.rule,
                width: current ? 3 : 1,
              ),
            ),
            child: result == null
                ? Text(
                    '$number',
                    style: NlText.caption.copyWith(
                      color: fg,
                      fontWeight: FontWeight.w700,
                    ),
                  )
                : Icon(
                    result! ? LucideIcons.check : LucideIcons.x,
                    size: 16,
                    color: fg,
                  ),
          ),
        ),
      ),
    );
  }
}

class _Question extends StatelessWidget {
  const _Question({
    required this.mcq,
    required this.index,
    required this.total,
    required this.score,
    required this.answer,
    required this.removed,
    required this.pending,
    required this.saveFailed,
    required this.onChoose,
    required this.onSource,
  });

  final StudyMcq mcq;
  final int index;
  final int total;
  final int score;
  final (int, McqResult)? answer;
  final List<int> removed;
  final int? pending;
  final bool saveFailed;
  final ValueChanged<int> onChoose;
  final VoidCallback onSource;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final answer = this.answer;
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        NlSpace.page,
        NlSpace.sm,
        NlSpace.page,
        NlSpace.xl,
      ),
      children: [
        Row(
          children: [
            Expanded(
              child: Wrap(
                spacing: NlSpace.sm,
                runSpacing: NlSpace.xs,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  if (mcq.questionType != null) NlBadge(mcq.questionType!),
                  Text(
                    l10n.quizQuestionOf(index + 1, total),
                    style: NlText.caption,
                  ),
                  InkWell(
                    onTap: onSource,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Text(
                        l10n.quizPage(mcq.sourcePage),
                        style: NlText.caption.copyWith(
                          color: NlColors.niroDeep,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(LucideIcons.star, size: 15, color: Color(0xFFB45309)),
            const SizedBox(width: 4),
            Text(l10n.quizScore(score), style: NlText.rowLabel),
          ],
        ),
        if (mcq.flagged) ...[
          const SizedBox(height: NlSpace.sm),
          Container(
            padding: const EdgeInsets.all(NlSpace.sm),
            decoration: BoxDecoration(
              color: NlColors.markerSoft,
              borderRadius: BorderRadius.circular(NlRadius.sm),
            ),
            child: Text(
              [
                l10n.quizFlagged,
                if (mcq.validationNote != null) mcq.validationNote!,
              ].join(': '),
              style: NlText.caption.copyWith(color: NlColors.ink),
            ),
          ),
        ],
        const SizedBox(height: NlSpace.lg),
        Text(
          mcq.questionEn,
          textDirection: TextDirection.ltr,
          style: NlText.title.copyWith(fontSize: 19, height: 1.45),
        ),
        const SizedBox(height: NlSpace.lg),
        for (var i = 0; i < mcq.choices.length; i++) ...[
          McqChoice(
            letter: i < _letters.length ? _letters[i] : '${i + 1}',
            text: mcq.choices[i],
            state: answer == null
                ? (pending == i ? McqChoiceState.pending : McqChoiceState.idle)
                : i == answer.$2.correctIndex
                ? McqChoiceState.correct
                : i == answer.$1
                ? McqChoiceState.wrong
                : McqChoiceState.dim,
            removed: removed.contains(i),
            onTap: answer == null && pending == null && !removed.contains(i)
                ? () => onChoose(i)
                : null,
          ),
          const SizedBox(height: NlSpace.sm),
        ],
        if (saveFailed)
          Text(
            l10n.quizSaveFailed,
            style: NlText.secondary.copyWith(color: NlColors.wrong),
          ),
        if (answer != null) ...[
          const SizedBox(height: NlSpace.sm),
          Container(
            padding: const EdgeInsets.all(NlSpace.md),
            decoration: BoxDecoration(
              color: answer.$2.isCorrect
                  ? NlColors.correctSoft
                  : NlColors.wrongSoft,
              borderRadius: BorderRadius.circular(NlRadius.md),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  answer.$2.isCorrect ? l10n.quizCorrect : l10n.quizWrong,
                  style: NlText.rowLabel.copyWith(
                    color: answer.$2.isCorrect
                        ? NlColors.correct
                        : NlColors.wrong,
                  ),
                ),
                if (answer.$2.explanationEn.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    answer.$2.explanationEn,
                    textDirection: TextDirection.ltr,
                    style: NlText.body,
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _QuizFooter extends StatelessWidget {
  const _QuizFooter({
    required this.canBack,
    required this.canHint,
    required this.answered,
    required this.onPrevious,
    required this.onHint,
    required this.onNext,
  });

  final bool canBack;
  final bool canHint;
  final bool answered;
  final VoidCallback onPrevious;
  final VoidCallback onHint;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final rtl = Directionality.of(context) == TextDirection.rtl;
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
          // Each button scales down instead of overflowing on narrow
          // phones / large text.
          child: Row(
            children: [
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: NlButton(
                    label: l10n.flashPrev,
                    icon: rtl
                        ? LucideIcons.chevronRight
                        : LucideIcons.chevronLeft,
                    kind: NlButtonKind.ghost,
                    onPressed: canBack ? onPrevious : null,
                  ),
                ),
              ),
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: NlButton(
                    label: l10n.quizHint,
                    icon: LucideIcons.lightbulb,
                    kind: NlButtonKind.ghost,
                    onPressed: canHint ? onHint : null,
                  ),
                ),
              ),
              const Spacer(),
              NlButton(
                label: answered ? l10n.flashNext : l10n.quizSkip,
                icon: answered ? null : LucideIcons.skipForward,
                kind: answered ? NlButtonKind.marker : NlButtonKind.secondary,
                onPressed: onNext,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
