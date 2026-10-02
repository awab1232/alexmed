import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../library/data/library_repository.dart';
import '../../study/data/study_models.dart' show CardRating;
import '../../study/presentation/flashcards_view.dart' show formatElapsed;
import '../../study/presentation/study_widgets.dart';
import '../data/progress_repository.dart';

/// Daily review (the web's /review): every due card from كتبي and مِرآة in
/// one queue, oldest first. Ratings go to the card's own scheduler on the
/// server (FSRS for books — 4 grades; SM-2 for مِرآة — 3 grades).
class ReviewScreen extends ConsumerStatefulWidget {
  const ReviewScreen({super.key});

  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  List<DueCard>? _cards;
  Object? _error;
  bool _revealed = false;
  int _mastered = 0;
  final _elapsed = ValueNotifier(Duration.zero);
  final _clock = Stopwatch()..start();
  Timer? _ticker;
  final _explanations = <String, String>{};
  String? _explaining;

  ProgressRepository get _repo => ref.read(progressRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _load();
    _ticker = Timer.periodic(
      const Duration(seconds: 1),
      (_) => _elapsed.value = _clock.elapsed,
    );
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _elapsed.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final cards = await _repo.due();
      if (mounted) setState(() => _cards = cards);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _rate(DueCard card, CardRating rating) async {
    unawaited(HapticFeedback.selectionClick());
    // The card leaves the queue at once; the server reschedules it.
    setState(() {
      _cards = [..._cards!]..remove(card);
      _revealed = false;
      if (!rating.learning) _mastered++;
    });
    try {
      await _repo.rate(card, rating);
      ref.invalidate(dueCountProvider);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _cards = [card, ..._cards!];
        if (!rating.learning) _mastered--;
      });
      showNlToast(context, apiErrorText(context, error));
    }
  }

  Future<void> _explain(DueCard card) async {
    setState(() => _explaining = card.id);
    try {
      final text = await _repo.explain(card.id);
      if (mounted) setState(() => _explanations[card.id] = text);
    } catch (error) {
      // Out of assistant quota etc. — the reason takes its place, as on the web.
      if (mounted) {
        setState(() => _explanations[card.id] = apiErrorText(context, error));
      }
    } finally {
      if (mounted) setState(() => _explaining = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final cards = _cards;
    if (cards == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.reviewTitle)),
        body: _error == null
            ? const Center(child: CircularProgressIndicator())
            : NlErrorView(error: _error!, onRetry: _load),
      );
    }
    if (cards.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.reviewTitle)),
        body: NlEmptyState(
          title: l10n.reviewEmpty,
          message: l10n.reviewEmptyHint,
          expression: NiroExpression.victory,
        ),
      );
    }
    final card = cards.first;
    final book = card.source == DueSource.book;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.reviewTitle)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          NlSpace.page,
          0,
          NlSpace.page,
          NlSpace.xxxl,
        ),
        children: [
          Text(l10n.reviewLeft(cards.length), style: NlText.title),
          const SizedBox(height: NlSpace.sm),
          Wrap(
            spacing: NlSpace.lg,
            children: [
              ValueListenableBuilder(
                valueListenable: _elapsed,
                builder: (_, value, _) => _Stat(
                  icon: LucideIcons.clock,
                  text: isolateLtr(formatElapsed(value)),
                ),
              ),
              _Stat(
                icon: LucideIcons.layers3,
                text: l10n.reviewRemaining(cards.length),
              ),
              _Stat(
                icon: LucideIcons.trophy,
                text: l10n.reviewMastered(_mastered),
                color: NlColors.correct,
              ),
            ],
          ),
          const SizedBox(height: NlSpace.lg),
          Container(
            padding: const EdgeInsets.all(NlSpace.lg),
            decoration: BoxDecoration(
              color: NlColors.sheet,
              borderRadius: BorderRadius.circular(NlRadius.lg),
              border: Border.all(color: NlColors.ink, width: 1.5),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        [
                          isolate(card.tag),
                          if (card.sourcePage != null)
                            l10n.quizPage(card.sourcePage!),
                        ].join(' · '),
                        style: NlText.caption,
                      ),
                    ),
                    if (book && card.bookId != null && card.sourcePage != null)
                      TextButton.icon(
                        onPressed: () => openSourcePage(
                          context,
                          bookId: card.bookId!,
                          page: card.sourcePage!,
                        ),
                        icon: const Icon(LucideIcons.bookOpen, size: 15),
                        label: Text(l10n.reviewViewInBook),
                      ),
                  ],
                ),
                const SizedBox(height: NlSpace.md),
                BilingualBlock(
                  label: l10n.labelQuestionBi,
                  en: card.questionEn,
                  ar: card.questionAr,
                  strong: true,
                ),
                if (!_revealed)
                  NlButton(
                    label: l10n.reviewShowAnswer,
                    kind: NlButtonKind.marker,
                    expand: true,
                    onPressed: () => setState(() => _revealed = true),
                  )
                else ...[
                  BilingualBlock(
                    label: l10n.labelAnswerBi,
                    en: card.answerEn,
                    ar: card.answerAr,
                  ),
                  if (card.relatedTermEn != null)
                    Text(
                      '${l10n.reviewRelatedTerm}: ${isolateLtr(card.relatedTermEn!)}',
                      style: NlText.caption,
                    ),
                  if (book) ...[
                    const SizedBox(height: NlSpace.md),
                    if (_explanations[card.id] case final text?)
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
                              '✨ ${l10n.reviewSimpler}',
                              style: NlText.label.copyWith(
                                color: NlColors.niroDeep,
                              ),
                            ),
                            const SizedBox(height: 4),
                            AutoDirText(text, style: NlText.reading),
                          ],
                        ),
                      )
                    else
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: NlButton(
                          label: l10n.reviewExplain,
                          icon: LucideIcons.sparkles,
                          kind: NlButtonKind.ghost,
                          loading: _explaining == card.id,
                          onPressed: _explaining != null
                              ? null
                              : () => _explain(card),
                        ),
                      ),
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: !_revealed
          ? null
          : _Ratings(book: book, onRate: (rating) => _rate(card, rating)),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.text, this.color});

  final IconData icon;
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 14, color: color ?? NlColors.ink3),
      const SizedBox(width: 4),
      Text(text, style: NlText.caption.copyWith(color: color)),
    ],
  );
}

class _Ratings extends StatelessWidget {
  const _Ratings({required this.book, required this.onRate});

  final bool book;
  final ValueChanged<CardRating> onRate;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final ratings = [
      if (book) (CardRating.again, l10n.rateAgain, NlColors.wrong),
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
          child: Row(
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
          ),
        ),
      ),
    );
  }
}
