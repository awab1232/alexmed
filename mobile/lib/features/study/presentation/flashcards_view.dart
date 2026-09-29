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

/// Flip-card review over the whole file's cards (the web's
/// components/study/FlashcardsMode): one card at a time, tap to flip,
/// swipe or السابق / التالي to move, rate after flipping (FSRS on the
/// server via `rateCard`), time / remaining / learning / mastered, EN ⇄ ع,
/// explanation and source-page sheets, and an end-of-review summary.
/// Cards that arrive later (generation still running) are appended at the
/// end — the student's place never moves.
class FlashcardsView extends ConsumerStatefulWidget {
  const FlashcardsView({
    super.key,
    required this.content,
    required this.notice,
    required this.title,
  });

  final StudyContent content;
  final Widget notice;
  final String title;

  @override
  ConsumerState<FlashcardsView> createState() => _FlashcardsViewState();
}

class _FlashcardsViewState extends ConsumerState<FlashcardsView> {
  late List<StudyCard> _queue = [...widget.content.cards];
  final _ratings = <String, CardRating>{};
  final _page = PageController();
  int _index = 0;
  bool _flipped = false;
  bool _english = true;
  late DateTime _startedAt = DateTime.now();
  final _elapsed = ValueNotifier(Duration.zero);
  Timer? _ticker;

