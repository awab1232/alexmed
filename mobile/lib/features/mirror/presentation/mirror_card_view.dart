import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/mirror_models.dart';
import '../domain/card_question.dart';

enum _OptionState { idle, correct, wrong, chosen, dimmed }

/// A مِرآة card — same behaviour as the web's MirrorQuestionCard: the
/// question's options are tappable (right = green; a wrong pick turns red
/// and the right one green), "اظهر الإجابة والشرح" reveals everything
/// without choosing, the Arabic sits behind "عرض الترجمة". A question that
/// can't be split into options is shown whole.
class MirrorCardView extends StatefulWidget {
  const MirrorCardView({super.key, required this.card, required this.origin});

  final MirrorCard card;

  /// "صفحة 12", or the section's name for pasted text.
  final String origin;

  @override
  State<MirrorCardView> createState() => _MirrorCardViewState();
}

class _MirrorCardViewState extends State<MirrorCardView> {
  int? _selected;
  bool _revealed = false;
  bool _translation = false;

  late ParsedCardQuestion _parsed;
  late ParsedCardQuestion _parsedAr;
  late List<String> _options;
  int? _correct;

  @override
  void initState() {
    super.initState();
    _parse();
  }

  @override
  void didUpdateWidget(covariant MirrorCardView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.card.id != widget.card.id) {
      _selected = null;
      _revealed = false;
      _translation = false;
      _parse();
    }
  }

  void _parse() {
    final card = widget.card;
    _parsed = parseCardQuestion(card.question);
    _parsedAr = parseCardQuestion(card.questionArabic, arabic: true);
    _options = [for (final r in _parsed.options) r.of(card.question)];
    _correct = resolveCardAnswer(card.answer, card.question, _options);
  }

  _OptionState _stateOf(int i) {
    if (!_revealed) return _OptionState.idle;
    if (_correct == null) {
      return _selected == i ? _OptionState.chosen : _OptionState.idle;
    }
    if (i == _correct) return _OptionState.correct;
    if (i == _selected) return _OptionState.wrong;
    return _OptionState.dimmed;
  }

  void _choose(int i) {
    if (_revealed) return;
    HapticFeedback.selectionClick();
    setState(() {
      _selected = i;
      _revealed = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final card = widget.card;
    final interactive = _parsed.options.isNotEmpty;
    final stem = interactive ? _parsed.stem.of(card.question) : card.question;
    final answeredRight = _selected != null && _selected == _correct;

    return Container(
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.lg),
        border: Border.all(color: NlColors.rule),
      ),
      padding: const EdgeInsets.all(NlSpace.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: NlSpace.sm,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              NlBadge(widget.origin),
              if (card.needsReview)
                NlBadge(l10n.deckNeedsReview, marked: true)
              else
                _ClearBadge(label: l10n.cardClear),
              Text(
                l10n.cardConfidence(_confidenceLabel(l10n, card.confidence)),
                style: NlText.caption.copyWith(fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: NlSpace.lg),
          if (card.imageUrl != null) ...[
            _CardImage(url: card.imageUrl!),
            const SizedBox(height: NlSpace.lg),
          ],
          AutoDirText(
            stem.isEmpty ? card.questionArabic : stem,
            style: NlText.rowLabel.copyWith(fontSize: 17, height: 1.6),
          ),
          if (interactive) ...[
            const SizedBox(height: NlSpace.lg),
            for (var i = 0; i < _options.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: NlSpace.sm),
                child: _OptionTile(
                  number: i + 1,
                  text: _options[i],
                  state: _stateOf(i),
                  onTap: () => _choose(i),
                ),
              ),
          ],
          const SizedBox(height: NlSpace.md),
          if (!_revealed)
            _RevealButton(
              label: l10n.cardReveal,
              onTap: () => setState(() => _revealed = true),
            )
          else
            _Explanation(
              card: card,
              result: _selected != null && _correct != null
                  ? (answeredRight ? l10n.cardCorrect : l10n.cardWrong)
                  : null,
              right: answeredRight,
            ),
          if (_translation && card.questionArabic.isNotEmpty) ...[
            const SizedBox(height: NlSpace.md),
            _Translation(card: card, parsed: _parsedAr),
          ],
          const SizedBox(height: NlSpace.sm),
          // Wraps onto two lines on narrow phones instead of overflowing.
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (_revealed)
                NlButton(
                  label: l10n.cardTryAgain,
                  kind: NlButtonKind.ghost,
                  icon: LucideIcons.rotateCcw,
                  onPressed: () => setState(() {
                    _selected = null;
                    _revealed = false;
                  }),
                ),
              if (card.questionArabic.isNotEmpty)
                NlButton(
                  label: _translation
                      ? l10n.cardHideTranslation
                      : l10n.cardShowTranslation,
                  kind: NlButtonKind.ghost,
                  icon: LucideIcons.languages,
                  onPressed: () => setState(() => _translation = !_translation),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

String _confidenceLabel(AppLocalizations l10n, String level) => switch (level) {
  'low' => l10n.confidenceLow,
  'medium' => l10n.confidenceMedium,
  _ => l10n.confidenceHigh,
};

class _ClearBadge extends StatelessWidget {
  const _ClearBadge({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: NlColors.correctSoft,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.check, size: 12, color: NlColors.correct),
          const SizedBox(width: 4),
          Text(
            label,
            style: NlText.caption.copyWith(
              fontSize: 12,
              color: NlColors.correct,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.number,
    required this.text,
    required this.state,
    required this.onTap,
  });

  final int number;
  final String text;
  final _OptionState state;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (bg, border, fg) = switch (state) {
      _OptionState.correct => (
        NlColors.correctSoft,
        NlColors.correct,
        NlColors.ink,
      ),
      _OptionState.wrong => (NlColors.wrongSoft, NlColors.wrong, NlColors.ink),
      _OptionState.chosen => (NlColors.niroSoft, NlColors.niro, NlColors.ink),
      _OptionState.dimmed => (NlColors.sheet, NlColors.rule, NlColors.ink3),
      _OptionState.idle => (NlColors.sheet, NlColors.ruleStrong, NlColors.ink),
    };
    final direction = contentDirection(text) ?? TextDirection.ltr;
    return Semantics(
      button: true,
      selected: state == _OptionState.chosen,
      child: AnimatedContainer(
        duration: MediaQuery.of(context).disableAnimations
            ? Duration.zero
            : NlMotion.fast,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(NlRadius.md),
          border: Border.all(
            color: border,
            width: state == _OptionState.idle ? 1 : 2,
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
                      if (state == _OptionState.correct)
                        const Icon(
                          LucideIcons.circleCheck,
                          color: NlColors.correct,
                          size: 20,
                        ),
                      if (state == _OptionState.wrong)
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

class _RevealButton extends StatelessWidget {
  const _RevealButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NlColors.paper,
      borderRadius: BorderRadius.circular(NlRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(NlRadius.md),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.eye, size: 18, color: NlColors.ink2),
              const SizedBox(width: NlSpace.sm),
              Text(label, style: NlText.rowLabel.copyWith(fontSize: 15)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Explanation extends StatelessWidget {
  const _Explanation({
    required this.card,
    required this.result,
    required this.right,
  });

  final MirrorCard card;
  final String? result;
  final bool right;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    Widget heading(IconData icon, String text) => Padding(
      padding: const EdgeInsets.only(top: NlSpace.md, bottom: NlSpace.xs),
      child: Row(
        children: [
          Icon(icon, size: 14, color: NlColors.niroDeep),
          const SizedBox(width: 6),
          Text(text, style: NlText.label.copyWith(color: NlColors.niroDeep)),
        ],
      ),
    );
    Widget pair(String en, String ar, {bool strong = false}) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (en.isNotEmpty)
          AutoDirText(
            en,
            style: (strong ? NlText.rowLabel : NlText.body).copyWith(
              height: 1.6,
            ),
          ),
        if (ar.isNotEmpty)
          AutoDirText(ar, style: NlText.reading.copyWith(fontSize: 16)),
      ],
    );

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
            heading(LucideIcons.circleCheck, l10n.cardAnswer),
            pair(card.answer, card.answerArabic, strong: true),
            if (card.explanation.isNotEmpty ||
                card.explanationArabic.isNotEmpty) ...[
              heading(LucideIcons.bookOpen, l10n.cardExplanation),
              pair(card.explanation, card.explanationArabic),
            ],
            if (card.keyIdea.isNotEmpty || card.keyIdeaArabic.isNotEmpty) ...[
              heading(LucideIcons.lightbulb, l10n.cardKeyIdea),
              pair(card.keyIdea, card.keyIdeaArabic, strong: true),
            ],
            if (card.keyword.isNotEmpty || card.keywordArabic.isNotEmpty) ...[
              heading(LucideIcons.keyRound, l10n.cardKeyword),
              Wrap(
                spacing: NlSpace.sm,
                runSpacing: NlSpace.sm,
                children: [
                  for (final word in [card.keyword, card.keywordArabic])
                    if (word.isNotEmpty)
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
  const _Translation({required this.card, required this.parsed});

  final MirrorCard card;
  final ParsedCardQuestion parsed;

  @override
  Widget build(BuildContext context) {
    final text = card.questionArabic;
    final style = NlText.reading.copyWith(fontSize: 16);
    return Container(
      padding: const EdgeInsets.all(NlSpace.lg),
      decoration: BoxDecoration(
        color: NlColors.niroSoft,
        borderRadius: BorderRadius.circular(NlRadius.md),
      ),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: parsed.options.isEmpty
            ? Text(text, style: style)
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(parsed.stem.of(text), style: style),
                  const SizedBox(height: NlSpace.sm),
                  for (var i = 0; i < parsed.options.length; i++)
                    Text(
                      '${String.fromCharCode(0x0661 + i)}. ${parsed.options[i].of(text)}',
                      style: style,
                    ),
                ],
              ),
      ),
    );
  }
}

class _CardImage extends StatelessWidget {
  const _CardImage({required this.url});
  final String url;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(NlRadius.md),
      child: InteractiveViewer(
        maxScale: 4,
        child: Image.network(
          url,
          fit: BoxFit.contain,
          loadingBuilder: (context, child, progress) => progress == null
              ? child
              : const SizedBox(height: 180, child: NlSkeleton(height: 180)),
          errorBuilder: (context, _, _) => Container(
            height: 80,
            color: NlColors.paper,
            alignment: Alignment.center,
            child: Text(
              AppLocalizations.of(context).cardImageFailed,
              style: NlText.caption,
            ),
          ),
        ),
      ),
    );
  }
}
