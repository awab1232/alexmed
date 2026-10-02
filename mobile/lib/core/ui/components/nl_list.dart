import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme.dart';
import '../tokens.dart';

/// A titled group of rows on one white sheet — the grouped-list pattern of
/// the web's حسابي page (app/account/account.module.css: `.group`, `.list`).
class NlGroup extends StatelessWidget {
  const NlGroup({super.key, this.title, required this.children});

  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) rows.add(const Divider(height: 1));
      rows.add(children[i]);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (title != null)
          Padding(
            padding: const EdgeInsetsDirectional.only(
              start: 6,
              bottom: NlSpace.sm,
            ),
            child: Semantics(
              header: true,
              child: Text(title!, style: NlText.label),
            ),
          ),
        DecoratedBox(
          decoration: BoxDecoration(
            color: NlColors.sheet,
            borderRadius: BorderRadius.circular(NlRadius.md),
            border: Border.all(color: NlColors.rule),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(NlRadius.md),
            child: Material(
              type: MaterialType.transparency,
              child: Column(children: rows),
            ),
          ),
        ),
      ],
    );
  }
}

/// One row: icon tile, label (+ current value underneath), chevron.
/// Rows that open a page show a chevron pointing in the reading direction.
class NlRow extends StatelessWidget {
  const NlRow({
    super.key,
    required this.label,
    this.icon,
    this.value,
    this.onTap,
    this.trailing,
    this.showChevron = true,
    this.destructive = false,
  });

  final String label;
  final IconData? icon;

  /// The current setting, shown under the label ("Free", "@username").
  final String? value;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool showChevron;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? NlColors.wrong : NlColors.ink;
    return InkWell(
      onTap: onTap,
      highlightColor: NlColors.rowPressed,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: NlSpace.lg,
            vertical: NlSpace.md,
          ),
          child: Row(
            children: [
              if (icon != null) ...[
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: destructive ? NlColors.wrongSoft : NlColors.paper,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    icon,
                    size: 18,
                    color: destructive ? NlColors.wrong : NlColors.ink2,
                  ),
                ),
                const SizedBox(width: NlSpace.md),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(label, style: NlText.rowLabel.copyWith(color: color)),
                    if (value != null && value!.isNotEmpty)
                      Text(
                        value!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: NlText.caption.copyWith(
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                  ],
                ),
              ),
              ?trailing,
              if (trailing == null && showChevron && onTap != null)
                // Lucide's "chevron-left" is "forward" in RTL; mirror in LTR.
                Icon(
                  Directionality.of(context) == TextDirection.rtl
                      ? LucideIcons.chevronLeft
                      : LucideIcons.chevronRight,
                  size: 18,
                  color: NlColors.ink3,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
