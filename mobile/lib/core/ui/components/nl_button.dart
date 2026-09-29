import 'package:flutter/material.dart';

import '../theme.dart';
import '../tokens.dart';

/// The web's button family (app/globals.css @nl-design):
/// - [NlButtonKind.primary]   ink, white text, 48px — the normal main action
/// - [NlButtonKind.marker]    ink on highlighter — the ONE "do this now"
///                            action on a screen (`.nl-marker-button`)
/// - [NlButtonKind.secondary] white with a rule border, 44px
/// - [NlButtonKind.destructive] red — irreversible actions only
/// - [NlButtonKind.ghost]     text only (links, low-emphasis actions)
enum NlButtonKind { primary, marker, secondary, destructive, ghost }

class NlButton extends StatefulWidget {
  const NlButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.kind = NlButtonKind.primary,
    this.icon,
    this.loading = false,
    this.expand = false,
  });

  final String label;

  /// Null disables the button.
  final VoidCallback? onPressed;
  final NlButtonKind kind;
  final IconData? icon;

  /// Shows a spinner and ignores taps (the label stays for screen readers).
  final bool loading;

  /// Full width (forms, sheets).
  final bool expand;

  @override
  State<NlButton> createState() => _NlButtonState();
}

class _NlButtonState extends State<NlButton> {
  bool _pressed = false;

  bool get _enabled => widget.onPressed != null && !widget.loading;

  ({
    Color bg,
    Color fg,
    BorderSide? border,
    double height,
    double size,
    FontWeight weight,
  })
  get _look => switch (widget.kind) {
    NlButtonKind.primary => (
      bg: NlColors.ink,
      fg: Colors.white,
      border: null,
      height: 48,
      size: 15,
      weight: FontWeight.w600,
    ),
    NlButtonKind.marker => (
      bg: NlColors.marker,
      fg: NlColors.ink,
      border: null,
      height: 48,
      size: 15,
      weight: FontWeight.w700,
    ),
    NlButtonKind.secondary => (
      bg: NlColors.sheet,
      fg: NlColors.ink,
      border: const BorderSide(color: NlColors.ruleStrong),
      height: 44,
      size: 14,
      weight: FontWeight.w600,
    ),
    NlButtonKind.destructive => (
      bg: NlColors.wrong,
      fg: Colors.white,
      border: null,
      height: 48,
      size: 15,
      weight: FontWeight.w700,
    ),
    NlButtonKind.ghost => (
      bg: Colors.transparent,
      fg: NlColors.niroDeep,
      border: null,
      height: 44,
      size: 14,
      weight: FontWeight.w600,
    ),
  };

  @override
  Widget build(BuildContext context) {
    final look = _look;
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final content = Row(
      mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.loading)
          SizedBox.square(
            dimension: 16,
            child: CircularProgressIndicator(strokeWidth: 2, color: look.fg),
          )
        else if (widget.icon != null)
          Icon(widget.icon, size: 18, color: look.fg),
        if (widget.loading || widget.icon != null)
          const SizedBox(width: NlSpace.sm),
        Flexible(
          child: Text(
            widget.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: NlText.button.copyWith(
              color: look.fg,
              fontSize: look.size,
              fontWeight: look.weight,
            ),
          ),
        ),
      ],
    );

    return Semantics(
      button: true,
      enabled: _enabled,
      label: widget.loading ? widget.label : null,
      child: AnimatedScale(
        // The web's `transform: scale(0.97)` on press.
        scale: _pressed && !reduceMotion ? 0.97 : 1,
        duration: NlMotion.press,
        curve: NlMotion.ease,
        child: Opacity(
          opacity: widget.onPressed == null ? 0.5 : 1,
          child: Material(
            color: look.bg,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(NlRadius.md),
              side: look.border ?? BorderSide.none,
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: _enabled ? widget.onPressed : null,
              onHighlightChanged: (value) => setState(() => _pressed = value),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: look.height,
                  minWidth: nlMinTouch,
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: NlSpace.xl),
                  child: Center(widthFactor: 1, child: content),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
