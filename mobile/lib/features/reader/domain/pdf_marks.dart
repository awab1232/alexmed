// تضليل / قلم / ممحاة on a PDF page — the web's lib/pdf-marks.ts (which
// reuses lib/card-marks.ts's pen geometry). Same stored shape
// (bookPageMarks), same units: every coordinate is a fraction of the
// rendered page WIDTH (y too), with the origin at the page's top-left.
// The point thinning and the eraser hit test are proven identical to the
// web by test/features/reader/pdf_marks_parity_test.dart.

import 'dart:math' as math;

typedef StrokePoint = (double, double);

/// Highlight colours and pen colours offered by the web reader.
const highlightColors = [
  (value: '#fde68a', label: 'أصفر'),
  (value: '#bbf7d0', label: 'أخضر'),
  (value: '#bfdbfe', label: 'أزرق'),
  (value: '#fbcfe8', label: 'وردي'),
  (value: '#fed7aa', label: 'برتقالي'),
];

const penColors = [
  (value: '#e11d48', label: 'أحمر'),
  (value: '#2563eb', label: 'أزرق'),
  (value: '#16a34a', label: 'أخضر'),
  (value: '#7c3aed', label: 'بنفسجي'),
  (value: '#1f2937', label: 'أسود'),
];

/// Stroke thickness, in page widths.
const penWidth = 0.006;

/// Eraser radius, in page widths.
const eraserRadius = 0.025;

/// Minimum spacing between recorded pen points (page widths).
const _minPointDistance = 0.003;

// Server-side caps (lib/trpc/bookPageMarksRouter.ts).
const maxPdfHighlights = 200;
const maxRectsPerHighlight = 40;
const maxStrokes = 200;
const maxPointsPerStroke = 1500;

final class MarkRect {
  const MarkRect({
    required this.x,
    required this.y,
    required this.width,
    required this.height,
  });

  factory MarkRect.fromJson(Map<String, Object?> json) => MarkRect(
    x: _num(json['x']),
    y: _num(json['y']),
    width: _num(json['width']),
    height: _num(json['height']),
  );

  final double x;
  final double y;
  final double width;
  final double height;

  Map<String, Object?> toJson() => {
    'x': x,
    'y': y,
    'width': width,
    'height': height,
  };
}

final class PdfHighlight {
  const PdfHighlight({
    required this.id,
    required this.color,
    required this.rects,
  });

  factory PdfHighlight.fromJson(Map<String, Object?> json) => PdfHighlight(
    id: json['id']! as String,
    color: json['color']! as String,
    rects: [
      for (final r in (json['rects'] as List?) ?? const [])
        if (r is Map) MarkRect.fromJson(r.cast<String, Object?>()),
    ],
  );

  final String id;
  final String color;
  final List<MarkRect> rects;

  Map<String, Object?> toJson() => {
    'id': id,
    'color': color,
    'rects': [for (final r in rects) r.toJson()],
  };
}

final class Stroke {
  const Stroke({
    required this.id,
    required this.color,
    required this.width,
    required this.points,
  });

  factory Stroke.fromJson(Map<String, Object?> json) => Stroke(
    id: json['id']! as String,
    color: json['color']! as String,
    width: _num(json['width']),
    points: [
      for (final p in (json['points'] as List?) ?? const [])
        if (p is List && p.length == 2) (_num(p[0]), _num(p[1])),
    ],
  );

  final String id;
  final String color;

  /// Thickness in page widths.
  final double width;
  final List<StrokePoint> points;

  Stroke withPoints(List<StrokePoint> next) =>
      Stroke(id: id, color: color, width: width, points: next);

  Map<String, Object?> toJson() => {
    'id': id,
    'color': color,
    'width': width,
    'points': [
      for (final (x, y) in points) [x, y],
    ],
  };
}

/// One page's marks — one row per (user, book, page) on the server.
final class PageMarks {
  const PageMarks({this.highlights = const [], this.strokes = const []});

  factory PageMarks.fromJson(Map<String, Object?> json) => PageMarks(
    highlights: [
      for (final h in (json['highlights'] as List?) ?? const [])
        if (h is Map) PdfHighlight.fromJson(h.cast<String, Object?>()),
    ],
    strokes: [
      for (final s in (json['strokes'] as List?) ?? const [])
        if (s is Map) Stroke.fromJson(s.cast<String, Object?>()),
    ],
  );

  static const empty = PageMarks();

  final List<PdfHighlight> highlights;
  final List<Stroke> strokes;

  bool get isEmpty => highlights.isEmpty && strokes.isEmpty;

