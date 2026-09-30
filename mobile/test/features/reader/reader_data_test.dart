import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/api/http_client.dart';
import 'package:nirolearn/core/auth/session_store.dart';
import 'package:nirolearn/features/reader/data/pdf_range_source.dart';
import 'package:nirolearn/features/reader/domain/pdf_marks.dart';
import 'package:nirolearn/features/reader/presentation/marks_controller.dart';

import '../../helpers/bytes_range_adapter.dart';
import '../../helpers/fake_http.dart';

Dio apiDio(HttpClientAdapter adapter) => createApiDio(
  env: testEnv,
  sessions: MemorySessionStore(
    StoredSession(token: 'secret-token', expiresAt: DateTime.utc(2099)),
  ),
  onSessionRejected: () {},
  adapter: adapter,
);

void main() {
  group('marks rules match the web (lib/card-marks.ts, lib/pdf-marks.ts)', () {
    final fixture = jsonDecode(
      File('test/fixtures/pdf_marks_web.json').readAsStringSync(),
    ) as Map<String, Object?>;
    StrokePoint pt(Object? p) {
      final l = p! as List;
      return ((l[0] as num).toDouble(), (l[1] as num).toDouble());
    }

    test('constants', () {
      expect(fixture['eraserRadius'], eraserRadius);
      expect(fixture['penWidth'], penWidth);
      expect(fixture['maxHighlights'], maxPdfHighlights);
    });

    test('point thinning', () {
      for (final run in fixture['thinning']! as List) {
        final r = run as Map<String, Object?>;
        var points = <StrokePoint>[];
        for (final p in r['input']! as List) {
          points = appendPoint(points, pt(p));
        }
        expect(points, [for (final p in r['output']! as List) pt(p)]);
      }
    });

    test('eraser hit test', () {
      final strokes = [
        for (final s in fixture['strokes']! as List)
          Stroke.fromJson((s as Map).cast<String, Object?>()),
      ];
      for (final e in fixture['erase']! as List) {
        final c = e as Map<String, Object?>;
        expect(
          eraseStrokesAt(strokes, pt(c['point'])).map((s) => s.id).toList(),
          c['kept'],
          reason: 'at ${c['point']}',
        );
      }
    });

    test('highlight cap and empty highlights', () {
      final full = [
        for (var i = 0; i < maxPdfHighlights; i++)
          const PdfHighlight(
            id: 'h',
            color: '#fde68a',
            rects: [MarkRect(x: 0, y: 0, width: 0.1, height: 0.01)],
          ),
      ];
      const one = PdfHighlight(
        id: 'n',
        color: '#fde68a',
        rects: [MarkRect(x: 0, y: 0, width: 0.1, height: 0.01)],
      );
      expect(addPdfHighlight(full, one).length, fixture['capKept']);
      expect(
        addPdfHighlight(
          const [],
          const PdfHighlight(id: 'e', color: '#fde68a', rects: []),
        ).length,
        fixture['emptyRectsKept'],
      );
    });

    test('PDF text rects → the web\'s stored units (page width, top-left)', () {
      final r = markRectFromPdf(
        left: 59.5,
        top: 742,
        right: 297.5,
        bottom: 728,
        pageWidth: 595,
        pageHeight: 842,
      );
      expect(r.x, closeTo(0.1, 1e-9));
      expect(r.y, closeTo(100 / 595, 1e-9));
      expect(r.width, closeTo(0.4, 1e-9));
      expect(r.height, closeTo(14 / 595, 1e-9));
      // Two fragments on one line merge; the next line stays apart.
      final merged = mergeLineRects([
        const MarkRect(x: 0.1, y: 0.2, width: 0.1, height: 0.02),
        const MarkRect(x: 0.25, y: 0.2005, width: 0.1, height: 0.02),
        const MarkRect(x: 0.1, y: 0.25, width: 0.3, height: 0.02),
      ]);
      expect(merged, hasLength(2));
      expect(merged.first.width, closeTo(0.25, 1e-9));
    });
  });

  group('PdfRangeSource', () {
    final pdf = Uint8List.fromList(List.generate(2600, (i) => i % 251));

    PdfRangeSource source(
      BytesRangeAdapter adapter, {
      int maxCached = 1 << 20,
    }) => PdfRangeSource(
      dio: apiDio(adapter),
      fileKey: 'books/u1/my book.pdf',
      chunkSize: 1000,
      maxCachedBytes: maxCached,
      backoff: (_) => Duration.zero,
    );

    test('size from Content-Range; reads span chunks; cache hits', () async {
      final adapter = BytesRangeAdapter(pdf);
      final s = source(adapter);
      expect(await s.open(), 2600);
      final buffer = Uint8List(700);
      expect(await s.read(buffer, 800, 700), 700);
      expect(buffer, pdf.sublist(800, 1500));
      expect(adapter.ranges, ['0-0', '0-999', '1000-1999']);
      // Same bytes again: no new request.
      await s.read(Uint8List(100), 900, 100);
      expect(adapter.requests, hasLength(3));
      // Last chunk is short; reading past the end stops there.
      final tail = Uint8List(500);
      expect(await s.read(tail, 2400, 500), 200);
      expect(adapter.ranges.last, '2000-2599');
    });

    test(
      'the key is encoded in the path, the session only goes there',
      () async {
        final adapter = BytesRangeAdapter(pdf);
        await source(adapter).open();
        final r = adapter.requests.single;
        expect(r.uri.host, 'api.example.test');
        expect(r.uri.path, '/api/files/books/u1/my%20book.pdf');
        expect(r.uri.query, 'stream=1');
        expect('${r.headers['cookie']}', contains('secret-token'));
      },
    );

    test('memory stays bounded (least recently used chunks dropped)', () async {
      final adapter = BytesRangeAdapter(pdf);
      final s = source(adapter, maxCached: 2000);
      await s.open();
      await s.read(Uint8List(2600), 0, 2600);
      expect(s.cachedBytes, lessThanOrEqualTo(2000));
      expect(s.bytesFetched, 2600); // chunks only (not the size probe)
    });

    test('concurrent reads of one chunk share one request', () async {
      final adapter = BytesRangeAdapter(
        pdf,
        delay: const Duration(milliseconds: 5),
      );
      final s = source(adapter);
      await s.open();
      await Future.wait([
        s.read(Uint8List(10), 0, 10),
        s.read(Uint8List(10), 500, 10),
      ]);
      expect(adapter.ranges.where((r) => r == '0-999'), hasLength(1));
    });

    test('storage hiccup (502) is retried; no access (404) is not', () async {
      final adapter = BytesRangeAdapter(pdf)..failures.add(502);
      final s = source(adapter);
      expect(await s.open(), 2600);
      expect(adapter.requests, hasLength(2));

      final denied = BytesRangeAdapter(pdf)..failures.add(404);
      await expectLater(
        source(denied).open(),
        throwsA(isA<NotFoundException>()),
      );
      expect(denied.requests, hasLength(1));
    });
  });

  group('MarksController', () {
    const stroke = Stroke(
      id: 's',
      color: '#e11d48',
      width: penWidth,
      points: [(0.1, 0.1)],
    );

    test('saves a page 700 ms after the last change, once', () {
      fakeAsync((async) {
        final saved = <String>[];
        final c = MarksController(
          save: (page, marks) async =>
              saved.add('$page:${marks.strokes.length}'),
        );
        c.update(3, (m) => m.copyWith(strokes: [stroke]));
        async.elapse(const Duration(milliseconds: 400));
        c.update(3, (m) => m.copyWith(strokes: [...m.strokes, stroke]));
        async.elapse(const Duration(milliseconds: 600));
        expect(saved, isEmpty);
        async.elapse(const Duration(milliseconds: 200));
        expect(saved, ['3:2']);
        expect(c.state, SaveState.saved);
      });
    });

    test('a failed save says so and is retried by the next flush', () {
      fakeAsync((async) {
        var fail = true;
        final saved = <int>[];
        final c = MarksController(
          save: (page, _) async {
            if (fail) throw Exception('offline');
            saved.add(page);
          },
        );
        c.update(1, (m) => m.copyWith(strokes: [stroke]));
        async.elapse(const Duration(seconds: 1));
        expect(c.state, SaveState.error);
        expect(c.hasUnsaved, isTrue);
        fail = false;
        c.flushAll();
        async.flushMicrotasks();
        expect(saved, [1]);
        expect(c.hasUnsaved, isFalse);
      });
    });

    test('no change → nothing scheduled', () {
      fakeAsync((async) {
        final saved = <int>[];
        final c = MarksController(save: (p, _) async => saved.add(p));
        c.update(1, (m) => m);
        async.elapse(const Duration(seconds: 2));
        expect(saved, isEmpty);
      });
    });
  });
}
