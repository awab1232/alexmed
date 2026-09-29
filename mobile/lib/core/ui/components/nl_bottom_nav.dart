import 'package:flutter/material.dart';

import '../theme.dart';
import '../tokens.dart';

class NlNavItem {
  const NlNavItem({required this.icon, required this.label});

  final IconData icon;
  final String label;
}

/// The student bottom bar, as on the web (`.student-bottom-nav`): white bar
/// with a top rule, 12px labels, the active tab's icon on a highlighter pill,
/// and a raised ink ＋ in the middle that opens the add sheet (it is an
/// action, not a tab).
class NlBottomNav extends StatelessWidget {
  const NlBottomNav({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onSelected,
    required this.addLabel,
    required this.onAdd,
    required this.addIcon,
  }) : assert(items.length == 4, 'two tabs on each side of ＋');

  /// The 4 tabs in reading order; ＋ sits between items 1 and 2.
  final List<NlNavItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final String addLabel;
  final IconData addIcon;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    Widget tab(int index) => Expanded(
      child: _NavTab(
        item: items[index],
        selected: index == selectedIndex,
        onTap: () => onSelected(index),
      ),
    );
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: NlColors.sheet,
        border: Border(top: BorderSide(color: NlColors.rule)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 60,
          child: Row(
            children: [
              tab(0),
              tab(1),
              Expanded(
                child: _AddButton(label: addLabel, icon: addIcon, onTap: onAdd),
              ),
              tab(2),
              tab(3),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavTab extends StatelessWidget {
  const _NavTab({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final NlNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? NlColors.ink : NlColors.ink3;
    return Semantics(
      selected: selected,
      button: true,
      child: InkResponse(
        onTap: onTap,
        containedInkWell: true,
        highlightShape: BoxShape.rectangle,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: MediaQuery.of(context).disableAnimations
                  ? Duration.zero
                  : NlMotion.normal,
              curve: NlMotion.ease,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 3),
              decoration: BoxDecoration(
                color: selected ? NlColors.marker : Colors.transparent,
                borderRadius: BorderRadius.circular(99),
              ),
              child: Icon(item.icon, size: 22, color: color),
            ),
            const SizedBox(height: 4),
            Text(
              item.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: NlText.navLabel.copyWith(
                color: color,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddButton extends StatelessWidget {
  const _AddButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Tooltip(
        message: label,
        child: Semantics(
          button: true,
          label: label,
          excludeSemantics: true,
          child: Material(
            color: NlColors.ink,
            shape: const CircleBorder(
              side: BorderSide(color: NlColors.paper, width: 3),
            ),
            elevation: 6,
            shadowColor: NlColors.ink.withValues(alpha: 0.5),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onTap,
              child: SizedBox.square(
                dimension: 52,
                child: Icon(icon, color: Colors.white, size: 26),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
