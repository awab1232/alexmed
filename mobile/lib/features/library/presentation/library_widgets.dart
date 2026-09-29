import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/ui/ui.dart';
import '../data/library_models.dart';

/// Tab colours cycled by list position, as on the web
/// (`.home-folder-row.is-tab-N`).
const folderTabColors = [
  Color(0xFF3355FF),
  Color(0xFF0E9F6E),
  Color(0xFFE0A100),
  Color(0xFFD9486B),
  Color(0xFF7A5AF8),
];

/// A binder-divider tab (the web's clip-path polygon).
class FolderTab extends StatelessWidget {
  const FolderTab({super.key, required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return ClipPath(
      clipper: _TabClipper(),
      child: Container(
        width: 34,
        height: 26,
        decoration: BoxDecoration(
          color: color,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(4),
            bottom: Radius.circular(2),
          ),
        ),
      ),
    );
  }
}

class _TabClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    // polygon(0 22%, 38% 22%, 48% 0, 100% 0, 100% 100%, 0 100%)
    return Path()
      ..moveTo(0, size.height * 0.22)
      ..lineTo(size.width * 0.38, size.height * 0.22)
      ..lineTo(size.width * 0.48, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

/// A book as a spine: solid ink when ready, moving blue stripes while the
/// server is still reading / preparing it (`.home-book-spine`). Static
/// stripes when the system asks for reduced motion.
class BookSpine extends StatefulWidget {
  const BookSpine({super.key, required this.state});

  final BookState state;

  @override
  State<BookSpine> createState() => _BookSpineState();
}

class _BookSpineState extends State<BookSpine>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );

  bool get _busy => widget.state != BookState.ready;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(covariant BookSpine oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  void _sync() {
    final animate = _busy && !MediaQuery.of(context).disableAnimations;
    if (animate && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!animate) {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(3),
        child: SizedBox(
          width: 10,
          height: 40,
          child: _busy
              ? AnimatedBuilder(
                  animation: _controller,
                  builder: (context, _) => CustomPaint(
                    painter: _StripesPainter(offset: _controller.value * 20),
                  ),
                )
              : const ColoredBox(color: NlColors.ink),
        ),
      ),
    );
  }
}

class _StripesPainter extends CustomPainter {
  _StripesPainter({required this.offset});

  final double offset;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = NlColors.niroSoft);
    final stripe = Paint()..color = NlColors.niro;
    // 6px blue, 4px soft, moving down.
    for (var y = -20.0 + offset % 10; y < size.height; y += 10) {
      canvas.drawRect(Rect.fromLTWH(0, y, size.width, 6), stripe);
    }
  }

  @override
  bool shouldRepaint(covariant _StripesPainter old) => old.offset != offset;
}

/// A list row on Home / folder pages (`.home-book-row` / `.home-folder-row`):
/// leading mark, title + one line of detail, chevron in reading direction.
class LibraryRow extends StatelessWidget {
  const LibraryRow({
    super.key,
    required this.leading,
    required this.title,
    required this.detail,
    this.onTap,
    this.trailing,
    this.badge,
  });

  final Widget leading;
  final String title;
  final String detail;
  final VoidCallback? onTap;
  final Widget? trailing;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
          child: Row(
            children: [
              leading,
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            // File names can be English inside Arabic UI.
                            isolate(title),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: NlText.rowLabel,
                          ),
                        ),
                        if (badge != null) ...[
                          const SizedBox(width: NlSpace.sm),
                          NlBadge(badge!),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      detail,
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
              if (trailing == null && onTap != null)
                // Lucide icons do not auto-mirror, so pick by direction (as NlRow).
                Icon(
                  rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight,
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

/// Rows separated by rules, with a rule on top (`.home-book-list`).
class RuledList extends StatelessWidget {
  const RuledList({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Divider(height: 1),
        for (final child in children) ...[child, const Divider(height: 1)],
      ],
    );
  }
}

/// Section heading with an optional text action (`.home-section-head`).
class SectionHead extends StatelessWidget {
  const SectionHead({super.key, required this.title, this.action});

  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 28, bottom: NlSpace.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Semantics(
              header: true,
              child: Text(title, style: NlText.title),
            ),
          ),
          ?action,
        ],
      ),
    );
  }
}

/// "3 كتب، 2 ملف أسئلة، آخر تحديث 12 سبتمبر" date part, Western digits
/// like the web (`ar-EG-u-nu-latn`, day + short month).
String shortDate(DateTime date, Locale locale) {
  final local = date.toLocal();
  const arMonths = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ];
  const enMonths = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  final months = locale.languageCode == 'ar' ? arMonths : enMonths;
  return '${local.day} ${months[local.month - 1]}';
}