  bool get _finished => _queue.isNotEmpty && _index >= _queue.length;
  StudyCard? get _card => _finished || _queue.isEmpty ? null : _queue[_index];
  int get _learning => _ratings.values.where((r) => r.learning).length;
  int get _mastered => _ratings.values.where((r) => !r.learning).length;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!_finished) _elapsed.value = DateTime.now().difference(_startedAt);
    });
  }

  @override
  void didUpdateWidget(covariant FlashcardsView old) {
    super.didUpdateWidget(old);
    // New cards (generation finished for more chapters): append, never
    // reorder — the card on screen stays the same.
    final known = {for (final c in _queue) c.id};
    final added = widget.content.cards.where((c) => !known.contains(c.id));
    if (added.isNotEmpty) setState(() => _queue = [..._queue, ...added]);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _elapsed.dispose();
    _page.dispose();
    super.dispose();
  }

  void _goTo(int index) {
    _page.animateToPage(index, duration: NlMotion.normal, curve: NlMotion.ease);
  }

  void _rate(CardRating rating) {
    final card = _card;
    if (card == null) return;
    HapticFeedback.selectionClick();
    // Fire-and-forget, as the web does; a failed save doesn't block review.
    unawaited(
      ref.read(studyRepositoryProvider).rateCard(card.id, rating).catchError((
        Object _,
      ) {
        if (mounted) {
          showNlToast(context, AppLocalizations.of(context).flashRateFailed);
        }
      }),
    );
    setState(() => _ratings[card.id] = rating);
    _goTo(_index + 1);
  }

  void _restart({required bool onlyLearning}) {
    final next = onlyLearning
        ? _queue.where((c) => _ratings[c.id]?.learning ?? false).toList()
        : _queue;
    setState(() {
      _queue = next.isEmpty ? _queue : next;
      _ratings.clear();
      _index = 0;
      _flipped = false;
      _startedAt = DateTime.now();
      _elapsed.value = Duration.zero;
    });
    _page.jumpToPage(0);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final appBar = AppBar(
      toolbarHeight: kToolbarHeight + 8,
      title: StudyTitle(title: widget.title, book: widget.content.title),
    );
    if (_queue.isEmpty) {
      return Scaffold(
        appBar: appBar,
        body: Column(
          children: [
            widget.notice,
            Expanded(
              child: StudyEmpty(
                title: l10n.flashEmpty,
                message: widget.content.isOwner
                    ? l10n.studyEmptyOwner
                    : l10n.flashEmptyShared,
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: appBar,
      body: Column(
        children: [
          widget.notice,
          Padding(
            padding: const EdgeInsets.fromLTRB(
              NlSpace.page,
              NlSpace.md,
              NlSpace.page,
              0,
            ),
            child: _Stats(
              elapsed: _elapsed,
              remaining: math.max(0, _queue.length - _ratings.length),
              learning: _learning,
              mastered: _mastered,
              english: _english,
              onLanguage: () => setState(() => _english = !_english),
              index: _index,
              total: _queue.length,
            ),
          ),
          Expanded(
            child: PageView.builder(
              controller: _page,
              itemCount: _queue.length + 1,
              onPageChanged: (i) => setState(() {
                _index = i;
                _flipped = false;
              }),
              itemBuilder: (context, i) {
                if (i == _queue.length) {
                  return _Finished(
                    count: _queue.length,
                    elapsed: _elapsed.value,
                    learning: _learning,
                    mastered: _mastered,
                    onRestart: _restart,
                  );
                }
                final card = _queue[i];
                return Padding(
                  padding: const EdgeInsets.all(NlSpace.page),
                  child: _FlipCard(
                    card: card,
                    flipped: i == _index && _flipped,
                    english: _english,
                    rating: _ratings[card.id],
                    onFlip: () => setState(() => _flipped = !_flipped),
                    onSource: () => showPageImageSheet(
                      context,
                      bookId: widget.content.bookId,
                      page: card.sourcePage,
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      bottomNavigationBar: _finished
          ? null
          : _Footer(
              flipped: _flipped,
              canBack: _index > 0,
              onRate: _rate,
              onPrevious: () => _goTo(_index - 1),
              onNext: () => _goTo(_index + 1),
              onTranslate: () => setState(() => _english = !_english),
              onExplain: () => _showExplanation(context, _card!),
            ),
    );
  }

  void _showExplanation(BuildContext context, StudyCard card) {
    final l10n = AppLocalizations.of(context);
    showNlSheet<void>(
      context,
      title: l10n.flashExplainTitle,
      builder: (context) => SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            BilingualBlock(
              label: l10n.labelQuestionBi,
              en: card.questionEn,
              ar: card.questionAr,
              strong: true,
            ),
            BilingualBlock(
              label: l10n.labelAnswerBi,
              en: card.answerEn,
              ar: card.answerAr,
            ),
            if (card.relatedTermEn != null || card.relatedTermAr != null)
              BilingualBlock(
                label: l10n.labelTermBi,
                en: card.relatedTermEn ?? '',
                ar: card.relatedTermAr ?? '',
              ),
          ],
        ),
      ),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({
    required this.elapsed,
    required this.remaining,
    required this.learning,
    required this.mastered,
    required this.english,
    required this.onLanguage,
    required this.index,
    required this.total,
  });

  final ValueNotifier<Duration> elapsed;
  final int remaining;
  final int learning;
  final int mastered;
  final bool english;
  final VoidCallback onLanguage;
  final int index;
  final int total;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: ValueListenableBuilder(
                valueListenable: elapsed,
                builder: (_, value, _) => _Stat(
                  icon: LucideIcons.clock3,
                  value: formatElapsed(value),
                  label: l10n.flashTime,
                ),
              ),
            ),
            Expanded(
              child: _Stat(
                icon: LucideIcons.circleHelp,
                value: '$remaining',
                label: l10n.flashRemaining,
                color: NlColors.niroDeep,
              ),
            ),
            Expanded(
              child: _Stat(
                icon: LucideIcons.graduationCap,
                value: '$learning',
                label: l10n.flashLearning,
                color: const Color(0xFFB45309),
              ),
            ),
            Expanded(
              child: _Stat(
                icon: LucideIcons.circleCheck,
                value: '$mastered',
                label: l10n.flashMastered,
                color: NlColors.correct,
              ),
            ),
            Semantics(
              button: true,
              label: l10n.flashLangToggle,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onLanguage,
                child: Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: NlColors.ruleStrong),
                  ),
                  child: Text(
                    english ? 'EN' : 'ع',
                    style: NlText.button.copyWith(fontSize: 14),
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: NlSpace.sm),
        Row(
          children: [
            Text(
              l10n.flashCardOf(math.min(index + 1, total), total),
              style: NlText.caption,
            ),
            const SizedBox(width: NlSpace.md),
            Expanded(
              child: NlProgressBar(value: total == 0 ? 0 : index / total),
            ),
          ],
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.icon,
    required this.value,
    required this.label,
    this.color = NlColors.ink,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      FittedBox(
        fit: BoxFit.scaleDown,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 3),
            Text(
              isolateLtr(value),
              style: NlText.rowLabel.copyWith(fontSize: 15, color: color),
            ),
          ],
        ),
      ),
      Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: NlText.caption.copyWith(fontSize: 11),
      ),
    ],
  );
}

String formatElapsed(Duration d) {
  final minutes = d.inMinutes.toString().padLeft(2, '0');
  final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}

class _FlipCard extends StatelessWidget {
  const _FlipCard({
    required this.card,
    required this.flipped,
    required this.english,
    required this.rating,
    required this.onFlip,
    required this.onSource,
  });

  final StudyCard card;
  final bool flipped;
  final bool english;
  final CardRating? rating;
  final VoidCallback onFlip;
  final VoidCallback onSource;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(end: flipped ? math.pi : 0),
      duration: NlMotion.normal,
      curve: NlMotion.ease,
      builder: (context, angle, _) {
        final back = angle > math.pi / 2;
        return Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.001)
            ..rotateY(angle),
          child: Transform(
            alignment: Alignment.center,
            transform: back
                ? (Matrix4.identity()..rotateY(math.pi))
                : Matrix4.identity(),
            child: _CardFace(
              card: card,
              answer: back,
              english: english,
              rating: rating,
              onTap: onFlip,
              onSource: onSource,
            ),
          ),
        );
      },
    );
  }
}

