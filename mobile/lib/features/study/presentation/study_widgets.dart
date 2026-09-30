import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';

/// End of a session (review / quiz): Niro, a title, a line, actions.
class StudyResult extends StatelessWidget {
  const StudyResult({
    super.key,
    required this.expression,
    required this.title,
    required this.body,
    required this.actions,
  });

  final NiroExpression expression;
  final String title;
  final String body;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(NlSpace.xl),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            NiroImage(expression: expression, size: 120),
            const SizedBox(height: NlSpace.lg),
            Text(title, style: NlText.display, textAlign: TextAlign.center),
            const SizedBox(height: NlSpace.sm),
            Text(body, style: NlText.secondary, textAlign: TextAlign.center),
            const SizedBox(height: NlSpace.xl),
            for (final (i, action) in actions.indexed) ...[
              if (i > 0) const SizedBox(height: NlSpace.sm),
              action,
            ],
          ],
        ),
      ),
    ),
  );
}

/// "QUESTION / السؤال" then the English (LTR) and Arabic (RTL) texts.
class BilingualBlock extends StatelessWidget {
  const BilingualBlock({
    super.key,
    required this.label,
    required this.en,
    required this.ar,
    this.strong = false,
  });

  final String label;
  final String en;
  final String ar;
  final bool strong;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: NlSpace.lg),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(isolateLtr(label), style: NlText.label),
        const SizedBox(height: 4),
        if (en.isNotEmpty)
          Text(
            en,
            textDirection: TextDirection.ltr,
            style: NlText.body.copyWith(
              fontWeight: strong ? FontWeight.w700 : null,
            ),
          ),
        if (ar.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(ar, textDirection: TextDirection.rtl, style: NlText.reading),
        ],
      ],
    ),
  );
}

/// The PDF page a card / question came from, opened in the reader at
/// that page (the web: /books/[id]/read?page=N). Back returns here.
void openSourcePage(
  BuildContext context, {
  required String bookId,
  required int page,
}) => unawaited(context.push(Routes.bookRead(bookId, page: page)));

enum McqChoiceState { idle, pending, correct, wrong, dim }

/// One lettered answer choice (quiz, weak points): idle / pending / right /
/// wrong / dimmed, optionally struck out by تلميح.
class McqChoice extends StatelessWidget {
  const McqChoice({
    super.key,
    required this.letter,
    required this.text,
    required this.state,
    required this.removed,
    required this.onTap,
  });

  final String letter;
  final String text;
  final McqChoiceState state;
  final bool removed;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (Color border, Color bg, Color letterBg) = switch (state) {
      McqChoiceState.correct => (
        NlColors.correct,
        NlColors.correctSoft,
        NlColors.correct,
      ),
      McqChoiceState.wrong => (
        NlColors.wrong,
        NlColors.wrongSoft,
        NlColors.wrong,
      ),
      McqChoiceState.pending => (NlColors.ink, NlColors.sheet, NlColors.ink),
      _ => (NlColors.rule, NlColors.sheet, NlColors.paper),
    };
    final strong =
        state == McqChoiceState.correct ||
        state == McqChoiceState.wrong ||
        state == McqChoiceState.pending;
    return Opacity(
      opacity: removed ? 0.35 : (state == McqChoiceState.dim ? 0.6 : 1),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Material(
          color: bg,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NlRadius.md),
            side: BorderSide(color: border, width: strong ? 2 : 1),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(NlRadius.md),
            onTap: onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 56),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: NlSpace.md,
                  vertical: NlSpace.sm,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: letterBg,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        letter,
                        style: NlText.caption.copyWith(
                          fontWeight: FontWeight.w700,
                          color: strong ? Colors.white : NlColors.ink2,
                        ),
                      ),
                    ),
                    const SizedBox(width: NlSpace.md),
                    Expanded(
                      child: Text(
                        text,
                        style: NlText.body.copyWith(
                          decoration: removed
                              ? TextDecoration.lineThrough
                              : null,
                        ),
                      ),
                    ),
                    if (state == McqChoiceState.pending)
                      const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    if (state == McqChoiceState.correct)
                      const Icon(
                        LucideIcons.circleCheck,
                        color: NlColors.correct,
                        size: 20,
                      ),
                    if (state == McqChoiceState.wrong)
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
    );
  }
}
