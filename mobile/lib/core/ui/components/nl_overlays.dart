import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../theme.dart';
import '../tokens.dart';
import 'nl_button.dart';

/// Bottom sheet with the grab handle, a title and safe-area padding —
/// choosers (＋ add), pickers, explanations, row actions.
Future<T?> showNlSheet<T>(
  BuildContext context, {
  required String title,
  required WidgetBuilder builder,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => Padding(
      padding: EdgeInsets.only(
        left: NlSpace.xl,
        right: NlSpace.xl,
        bottom: MediaQuery.of(context).viewInsets.bottom + NlSpace.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(title, style: NlText.title)),
          const SizedBox(height: NlSpace.lg),
          Flexible(child: builder(context)),
        ],
      ),
    ),
  );
}

/// Confirmation for consequential actions. [destructive] turns the confirm
/// button red. Returns true only when confirmed.
Future<bool> showNlConfirm(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  bool destructive = false,
}) async {
  final l10n = AppLocalizations.of(context);
  final result = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actionsPadding: const EdgeInsets.fromLTRB(
        NlSpace.lg,
        0,
        NlSpace.lg,
        NlSpace.lg,
      ),
      actions: [
        NlButton(
          label: l10n.actionCancel,
          kind: NlButtonKind.secondary,
          onPressed: () => Navigator.of(context).pop(false),
        ),
        NlButton(
          label: confirmLabel,
          kind: destructive ? NlButtonKind.destructive : NlButtonKind.primary,
          onPressed: () => Navigator.of(context).pop(true),
        ),
      ],
    ),
  );
  return result ?? false;
}

/// A short confirmation that names what happened ("تم الحفظ").
void showNlToast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Progress through a sequence (questions, cards, upload) — ink on rule.
class NlProgressBar extends StatelessWidget {
  const NlProgressBar({super.key, required this.value, this.semanticsLabel});

  /// 0..1.
  final double value;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0.0, 1.0);
    return Semantics(
      label: semanticsLabel,
      value: '${(clamped * 100).round()}%',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: LinearProgressIndicator(
          value: clamped,
          minHeight: 6,
          color: NlColors.ink,
          backgroundColor: NlColors.rule,
        ),
      ),
    );
  }
}

/// Small pill (plan name, role, status). [marked] = highlighter, for the
/// one thing that matters now.
class NlBadge extends StatelessWidget {
  const NlBadge(this.label, {super.key, this.marked = false});

  final String label;
  final bool marked;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: marked ? NlColors.markerSoft : null,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(
          color: marked ? NlColors.marker : NlColors.ruleStrong,
        ),
      ),
      child: Text(
        label,
        style: NlText.caption.copyWith(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: marked ? NlColors.ink : NlColors.ink2,
        ),
      ),
    );
  }
}
