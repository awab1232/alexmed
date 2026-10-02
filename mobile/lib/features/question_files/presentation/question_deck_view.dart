import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_image.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/question_file_models.dart';
import '../domain/question_rules.dart';

/// The question cards (blueprint §11) — the web's QuestionList, shared by a
/// student's own question file, a doctor's protected set (student view,
/// with [watermark]) and the doctor's preview ([revealAll], list layout).
///
/// One question at a time: «السؤال X من N», a progress bar and the running
/// tally; swipe, السابق / التالي, the hardware arrow keys, or the picker
/// sheet (✓ / ✗ per answered question). Each question keeps its answer
/// while the student moves around — [answers] lives with the caller.
class QuestionDeckView extends StatefulWidget {
  const QuestionDeckView({
    super.key,
    required this.questions,
    required this.answers,
    required this.onAnswer,
    this.watermark,
    this.imagesCached = true,
    this.initialIndex = 0,
    this.onIndexChanged,
  });

  final List<QuestionItem> questions;
  final Map<String, CardAnswer> answers;
  final void Function(String questionId, CardAnswer answer) onAnswer;

  /// Protected sets: the viewer's identity tiled faintly over each card.
  final String? watermark;

  /// false for protected sets — images kept only while shown.
  final bool imagesCached;
  final int initialIndex;
  final ValueChanged<int>? onIndexChanged;

  @override
  State<QuestionDeckView> createState() => _QuestionDeckViewState();
}

class _QuestionDeckViewState extends State<QuestionDeckView> {
  late int _index = widget.initialIndex.clamp(
    0,
    math.max(0, widget.questions.length - 1),
  );
  late final PageController _pages = PageController(initialPage: _index);
  final _focus = FocusNode();

  @override
  void dispose() {
    _pages.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant QuestionDeckView oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Questions may be added while the file is still being processed — the
    // student's place never moves.
    final last = math.max(0, widget.questions.length - 1);
    if (_index > last) _go(last, animate: false);
  }

  void _go(int index, {bool animate = true}) {
    final total = widget.questions.length;
    if (total == 0) return;
    final next = index.clamp(0, total - 1);
    if (!_pages.hasClients) {
      setState(() => _index = next);
      return;
    }
    final reduce = MediaQuery.of(context).disableAnimations;
    if (animate && !reduce && (next - _index).abs() == 1) {
      _pages.animateToPage(
        next,
        duration: NlMotion.normal,
        curve: NlMotion.ease,
      );
    } else {
      _pages.jumpToPage(next);
    }
  }