  PageMarks copyWith({List<PdfHighlight>? highlights, List<Stroke>? strokes}) =>
      PageMarks(
        highlights: highlights ?? this.highlights,
        strokes: strokes ?? this.strokes,
      );
}

double _num(Object? v) => v is num ? v.toDouble() : 0;

final _random = math.Random();

/// A short random id (the web: base-36 random + time).
String newMarkId() {
  String b36(int n) => n.toRadixString(36);
  final rand = b36(_random.nextInt(1 << 32)).padLeft(7, '0');
  return '${rand.substring(0, 7)}${b36(DateTime.now().millisecondsSinceEpoch)}';
}

double _distance(StrokePoint a, StrokePoint b) =>
    math.sqrt(math.pow(a.$1 - b.$1, 2) + math.pow(a.$2 - b.$2, 2));

/// Skips a point too close to the previous one (keeps long slow strokes
/// small).
List<StrokePoint> appendPoint(List<StrokePoint> points, StrokePoint point) {
  if (points.isNotEmpty && _distance(points.last, point) < _minPointDistance) {
    return points;
  }
  return [...points, point];
}

double _distanceToSegment(StrokePoint p, StrokePoint a, StrokePoint b) {
  final dx = b.$1 - a.$1;
  final dy = b.$2 - a.$2;
  final lengthSquared = dx * dx + dy * dy;
  if (lengthSquared == 0) return _distance(p, a);
  final t = (((p.$1 - a.$1) * dx + (p.$2 - a.$2) * dy) / lengthSquared).clamp(
    0.0,
    1.0,
  );
  return _distance(p, (a.$1 + t * dx, a.$2 + t * dy));
}

/// True when an eraser of [radius] centred on [point] touches the stroke
/// (including its own thickness).
bool strokeTouches(Stroke stroke, StrokePoint point, double radius) {
  final reach = radius + stroke.width / 2;
  final points = stroke.points;
  if (points.length == 1) return _distance(point, points.first) <= reach;
  for (var i = 1; i < points.length; i++) {
    if (_distanceToSegment(point, points[i - 1], points[i]) <= reach) {
      return true;
    }
  }
  return false;
}

/// Strokes the eraser at [point] did not touch (the same list when none).
List<Stroke> eraseStrokesAt(
  List<Stroke> strokes,
  StrokePoint point, [
  double radius = eraserRadius,
]) {
  final kept = strokes.where((s) => !strokeTouches(s, point, radius)).toList();
  return kept.length == strokes.length ? strokes : kept;
}

/// A PDF highlight is a plain append under the cap (text may be highlighted
/// twice in two colours, as on the web).
List<PdfHighlight> addPdfHighlight(
  List<PdfHighlight> highlights,
  PdfHighlight next,
) {
  if (next.rects.isEmpty || highlights.length >= maxPdfHighlights) {
    return highlights;
  }
  return [...highlights, next];
}

/// Highlights whose rectangles contain [point] (page-width units) — the
/// eraser removes them, like the web's hit test under the pointer.
Set<String> highlightsAt(List<PdfHighlight> highlights, StrokePoint point) => {
  for (final h in highlights)
    if (h.rects.any(
      (r) =>
          point.$1 >= r.x &&
          point.$1 <= r.x + r.width &&
          point.$2 >= r.y &&
          point.$2 <= r.y + r.height,
    ))
      h.id,
};

/// A text rectangle in PDF page coordinates (points, origin bottom-left)
/// → the web's stored form: fractions of the page width, origin top-left.
MarkRect markRectFromPdf({
  required double left,
  required double top,
  required double right,
  required double bottom,
  required double pageWidth,
  required double pageHeight,
}) => MarkRect(
  x: left / pageWidth,
  y: (pageHeight - top) / pageWidth,
  width: (right - left) / pageWidth,
  height: (top - bottom) / pageWidth,
);

/// Fragment rectangles on the same line are merged, and the result is
/// capped (the server accepts at most [maxRectsPerHighlight]).
List<MarkRect> mergeLineRects(List<MarkRect> rects) {
  final sorted = [...rects]..sort((a, b) => a.y.compareTo(b.y));
  final merged = <MarkRect>[];
  for (final r in sorted) {
    final last = merged.isEmpty ? null : merged.last;
    final sameLine =
        last != null &&
        (last.y - r.y).abs() < math.min(last.height, r.height) * 0.5;
    if (sameLine) {
      final left = math.min(last.x, r.x);
      final right = math.max(last.x + last.width, r.x + r.width);
      final top = math.min(last.y, r.y);
      final bottom = math.max(last.y + last.height, r.y + r.height);
      merged[merged.length - 1] = MarkRect(
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      );
    } else {
      merged.add(r);
    }
  }
  return merged.take(maxRectsPerHighlight).toList();
}
