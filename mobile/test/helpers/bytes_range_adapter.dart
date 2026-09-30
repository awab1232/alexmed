import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Serves [bytes] to HTTP Range requests like the server's /api/files
/// `?stream=1` proxy (206 + Content-Range), and records every request.
class BytesRangeAdapter implements HttpClientAdapter {
  BytesRangeAdapter(this.bytes, {this.delay = Duration.zero});

  final Uint8List bytes;
  final Duration delay;
  final requests = <RequestOptions>[];

  /// Status to answer with for the next N requests (e.g. 502 to test retry).
  final failures = <int>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (delay > Duration.zero) await Future<void>.delayed(delay);
    if (failures.isNotEmpty) {
      return ResponseBody.fromString(
        jsonEncode({'error': 'Storage error'}),
        failures.removeAt(0),
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    }
    final range = options.headers['Range'] as String? ?? '';
    final match = RegExp(r'bytes=(\d+)-(\d+)').firstMatch(range);
    final from = int.parse(match!.group(1)!);
    final to = int.parse(match.group(2)!).clamp(0, bytes.length - 1);
    return ResponseBody.fromBytes(
      bytes.sublist(from, to + 1),
      206,
      headers: {
        'content-range': ['bytes $from-$to/${bytes.length}'],
        Headers.contentTypeHeader: ['application/pdf'],
      },
    );
  }

  @override
  void close({bool force = false}) {}

  /// Bytes actually sent (all ranges).
  int get bytesServed => ranges.fold(0, (sum, r) {
    final parts = r.split('-').map(int.parse).toList();
    final end = parts[1].clamp(0, bytes.length - 1);
    return sum + end - parts[0] + 1;
  });

  /// Byte ranges requested, as "from-to" (the one-byte size probe included).
  List<String> get ranges => [
    for (final r in requests)
      (r.headers['Range'] as String).replaceFirst('bytes=', ''),
  ];
}

/// A small but valid PDF with [pages] pages, each saying "Page N" plus a
/// line of body text — built by hand (correct xref offsets) so tests need
/// no binary fixture.
Uint8List buildTestPdf(
  int pages, {
  String bodyText = 'Renal physiology notes',
  int padBytes = 0,
}) {
  final objects = <String>[];
  final pageIds = <int>[];
  // 1 catalog, 2 pages tree, 3 font; pages start at 4 (page, content).
  for (var i = 0; i < pages; i++) {
    pageIds.add(4 + i * 2);
  }
  objects.add('<< /Type /Catalog /Pages 2 0 R >>');
  objects.add(
    '<< /Type /Pages /Kids [${pageIds.map((id) => '$id 0 R').join(' ')}] '
    '/Count $pages >>',
  );
  objects.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (var i = 0; i < pages; i++) {
    final contentId = pageIds[i] + 1;
    objects.add(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] '
      '/Resources << /Font << /F1 3 0 R >> >> /Contents $contentId 0 R >>',
    );
    final stream =
        'BT /F1 28 Tf 72 760 Td (Page ${i + 1}) Tj ET\n'
        'BT /F1 14 Tf 72 720 Td ($bodyText ${i + 1}) Tj ET';
    objects.add('<< /Length ${stream.length} >>\nstream\n$stream\nendstream');
  }
  final out = BytesBuilder(copy: false)..add(latin1.encode('%PDF-1.4\n'));
  final offsets = <int>[];
  for (var i = 0; i < objects.length; i++) {
    offsets.add(out.length);
    out.add(latin1.encode('${i + 1} 0 obj\n${objects[i]}\nendobj\n'));
  }
  // An unreferenced object of [padBytes] (like a scanned book's images),
  // written as bytes: a reader never needs it to show a page.
  var count = objects.length;
  if (padBytes > 0) {
    count++;
    offsets.add(out.length);
    out
      ..add(latin1.encode('$count 0 obj\n<< /Length $padBytes >>\nstream\n'))
      ..add(Uint8List(padBytes)..fillRange(0, padBytes, 32))
      ..add(latin1.encode('\nendstream\nendobj\n'));
  }
  final xref = out.length;
  final tail = StringBuffer('xref\n0 ${count + 1}\n0000000000 65535 f \n');
  for (final o in offsets) {
    tail.write('${o.toString().padLeft(10, '0')} 00000 n \n');
  }
  tail.write(
    'trailer\n<< /Size ${count + 1} /Root 1 0 R >>\n'
    'startxref\n$xref\n%%EOF\n',
  );
  out.add(latin1.encode(tail.toString()));
  return out.takeBytes();
}
