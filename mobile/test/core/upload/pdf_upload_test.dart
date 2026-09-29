import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/api/http_client.dart';
import 'package:nirolearn/core/api/rest_client.dart';
import 'package:nirolearn/core/auth/session_store.dart';
import 'package:nirolearn/core/upload/pdf_upload.dart';

import '../../helpers/fake_http.dart';

void main() {
  late Directory dir;
  setUp(() => dir = Directory.systemTemp.createTempSync('nl_pdf'));
  tearDown(() => dir.deleteSync(recursive: true));

  File write(String name, List<int> bytes) =>
      File('${dir.path}/$name')..writeAsBytesSync(bytes);

  group('checkPdf', () {
    test('accepts a real PDF header', () async {
      final pdf = await checkPdf(write('a.pdf', utf8.encode('%PDF-1.7 body')));
      expect(pdf.name, 'a.pdf');
      expect(pdf.size, 13);
    });

    test('rejects a renamed file, an empty file, a non-.pdf name', () async {
      await expectLater(
        checkPdf(write('fake.pdf', utf8.encode('<html>no</html>'))),
        throwsA(isA<PdfRejected>()),
      );
      await expectLater(
        checkPdf(write('empty.pdf', const [])),
        throwsA(isA<PdfRejected>()),
      );
      await expectLater(
        checkPdf(write('a.docx', utf8.encode('%PDF-1.7'))),
        throwsA(isA<PdfRejected>()),
      );
    });

    test('rejects a file over the plan limit', () async {
      final big = write('big.pdf', [
        ...utf8.encode('%PDF-'),
        ...List.filled(2 * 1024 * 1024, 32),
      ]);
      await expectLater(
        checkPdf(big, maxFileSizeMb: 1),
        throwsA(
          isA<PdfRejected>().having((e) => e.message, 'm', contains('1 MB')),
        ),
      );
    });
  });

  group('PdfUploader', () {
    late PickedPdf pdf;
    late FakeAdapter api;
    late FakeAdapter storage;
    var urls = 0;

    PdfUploader uploader() {
      final apiDio = createApiDio(
        env: testEnv,
        sessions: MemorySessionStore(
          StoredSession(token: 'tok', expiresAt: DateTime.utc(2099)),
        ),
        onSessionRejected: () {},
        adapter: api,
      );
      final storageDio = Dio(BaseOptions(validateStatus: (_) => true))
        ..httpClientAdapter = storage;
      return PdfUploader(api: RestClient(apiDio), storage: storageDio);
    }

    setUp(() async {
      pdf = await checkPdf(write('q.pdf', utf8.encode('%PDF-1.4 hello')));
      urls = 0;
      api = FakeAdapter((options, _) {
        urls++;
        return (
          status: 200,
          body: jsonEncode({
            'key': 'uploads/u1/q.pdf',
            'uploadUrl': 'https://bucket.r2.test/q.pdf?sig=$urls',
          }),
        );
      });
    });

    test(
      'asks for a URL, PUTs the bytes, reports progress, returns the key',
      () async {
        storage = FakeAdapter((_, _) => (status: 200, body: ''));
        final progress = <double>[];
        final key = await uploader().upload(
          pdf,
          uploadUrlPath: '/api/pdf/upload-url',
          onProgress: progress.add,
        );
        expect(key, 'uploads/u1/q.pdf');
        expect(jsonDecode(api.bodies.single), {
          'fileName': 'q.pdf',
          'fileSize': pdf.size,
          'contentType': 'application/pdf',
        });
        final put = storage.requests.single;
        expect(put.method, 'PUT');
        expect(put.headers['content-type'], 'application/pdf');
        // The session never goes to storage.
        expect(put.headers.containsKey('cookie'), isFalse);
        expect(storage.bodies.single, '%PDF-1.4 hello');
        expect(progress.last, 1);
      },
    );

    test('network drop → retried, then succeeds', () async {
      var calls = 0;
      storage = FakeAdapter((_, _) => (status: 200, body: ''));
      final flaky = _FlakyAdapter(storage, failFirst: 1, onCall: () => calls++);
      final apiDio = createApiDio(
        env: testEnv,
        sessions: MemorySessionStore(),
        onSessionRejected: () {},
        adapter: api,
      );
      final up = PdfUploader(
        api: RestClient(apiDio),
        storage: Dio(BaseOptions(validateStatus: (_) => true))
          ..httpClientAdapter = flaky,
      );
      final key = await up.upload(
        pdf,
        uploadUrlPath: '/api/pdf/upload-url',
        backoff: (_) => Duration.zero,
      );
      expect(key, 'uploads/u1/q.pdf');
      expect(calls, 2);
    });

    test('expired URL (403) → a fresh URL is signed and used', () async {
      var n = 0;
      storage = FakeAdapter((_, _) => (status: ++n == 1 ? 403 : 200, body: ''));
      await uploader().upload(
        pdf,
        uploadUrlPath: '/api/pdf/upload-url',
        backoff: (_) => Duration.zero,
      );
      expect(urls, 2);
      expect(storage.requests.last.uri.query, 'sig=2');
    });

    test('keeps failing → a clear error after 3 attempts', () async {
      storage = FakeAdapter((_, _) => (status: 500, body: ''));
      await expectLater(
        uploader().upload(
          pdf,
          uploadUrlPath: '/api/pdf/upload-url',
          backoff: (_) => Duration.zero,
        ),
        throwsA(isA<ServerException>()),
      );
      expect(storage.requests, hasLength(PdfUploader.maxAttempts));
    });

    test('plan size limit from the server stops before uploading', () async {
      api = FakeAdapter(
        (_, _) => (
          status: 413,
          body: jsonEncode({
            'error': 'الملف أكبر من حد باقتك',
            'code': 'FILE_SIZE_LIMIT',
            'details': {'code': 'FILE_SIZE_LIMIT', 'planName': 'Free'},
          }),
        ),
      );
      storage = FakeAdapter((_, _) => (status: 200, body: ''));
      await expectLater(
        uploader().upload(pdf, uploadUrlPath: '/api/pdf/upload-url'),
        throwsA(isA<PlanLimitException>()),
      );
      expect(storage.requests, isEmpty);
    });
  });
}

/// Throws a connection error for the first [failFirst] calls.
class _FlakyAdapter implements HttpClientAdapter {
  _FlakyAdapter(this.inner, {required this.failFirst, required this.onCall});

  final HttpClientAdapter inner;
  final void Function() onCall;
  int failFirst;

  @override
  Future<ResponseBody> fetch(options, requestStream, cancelFuture) async {
    onCall();
    if (failFirst-- > 0) {
      await requestStream?.drain<void>();
      throw DioException.connectionError(requestOptions: options, reason: 'x');
    }
    return inner.fetch(options, requestStream, cancelFuture);
  }

  @override
  void close({bool force = false}) {}
}
