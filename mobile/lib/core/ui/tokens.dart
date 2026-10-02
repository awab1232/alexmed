import 'package:flutter/animation.dart';

/// NiroLearn "ink & highlighter" tokens — the values of the `--nl-*` custom
/// properties in app/base.css. Change them there and here together.
///
/// Ink for type and primary actions, Niro blue for links / focus / Niro,
/// highlighter yellow only for what matters *now* (due, next step, the
/// active tab) — the web's own rule.
abstract final class NlColors {
  static const ink = Color(0xFF1B2340);
  static const ink2 = Color(0xFF454C66);
  static const ink3 = Color(0xFF6B7188);
  static const paper = Color(0xFFF2F4F9);
  static const sheet = Color(0xFFFFFFFF);
  static const rule = Color(0xFFDFE3EC);
  static const ruleStrong = Color(0xFFC9CEDB);
  static const niro = Color(0xFF3355FF);
  static const niroDeep = Color(0xFF2440C7);
  static const niroSoft = Color(0xFFE9EEFF);
  static const marker = Color(0xFFFFD43B);
  static const markerSoft = Color(0xFFFFF3C4);
  static const correct = Color(0xFF0E9F6E);
  static const correctSoft = Color(0xFFE2F5EC);
  static const wrong = Color(0xFFDC3F46);
  static const wrongSoft = Color(0xFFFDECEE);

  /// Study text colour (`.summary-body` on the web).
  static const readingInk = Color(0xFF262D47);

  /// Row hover / open state (`#f7f8fc` in app/account/account.module.css).
  static const rowPressed = Color(0xFFF7F8FC);
}

abstract final class NlFonts {
  /// Interface face (bundled, assets/fonts/ReadexPro-*.ttf).
  static const ui = 'ReadexPro';

  /// Reading face for study text (assets/fonts/NotoNaskhArabic-*.ttf).
  static const reading = 'NotoNaskhArabic';
}

abstract final class NlRadius {
  static const sm = 6.0;
  static const md = 12.0;
  static const lg = 20.0;
}

/// 4-point spacing used across the web layouts (8, 12, 16, 20, 24…).
abstract final class NlSpace {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const xxl = 24.0;
  static const xxxl = 32.0;

  /// Horizontal page gutter.
  static const page = 16.0;
}

abstract final class NlMotion {
  /// `--nl-ease`.
  static const ease = Cubic(0.2, 0.7, 0.3, 1);
  static const press = Duration(milliseconds: 120);
  static const fast = Duration(milliseconds: 180);
  static const normal = Duration(milliseconds: 240);
}

/// Minimum touch target (Material 48dp; iOS 44pt is covered by it).
const double nlMinTouch = 48;
