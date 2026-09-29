// Port of the web's lib/mirror-card-question.ts — keep the two in step.
//
// مِرآة flashcards keep a multiple-choice question as ONE text field
// ("…? A. x B. y C. z D. w", on one line or one option per line) and the
// answer as free text ("B. y", "B - y", or just "y"). The card shows the
// options as tappable choices, so this finds them at display time only;
// a card this can't parse is shown whole.

final class TextRange {
  const TextRange(this.start, this.end);
  final int start;
  final int end;

  String of(String text) => text.substring(start, end);

  @override
  bool operator ==(Object other) =>
      other is TextRange && other.start == start && other.end == end;

  @override
  int get hashCode => Object.hash(start, end);

  @override
  String toString() => 'TextRange($start, $end)';
}

final class ParsedCardQuestion {
  const ParsedCardQuestion({required this.stem, required this.options});

  /// The stem, without a leading "12." and without the options.
  final TextRange stem;

  /// In order A, B, C… (or أ، ب، ج… / ١، ٢، ٣…); empty = not an MCQ.
  final List<TextRange> options;
}

final _latinMarker = RegExp(r'(^|\s)\(?([A-Ha-h])\s?[.):]\s+');
final _arabicMarker = RegExp('(^|\\s)\\(?([أاإبجدهوزح]|[١-٨])\\s?[.)\\-:]\\s+');
final _answerTail = RegExp(
  '\\s*(?:correct answer|answer|ans|الإجابة الصحيحة|الإجابة|الجواب)\\s*[:\\-][^\\n]*\$',
  caseSensitive: false,
);
final _numberPrefix = RegExp('^\\s*[\\d٠-٩]{1,3}\\s*[.)\\-]\\s+');

const _latinOrder = 'abcdefgh';

/// أ ب ج د هـ و ز ح (and ١-٨) — the Arabic option order.
final Map<String, int> _arabicOrder = {
  String.fromCharCode(0x0623): 0,
  String.fromCharCode(0x0627): 0,
  String.fromCharCode(0x0625): 0,
  String.fromCharCode(0x0628): 1,
  String.fromCharCode(0x062C): 2,
  String.fromCharCode(0x062F): 3,
  String.fromCharCode(0x0647): 4,
  String.fromCharCode(0x0648): 5,
  String.fromCharCode(0x0632): 6,
  String.fromCharCode(0x062D): 7,
  for (var i = 0; i < 8; i++) String.fromCharCode(0x0661 + i): i,
};

typedef _Marker = ({int order, int markerStart, int textStart});

List<_Marker> _findMarkers(String text, bool arabic) {
  final markers = <_Marker>[];
  for (final match in (arabic ? _arabicMarker : _latinMarker).allMatches(
    text,
  )) {
    final letter = match.group(2)!;
    final order = arabic
        ? _arabicOrder[letter]
        : _latinOrder.indexOf(letter.toLowerCase());
    if (order == null || order < 0) continue;
    markers.add((
      order: order,
      markerStart: match.start + match.group(1)!.length,
      textStart: match.end,
    ));
  }
  return markers;
}

/// The first run counting A, B, C… from A (at least two options), so an
/// "A." inside the stem ("vitamin A. …") never splits anything.
List<_Marker> _optionChain(List<_Marker> markers) {
  for (var i = 0; i < markers.length; i++) {
    if (markers[i].order != 0) continue;
    final chain = [markers[i]];
    for (var j = i + 1; j < markers.length; j++) {
      if (markers[j].order == chain.length) chain.add(markers[j]);
    }
    if (chain.length >= 2) return chain;
  }
  return const [];
}

final _space = RegExp(r'\s');

TextRange _trim(String text, int start, int end) {
  while (start < end && _space.hasMatch(text[start])) {
    start++;
  }
  while (end > start && _space.hasMatch(text[end - 1])) {
    end--;
  }
  return TextRange(start, end);
}

ParsedCardQuestion parseCardQuestion(String text, {bool arabic = false}) {
  final prefix = _numberPrefix.firstMatch(text);
  final stemStart = prefix?.end ?? 0;
  final chain = _optionChain(
    _findMarkers(
      text,
      arabic,
    ).where((m) => m.markerStart >= stemStart).toList(),
  );
  if (chain.isEmpty) {
    return ParsedCardQuestion(
      stem: _trim(text, stemStart, text.length),
      options: const [],
    );
  }
  final options = <TextRange>[];
  for (var i = 0; i < chain.length; i++) {
    final marker = chain[i];
    var end = i + 1 < chain.length ? chain[i + 1].markerStart : text.length;
    // "… D. last option. Answer: B." — the answer is never option text.
    if (i == chain.length - 1) {
      final tail = _answerTail.firstMatch(
        text.substring(marker.textStart, end),
      );
      if (tail != null) end = marker.textStart + tail.start;
    }
    final range = _trim(text, marker.textStart, end);
    if (range.end > range.start) options.add(range);
  }
  return ParsedCardQuestion(
    stem: _trim(text, stemStart, chain.first.markerStart),
    options: options,
  );
}

String _normalize(String text) => text
    .toLowerCase()
    .replaceAll(RegExp('[.,;:!?()"\'`]'), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

/// Which option the card's answer names: its letter ("B.", "B -", "(b)"),
/// an "Answer: B" inside the question, or its text. null when unsure —
/// the card then shows the answer without judging a pick.
int? resolveCardAnswer(String answer, String question, List<String> options) {
  if (options.isEmpty) return null;
  final letter = RegExp(r'^\s*\(?([A-Ha-h])\s*\)?\s*(?:[.)\-:]|$)')
      .firstMatch(answer);
  if (letter != null) {
    final index = _latinOrder.indexOf(letter.group(1)!.toLowerCase());
    if (index < options.length) return index;
  }
  final inline = RegExp(
    r'(?:correct answer|answer|ans)\s*[:\-]\s*\(?([A-Ha-h])\b',
    caseSensitive: false,
  ).firstMatch(question);
  if (inline != null) {
    final index = _latinOrder.indexOf(inline.group(1)!.toLowerCase());
    if (index < options.length) return index;
  }
  final wanted = _normalize(answer);
  if (wanted.isEmpty) return null;
  final exact = options.indexWhere((o) => _normalize(o) == wanted);
  if (exact != -1) return exact;
  final containing = [
    for (var i = 0; i < options.length; i++)
      if (_normalize(options[i]).length >= 3 &&
          (wanted.contains(_normalize(options[i])) ||
              _normalize(options[i]).contains(wanted)))
        i,
  ];
  return containing.length == 1 ? containing.single : null;
}
