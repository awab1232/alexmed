// Display helpers ported from the web — lib/exam-focus-categories.ts
// (splitHighlights) and components/exam-focus/ExamFocusCard.tsx
// (pagesLabel, stripBullet). Proven identical by
// test/features/exam_focus/exam_focus_parity_test.dart, which runs against
// the web code's own output (tool/export_exam_focus_fixtures.ts).

/// Numbers / cutoffs / doses inside a card line ("15–30 min", "pH 7.4",
/// "> 38.5 °C", "500 mg") — same pattern as the web.
final _numberPattern = RegExp(
  r'(?:[<>≤≥]\s?)?\d+(?:[.,]\d+)?(?:\s?[–-]\s?\d+(?:[.,]\d+)?)?(?:\s?(?:%|mg\/kg|mg|mcg|µg|kg|g|mL|ml|L|mmHg|mmol\/L|mEq\/L|IU|units?|°C|hours?|hrs?|minutes?|mins?|min|days?|weeks?|months?|years?|h)\b|%)?',
);
final _digit = RegExp(r'\d');

typedef TextSegment = ({String text, bool highlight});

List<TextSegment> splitHighlights(String text) {
  final segments = <TextSegment>[];
  var last = 0;
  for (final match in _numberPattern.allMatches(text)) {
    final value = match[0]!;
    final start = match.start;
    if (value.isEmpty || !_digit.hasMatch(value)) continue;
    if (start > last) {
      segments.add((text: text.substring(last, start), highlight: false));
    }
    segments.add((text: value, highlight: true));
    last = start + value.length;
  }
  if (last < text.length) {
    segments.add((text: text.substring(last), highlight: false));
  }
  return segments.isEmpty ? [(text: text, highlight: false)] : segments;
}

String pagesLabel(List<int> pages) {
  if (pages.isEmpty) return '';
  if (pages.length == 1) return 'p. ${pages.first}';
  final sorted = [...pages]..sort();
  var contiguous = true;
  for (var i = 1; i < sorted.length; i++) {
    if (sorted[i] != sorted[i - 1] + 1) contiguous = false;
  }
  return contiguous
      ? 'pp. ${sorted.first}–${sorted.last}'
      : 'pp. ${sorted.take(4).join(', ')}${sorted.length > 4 ? '…' : ''}';
}

/// Lines the model wrote with its own bullet keep one bullet (ours).
String stripBullet(String line) =>
    line.replaceFirst(RegExp(r'^\s*[•\-*–]\s+'), '');
