import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../domain/pdf_marks.dart';

enum MarkTool { browse, highlight, pen, eraser }

Color markColor(String hex) =>
    Color(int.parse('FF${hex.replaceFirst('#', '')}', radix: 16));

/// One page's marks, drawn over the page as shown (every mark is stored in
/// page-width units, so it follows zoom). With the pen or the eraser it also
/// takes the finger: a stroke, or erasing strokes and highlights under it.
class MarksOverlay extends StatefulWidget {
  const MarksOverlay({
    super.key,
    required this.marks,
    required this.tool,
    required this.penColor,
    required this.onChange,
  });

  final PageMarks marks;
  final MarkTool tool;
  final String penColor;
  final void Function(PageMarks Function(PageMarks current) change) onChange;

  @override
  State<MarksOverlay> createState() => _MarksOverlayState();
}

class _MarksOverlayState extends State<MarksOverlay> {
  Stroke? _draft;

  StrokePoint _point(Offset local, Size size) => (
    (local.dx / size.width).clamp(0.0, 1.0),
    (local.dy / size.width).clamp(0.0, double.infinity),
  );

  void _erase(StrokePoint p) {
    widget.onChange((current) {
      final strokes = eraseStrokesAt(current.strokes, p);
      final hit = highlightsAt(current.highlights, p);
      if (identical(strokes, current.strokes) && hit.isEmpty) return current;
      return PageMarks(
        highlights: hit.isEmpty
            ? current.highlights
            : current.highlights.where((h) => !hit.contains(h.id)).toList(),
        strokes: strokes,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final interactive =
        widget.tool == MarkTool.pen || widget.tool == MarkTool.eraser;
    return LayoutBuilder(
      builder: (context, box) {
        final size = box.biggest;
        final paint = CustomPaint(
          size: size,
          painter: _MarksPainter(
            marks: widget.marks,
            draft: _draft,
            eraser: widget.tool == MarkTool.eraser,
          ),
        );
        if (!interactive) return IgnorePointer(child: paint);
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          // The stroke starts where the finger went down, not after the
          // drag slop.
          dragStartBehavior: DragStartBehavior.down,
          onPanStart: (d) {
            final p = _point(d.localPosition, size);
            if (widget.tool == MarkTool.eraser) {
              _erase(p);
            } else {
              setState(
                () => _draft = Stroke(
                  id: newMarkId(),
                  color: widget.penColor,
                  width: penWidth,
                  points: [p],
                ),
              );
            }
          },
          onPanUpdate: (d) {
            final p = _point(d.localPosition, size);
            if (widget.tool == MarkTool.eraser) {
              _erase(p);
            } else if (_draft != null &&
                _draft!.points.length < maxPointsPerStroke) {
              setState(
                () =>
                    _draft = _draft!.withPoints(appendPoint(_draft!.points, p)),
              );
            }
          },
          onPanEnd: (_) => _commit(),
          onPanCancel: _commit,
          child: paint,
        );
      },
    );
  }

  void _commit() {
    final stroke = _draft;
    if (stroke == null) return;
    setState(() => _draft = null);
    widget.onChange(
      (current) => current.strokes.length >= maxStrokes
          ? current
          : current.copyWith(strokes: [...current.strokes, stroke]),
    );
  }
}

class _MarksPainter extends CustomPainter {
  _MarksPainter({required this.marks, this.draft, this.eraser = false});

  final PageMarks marks;
  final Stroke? draft;
  final bool eraser;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    for (final h in marks.highlights) {
      final paint = Paint()
        ..color = markColor(h.color).withValues(alpha: 0.55)
        ..blendMode = BlendMode.multiply;
      for (final r in h.rects) {
        canvas.drawRect(
          Rect.fromLTWH(r.x * w, r.y * w, r.width * w, r.height * w),
          paint,
        );
      }
    }
    for (final s in [...marks.strokes, ?draft]) {
      canvas.drawPath(
        strokeToPath(s.points, w),
        Paint()
          ..color = markColor(s.color)
          ..style = PaintingStyle.stroke
          ..strokeWidth = (s.width * w).clamp(1.0, double.infinity)
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
    }
  }

  @override
  bool shouldRepaint(_MarksPainter old) =>
      !identical(old.marks, marks) || !identical(old.draft, draft);
}

/// The web's strokePath: quadratic curves through midpoints (a single tap
/// is a dot).
Path strokeToPath(List<StrokePoint> points, double scale) {
  final path = Path();
  if (points.isEmpty) return path;
  final p = [for (final (x, y) in points) Offset(x * scale, y * scale)];
  path.moveTo(p.first.dx, p.first.dy);
  if (p.length == 1) {
    path.lineTo(p.first.dx + 0.01, p.first.dy);
    return path;
  }
  for (var i = 1; i < p.length - 1; i++) {
    final mid = (p[i] + p[i + 1]) / 2;
    path.quadraticBezierTo(p[i].dx, p[i].dy, mid.dx, mid.dy);
  }
  path.lineTo(p.last.dx, p.last.dy);
  return path;
}
