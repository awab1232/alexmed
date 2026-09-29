import 'package:flutter/widgets.dart';

// Arabic + English (often medical terms inside Arabic sentences) — blueprint
// §17. The direction rule is the web's `isArabicText`
// (lib/question-parse-core.ts): Arabic letters must be present and at least
// as many as Latin letters, so "ما هو دور ACE inhibitor؟" stays RTL.
//
// Isolation marks are built from code points, never typed as escapes.

final _arabicLetter = RegExp('[\u0600-\u06FF]');
final _latinLetter = RegExp('[A-Za-z]');

/// Same rule as the web: mostly-Arabic text (Latin terms inside an Arabic
/// sentence don't make it English).
bool isArabicText(String text) {
  final arabic = _arabicLetter.allMatches(text).length;
  final latin = _latinLetter.allMatches(text).length;
  return arabic > 0 && arabic >= latin;
}

/// Direction for a block of user or AI content, or null when the text has no
/// letters at all (numbers, symbols) so it inherits its surroundings.
TextDirection? contentDirection(String text) {
  if (isArabicText(text)) return TextDirection.rtl;
  if (_latinLetter.hasMatch(text)) return TextDirection.ltr;
  return null;
}

final _fsi = String.fromCharCode(0x2068); // FIRST STRONG ISOLATE
final _lri = String.fromCharCode(0x2066); // LEFT-TO-RIGHT ISOLATE
final _pdi = String.fromCharCode(0x2069); // POP DIRECTIONAL ISOLATE

/// Embeds a run whose direction should follow its own first letter (an
/// English term, a title) without reordering the sentence around it.
String isolate(String text) => '$_fsi$text$_pdi';

/// Embeds a run that is always left-to-right — usernames, access codes,
/// phone numbers, emails, numbers with units — like the web's
/// `<bdi dir="ltr">`.
String isolateLtr(String text) => '$_lri$text$_pdi';

/// Text whose direction comes from its content (question text, options, AI
/// answers), aligned to its own start.
class AutoDirText extends StatelessWidget {
  const AutoDirText(
    this.text, {
    super.key,
    this.style,
    this.maxLines,
    this.overflow,
  });

  final String text;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;

  @override
  Widget build(BuildContext context) {
    final direction = contentDirection(text) ?? Directionality.of(context);
    return Directionality(
      textDirection: direction,
      child: Text(
        text,
        style: style,
        maxLines: maxLines,
        overflow: overflow,
        textAlign: TextAlign.start,
      ),
    );
  }
}