class _CardFace extends StatelessWidget {
  const _CardFace({
    required this.card,
    required this.answer,
    required this.english,
    required this.rating,
    required this.onTap,
    required this.onSource,
  });

  final StudyCard card;
  final bool answer;
  final bool english;
  final CardRating? rating;
  final VoidCallback onTap;
  final VoidCallback onSource;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = answer
        ? (english ? card.answerEn : card.answerAr)
        : (english ? card.questionEn : card.questionAr);
    final hasTerm = card.relatedTermEn != null || card.relatedTermAr != null;
    return Semantics(
      button: true,
      label: answer ? l10n.flashAnswer : l10n.flashQuestion,
      hint: answer ? l10n.flashTapToQuestion : l10n.flashTapToFlip,
      child: Material(
        color: NlColors.sheet,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NlRadius.lg),
          side: BorderSide(
            color: answer ? NlColors.marker : NlColors.ink,
            width: answer ? 2.5 : 1.5,
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(NlRadius.lg),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(NlSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  runSpacing: NlSpace.xs,
                  children: [
                    Wrap(
                      spacing: NlSpace.sm,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: answer ? NlColors.marker : NlColors.paper,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text(
                            [
                              answer ? l10n.flashAnswer : l10n.flashQuestion,
                              if (!answer && card.cardType != null)
                                card.cardType!,
                            ].join(' · '),
                            style: NlText.caption.copyWith(
                              color: NlColors.ink,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (rating != null) _RatingBadge(rating: rating!),
                      ],
                    ),
                    TextButton.icon(
                      onPressed: onSource,
                      icon: const Icon(LucideIcons.eye, size: 16),
                      label: Text(l10n.flashSource),
                    ),
                  ],
                ),
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      child: Column(
                        children: [
                          Text(
                            text,
                            textAlign: TextAlign.center,
                            textDirection: english
                                ? TextDirection.ltr
                                : TextDirection.rtl,
                            style: (english ? NlText.title : NlText.reading)
                                .copyWith(fontSize: 21, height: 1.5),
                          ),
                          if (answer && hasTerm) ...[
                            const SizedBox(height: NlSpace.md),
                            Text(
                              [
                                ?card.relatedTermEn,
                                ?card.relatedTermAr,
                              ].map(isolate).join(' · '),
                              textAlign: TextAlign.center,
                              style: NlText.caption.copyWith(
                                color: NlColors.niroDeep,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
                Text(
                  answer ? l10n.flashTapToQuestion : l10n.flashTapToFlip,
                  textAlign: TextAlign.center,
                  style: NlText.caption,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RatingBadge extends StatelessWidget {
  const _RatingBadge({required this.rating});
  final CardRating rating;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return NlBadge(rating.learning ? l10n.flashLearning : l10n.flashMastered);
  }
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.flipped,
    required this.canBack,
    required this.onRate,
    required this.onPrevious,
    required this.onNext,
    required this.onTranslate,
    required this.onExplain,
  });

  final bool flipped;
  final bool canBack;
  final ValueChanged<CardRating> onRate;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onTranslate;
  final VoidCallback onExplain;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final forward = Directionality.of(context) == TextDirection.rtl
        ? LucideIcons.chevronLeft
        : LucideIcons.chevronRight;
    final backward = Directionality.of(context) == TextDirection.rtl
        ? LucideIcons.chevronRight
        : LucideIcons.chevronLeft;
    final ratings = [
      (CardRating.again, l10n.rateAgain, NlColors.wrong),
      (CardRating.hard, l10n.rateHard, const Color(0xFFB45309)),
      (CardRating.good, l10n.rateGood, NlColors.niroDeep),
      (CardRating.easy, l10n.rateEasy, NlColors.correct),
    ];
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
          child: flipped
              ? Row(
                  children: [
                    for (final (rating, label, color) in ratings)
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: color,
                              side: BorderSide(color: color),
                              minimumSize: const Size(0, 52),
                              padding: EdgeInsets.zero,
                            ),
                            onPressed: () => onRate(rating),
                            child: Text(
                              label,
                              style: NlText.button.copyWith(
                                fontSize: 14,
                                color: color,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                )
              : Row(
                  children: [
                    _FooterAction(
                      icon: backward,
                      label: l10n.flashPrev,
                      onTap: canBack ? onPrevious : null,
                    ),
                    _FooterAction(
                      icon: LucideIcons.languages,
                      label: l10n.flashTranslate,
                      onTap: onTranslate,
                    ),
                    _FooterAction(
                      icon: LucideIcons.lightbulb,
                      label: l10n.flashExplain,
                      onTap: onExplain,
                    ),
                    _FooterAction(
                      icon: forward,
                      label: l10n.flashNext,
                      onTap: onNext,
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

class _FooterAction extends StatelessWidget {
  const _FooterAction({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = onTap == null ? NlColors.ruleStrong : NlColors.ink2;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(NlRadius.md),
        onTap: onTap,
        child: SizedBox(
          height: 56,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(height: 2),
              Text(
                label,
                style: NlText.caption.copyWith(color: color, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Finished extends StatelessWidget {
  const _Finished({
    required this.count,
    required this.elapsed,
    required this.learning,
    required this.mastered,
    required this.onRestart,
  });

  final int count;
  final Duration elapsed;
  final int learning;
  final int mastered;
  final void Function({required bool onlyLearning}) onRestart;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return StudyResult(
      expression: NiroExpression.victory,
      title: l10n.flashDone,
      body: l10n.flashDoneBody(
        count,
        formatElapsed(elapsed),
        mastered,
        learning,
      ),
      actions: [
        if (learning > 0)
          NlButton(
            label: l10n.flashReviewHard,
            icon: LucideIcons.rotateCcw,
            expand: true,
            onPressed: () => onRestart(onlyLearning: true),
          ),
        NlButton(
          label: l10n.studyRestart,
          kind: NlButtonKind.secondary,
          expand: true,
          onPressed: () => onRestart(onlyLearning: false),
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