  Future<void> _openPicker() async {
    final l10n = AppLocalizations.of(context);
    final picked = await showNlSheet<int>(
      context,
      title: l10n.questionsPickerTitle,
      builder: (context) => _QuestionPicker(
        questions: widget.questions,
        answers: widget.answers,
        current: _index,
      ),
    );
    if (picked != null && mounted) _go(picked, animate: false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final total = widget.questions.length;
    if (total == 0) return const SizedBox.shrink();
    final progress = deckProgress(widget.questions, widget.answers);
    final rtl = Directionality.of(context) == TextDirection.rtl;

    return Shortcuts(
      shortcuts: {
        // RTL: ← is "next" (the web's keys).
        const SingleActivator(LogicalKeyboardKey.arrowLeft): _StepIntent(
          rtl ? 1 : -1,
        ),
        const SingleActivator(LogicalKeyboardKey.arrowRight): _StepIntent(
          rtl ? -1 : 1,
        ),
      },
      child: Actions(
        actions: {
          _StepIntent: CallbackAction<_StepIntent>(
            onInvoke: (intent) => _go(_index + intent.step),
          ),
        },
        child: Focus(
          focusNode: _focus,
          autofocus: true,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  NlSpace.page,
                  NlSpace.sm,
                  NlSpace.page,
                  NlSpace.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      children: [
                        Text(
                          l10n.questionsPosition(_index + 1, total),
                          style: NlText.rowLabel.copyWith(fontSize: 14),
                        ),
                        if (progress.answered > 0)
                          Text(
                            l10n.questionsTally(
                              progress.answered,
                              progress.correct,
                            ),
                            style: NlText.caption,
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    NlProgressBar(
                      value: (_index + 1) / total,
                      semanticsLabel: l10n.questionsProgressLabel,
                    ),
                  ],
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _pages,
                  itemCount: total,
                  onPageChanged: (i) {
                    setState(() => _index = i);
                    widget.onIndexChanged?.call(i);
                  },
                  itemBuilder: (context, i) {
                    final q = widget.questions[i];
                    return SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(
                        NlSpace.page,
                        NlSpace.sm,
                        NlSpace.page,
                        NlSpace.xl,
                      ),
                      child: QuestionCard(
                        key: ValueKey(q.id),
                        question: q,
                        position: i + 1,
                        total: total,
                        answer: widget.answers[q.id] ?? CardAnswer.empty,
                        onAnswer: (a) => widget.onAnswer(q.id, a),
                        watermark: widget.watermark,
                        imagesCached: widget.imagesCached,
                      ),
                    );
                  },
                ),
              ),
              _DeckNav(
                index: _index,
                total: total,
                onPrevious: () => _go(_index - 1),
                onNext: () => _go(_index + 1),
                onPick: _openPicker,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepIntent extends Intent {
  const _StepIntent(this.step);
  final int step;
}

class _DeckNav extends StatelessWidget {
  const _DeckNav({
    required this.index,
    required this.total,
    required this.onPrevious,
    required this.onNext,
    required this.onPick,
  });

  final int index;
  final int total;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onPick;

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
            horizontal: NlSpace.md,
            vertical: NlSpace.sm,
          ),
          child: Row(
            children: [
              Expanded(
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: NlButton(
                    label: l10n.flashPrev,
                    kind: NlButtonKind.ghost,
                    icon: Directionality.of(context) == TextDirection.rtl
                        ? LucideIcons.chevronRight
                        : LucideIcons.chevronLeft,
                    onPressed: index == 0 ? null : onPrevious,
                  ),
                ),
              ),
              Semantics(
                button: true,
                label: l10n.questionsPickerTitle,
                child: InkWell(
                  key: const ValueKey('question-picker'),
                  borderRadius: BorderRadius.circular(99),
                  onTap: onPick,
                  child: Container(
                    constraints: const BoxConstraints(
                      minHeight: nlMinTouch,
                      minWidth: 72,
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: NlSpace.md),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(99),
                      border: Border.all(color: NlColors.ruleStrong),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          isolateLtr('${index + 1} / $total'),
                          style: NlText.rowLabel.copyWith(fontSize: 14),
                        ),
                        const SizedBox(width: 4),
                        const Icon(
                          LucideIcons.chevronDown,
                          size: 16,
                          color: NlColors.ink2,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: NlButton(
                    label: l10n.flashNext,
                    kind: NlButtonKind.primary,
                    onPressed: index >= total - 1 ? null : onNext,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuestionPicker extends StatelessWidget {
  const _QuestionPicker({
    required this.questions,
    required this.answers,
    required this.current,
  });

  final List<QuestionItem> questions;
  final Map<String, CardAnswer> answers;
  final int current;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 64,
        mainAxisSpacing: NlSpace.sm,
        crossAxisSpacing: NlSpace.sm,
      ),
      itemCount: questions.length,
      itemBuilder: (context, i) {
        final mark = answerMark(questions[i], answers[questions[i].id]);
        final (bg, border) = switch (mark) {
          true => (NlColors.correctSoft, NlColors.correct),
          false => (NlColors.wrongSoft, NlColors.wrong),
          null => (NlColors.sheet, NlColors.ruleStrong),
        };
        return Semantics(
          selected: i == current,
          button: true,
          child: Material(
            color: bg,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(NlRadius.md),
              side: BorderSide(
                color: i == current ? NlColors.ink : border,
                width: i == current ? 2 : 1,
              ),
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(NlRadius.md),
              onTap: () => Navigator.of(context).pop(i),
              child: Center(
                child: Text(
                  '${i + 1}${mark == null ? '' : (mark ? ' ✓' : ' ✗')}',
                  style: NlText.rowLabel.copyWith(fontSize: 14),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// One question card — the web's QuestionCard. Tap an option to answer:
/// right turns green; a wrong pick turns red and the right one green (with
/// a haptic). «أظهر الإجابة» reveals without choosing; «إعادة» clears. The
/// Arabic version sits behind «عرض الترجمة» (labelled «ترجمة آلية» when
/// the pipeline translated it). An AI-suggested answer is always labelled.
class QuestionCard extends StatefulWidget {
  const QuestionCard({
    super.key,
    required this.question,
    required this.position,
    required this.total,
    required this.answer,
    required this.onAnswer,
    this.watermark,
    this.revealAll = false,
    this.imagesCached = true,
  });

  final QuestionItem question;
  final int position;
  final int total;
  final CardAnswer answer;
  final ValueChanged<CardAnswer> onAnswer;
  final String? watermark;

  /// The doctor's review: every answer shown.
  final bool revealAll;
  final bool imagesCached;

  @override
  State<QuestionCard> createState() => _QuestionCardState();
}

class _QuestionCardState extends State<QuestionCard> {
  bool _translation = false;

  void _choose(int i, int? correct) {
    if (i == correct) {
      HapticFeedback.lightImpact();
    } else if (correct != null) {
      HapticFeedback.heavyImpact();
    } else {
      HapticFeedback.selectionClick();
    }
    widget.onAnswer(CardAnswer(selected: i, revealed: true));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final q = widget.question;
    final selected = widget.answer.selected;
    final revealed = widget.revealAll || widget.answer.revealed;
    final (:index, :fromAi) = correctAnswerOf(q);
    final correct = index;
    final options = q.options ?? const <String>[];
    final right = selected != null && selected == correct;

    final card = Container(
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.lg),
        border: Border.all(color: NlColors.rule),
      ),
      padding: const EdgeInsets.all(NlSpace.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  isolateLtr('QUESTION / ${l10n.questionsLabel}'),
                  style: NlText.label.copyWith(color: NlColors.ink3),
                ),
              ),
              Text(
                isolateLtr('${widget.position} / ${widget.total}'),
                style: NlText.caption,
              ),
            ],
          ),
          const SizedBox(height: NlSpace.md),
          if (q.imageUrl != null) ...[
            ApiImage(url: q.imageUrl!, cache: widget.imagesCached),
            const SizedBox(height: NlSpace.lg),
          ],
          AutoDirText(
            q.questionText,
            style: NlText.rowLabel.copyWith(fontSize: 17, height: 1.6),
          ),
          if (options.isNotEmpty) ...[
            const SizedBox(height: NlSpace.lg),
            for (var i = 0; i < options.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: NlSpace.sm),
                child: QuestionOptionTile(
                  number: i + 1,
                  text: options[i],
                  state: optionState(
                    i,
                    selected: selected,
                    revealed: revealed,
                    correct: correct,
                  ),
                  onTap: revealed ? null : () => _choose(i, correct),
                ),
              ),
          ],
          if (revealed) ...[
            const SizedBox(height: NlSpace.sm),
            _Explanation(
              question: q,
              result: selected != null && correct != null
                  ? (right ? l10n.cardCorrect : l10n.cardWrong)
                  : null,
              right: right,
              noAnswer: correct == null,
              fromAi: fromAi,
              hasOptions: options.isNotEmpty,
            ),
          ],
          if (_translation && q.hasTranslation) ...[
            const SizedBox(height: NlSpace.md),
            _Translation(question: q),
          ],
          if (!widget.revealAll || q.hasTranslation) ...[
            const SizedBox(height: NlSpace.sm),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (!revealed)
                  NlButton(
                    label: l10n.questionsReveal,
                    kind: NlButtonKind.ghost,
                    icon: LucideIcons.eye,
                    onPressed: () => widget.onAnswer(
                      CardAnswer(selected: selected, revealed: true),
                    ),
                  )
                else if (widget.answer.revealed && !widget.revealAll)
                  NlButton(
                    label: l10n.questionsReset,
                    kind: NlButtonKind.ghost,
                    icon: LucideIcons.rotateCcw,
                    onPressed: () => widget.onAnswer(CardAnswer.empty),
                  ),
                if (q.hasTranslation)
                  NlButton(
                    label: _translation
                        ? l10n.cardHideTranslation
                        : l10n.cardShowTranslation,
                    kind: NlButtonKind.ghost,
                    icon: LucideIcons.languages,
                    onPressed: () =>
                        setState(() => _translation = !_translation),
                  ),
              ],
            ),
          ],
        ],
      ),
    );

    return Semantics(
      label: l10n.questionsCardLabel(widget.position, widget.total),
      container: true,
      child: widget.watermark == null
          ? card
          : Stack(
              children: [
                card,
                Positioned.fill(
                  child: IgnorePointer(
                    child: ExcludeSemantics(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(NlRadius.lg),
                        child: CustomPaint(
                          key: const ValueKey('question-watermark'),
                          painter: WatermarkPainter(widget.watermark!),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

/// The web's watermarkTile: the viewer's identity at a diagonal, in ink at
/// ~9% opacity, tiled over the card (image included). It makes a
/// screenshot traceable to the account; it cannot stop one being taken.
class WatermarkPainter extends CustomPainter {
  WatermarkPainter(this.text);

  final String text;

  @override
  void paint(Canvas canvas, Size size) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          fontFamily: NlFonts.ui,
          fontSize: 13,
          color: NlColors.ink.withValues(alpha: 0.09),
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    const tileW = 260.0;
    const tileH = 150.0;
    for (var y = 0.0; y < size.height + tileH; y += tileH) {
      for (var x = 0.0; x < size.width + tileW; x += tileW) {
        canvas
          ..save()
          ..translate(x + tileW / 2, y + tileH / 2)
          ..rotate(-24 * math.pi / 180);
        painter.paint(canvas, Offset(-painter.width / 2, -painter.height / 2));
        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(covariant WatermarkPainter old) => old.text != text;
}

class QuestionOptionTile extends StatelessWidget {
  const QuestionOptionTile({
    super.key,
    required this.number,
    required this.text,
    required this.state,
    required this.onTap,
  });

  final int number;
  final String text;
  final OptionState state;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (bg, border, fg) = switch (state) {
      OptionState.correct => (
        NlColors.correctSoft,
        NlColors.correct,
        NlColors.ink,
      ),
      OptionState.wrong => (NlColors.wrongSoft, NlColors.wrong, NlColors.ink),
      OptionState.chosen => (NlColors.niroSoft, NlColors.niro, NlColors.ink),
      OptionState.dimmed => (NlColors.sheet, NlColors.rule, NlColors.ink3),
      OptionState.idle => (NlColors.sheet, NlColors.ruleStrong, NlColors.ink),
    };
    final direction = contentDirection(text) ?? TextDirection.ltr;
    return Semantics(
      button: onTap != null,
      selected: state == OptionState.chosen || state == OptionState.wrong,
      child: AnimatedContainer(
        duration: MediaQuery.of(context).disableAnimations
            ? Duration.zero
            : NlMotion.fast,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(NlRadius.md),
          border: Border.all(
            color: border,
            width: state == OptionState.idle ? 1 : 2,
          ),
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: BorderRadius.circular(NlRadius.md),
            onTap: onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: nlMinTouch),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: NlSpace.md,
                  vertical: 10,
                ),
                child: Directionality(
                  textDirection: direction,
                  child: Row(
                    children: [
                      Text(
                        '$number.',
                        style: NlText.rowLabel.copyWith(
                          color: NlColors.ink3,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(width: NlSpace.sm),
                      Expanded(
                        child: Text(
                          text,
                          style: NlText.body.copyWith(color: fg, height: 1.5),
                        ),
                      ),
                      if (state == OptionState.correct)
                        const Icon(
                          LucideIcons.circleCheck,
                          color: NlColors.correct,
                          size: 20,
                        ),
                      if (state == OptionState.wrong)
                        const Icon(
                          LucideIcons.circleX,
                          color: NlColors.wrong,
                          size: 20,
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Explanation extends StatelessWidget {
  const _Explanation({
    required this.question,
    required this.result,
    required this.right,
    required this.noAnswer,
    required this.fromAi,
    required this.hasOptions,
  });

  final QuestionItem question;
  final String? result;
  final bool right;
  final bool noAnswer;
  final bool fromAi;
  final bool hasOptions;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final q = question;
    final explanation = q.explanationText ?? '';
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(NlSpace.lg),
        decoration: BoxDecoration(
          color: NlColors.paper,
          borderRadius: BorderRadius.circular(NlRadius.md),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (result != null)
              Text(
                result!,
                style: NlText.title.copyWith(
                  color: right ? NlColors.correct : NlColors.wrong,
                  fontSize: 16,
                ),
              ),
            if (noAnswer)
              AutoDirText(
                hasOptions
                    ? l10n.questionsNoAnswerInFile
                    : (explanation.isNotEmpty
                          ? explanation
                          : l10n.questionsNoAnswer),
                style: NlText.secondary,
              )
            else if (fromAi)
              Padding(
                padding: const EdgeInsets.only(top: NlSpace.xs),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 3),
                      child: Icon(
                        LucideIcons.sparkles,
                        size: 13,
                        color: NlColors.niroDeep,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        l10n.questionsAiAnswer,
                        style: NlText.caption.copyWith(
                          color: NlColors.niroDeep,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (explanation.isNotEmpty && hasOptions) ...[
              const SizedBox(height: NlSpace.sm),
              AutoDirText(
                explanation,
                style: NlText.body.copyWith(height: 1.6),
              ),
            ],
            if ((q.aiExplanationAr ?? '').isNotEmpty) ...[
              const SizedBox(height: NlSpace.sm),
              Directionality(
                textDirection: TextDirection.rtl,
                child: Text(
                  q.aiExplanationAr!,
                  style: NlText.reading.copyWith(fontSize: 16),
                ),
              ),
            ],
            if (q.keywords?.isNotEmpty ?? false) ...[
              const SizedBox(height: NlSpace.md),
              Wrap(
                spacing: NlSpace.sm,
                runSpacing: NlSpace.sm,
                children: [
                  for (final word in q.keywords!)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: NlColors.markerSoft,
                        borderRadius: BorderRadius.circular(NlRadius.sm),
                        border: Border.all(color: NlColors.marker),
                      ),
                      child: AutoDirText(
                        word,
                        style: NlText.body.copyWith(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Translation extends StatelessWidget {
  const _Translation({required this.question});

  final QuestionItem question;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final style = NlText.reading.copyWith(fontSize: 16);
    final options = question.optionsAr ?? const <String>[];
    return Container(
      padding: const EdgeInsets.all(NlSpace.lg),
      decoration: BoxDecoration(
        color: NlColors.niroSoft,
        borderRadius: BorderRadius.circular(NlRadius.md),
      ),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (question.translationSource == 'machine')
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: NlSpace.sm),
                  child: NlBadge(l10n.questionsMachineTranslation),
                ),
              ),
            Text(question.questionTextAr!, style: style),
            if (options.isNotEmpty) const SizedBox(height: NlSpace.sm),
            for (var i = 0; i < options.length; i++)
              Text('${arabicNumber(i + 1)}. ${options[i]}', style: style),
          ],
        ),
      ),
    );
  }
}
