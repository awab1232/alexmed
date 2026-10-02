import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/api/http_client.dart';
import 'package:nirolearn/core/api/rest_client.dart';
import 'package:nirolearn/core/api/trpc_client.dart';
import 'package:nirolearn/core/auth/session_store.dart';
import 'package:nirolearn/core/upload/pdf_upload.dart';
import 'package:nirolearn/features/books/data/book_models.dart';
import 'package:nirolearn/features/books/data/book_repository.dart';

import '../../helpers/fake_http.dart';
import '../library/library_repository_test.dart' show ok;

/// books.get as the server returns it (getBookForUser + access).
Map<String, Object?> bookJson({
  String status = 'processing',
  List<String> chapters = const ['complete', 'processing', 'pending'],
  String role = 'owner',
}) => {
  'book': {
    'id': 'b1',
    'userId': 'u1',
    'subjectId': 's1',
    'fileName': 'Pharmacology_Lippincott.pdf',
    'fileKey': 'books/u1/x.pdf',
    'pageCount': 120,
    'sourceType': 'study_book',
    'profile': 'medical',
    'chapterDetectionMethod': 'headings',
    'chapterDetectionConfidence': 'low',
    'status': status,
    'extractionError': null,
    'createdAt': '2026-09-28T10:00:00.000Z',
  },
  'chapters': [
    for (final (i, s) in chapters.indexed)
      {
        'id': 'c$i',
        'orderIndex': i,
        'title': 'Chapter ${i + 1}',
        'startPage': i * 40 + 1,
        'endPage': (i + 1) * 40,
        'status': s,
        'errorMessage': s == 'failed' ? 'تعذر التحليل' : null,
      },
  ],
  'totalCards': 84,
  'totalMcqs': 40,
  'access': {'role': role, 'ownerName': 'ليلى', 'ownerUsername': 'layla'},
};

void main() {
  late FakeAdapter api;
  late FakeAdapter storage;
  late Directory dir;
  final sessions = MemorySessionStore(
    StoredSession(token: 't', expiresAt: DateTime.utc(2099)),
  );

  setUp(() => dir = Directory.systemTemp.createTempSync('nl_book'));
  tearDown(() => dir.deleteSync(recursive: true));

  BookRepository repo() {
    final dio = createApiDio(
      env: testEnv,
      sessions: sessions,
      onSessionRejected: () {},
      adapter: api,
    );
    return BookRepository(
      trpc: TrpcClient(dio),
      rest: RestClient(dio),
      uploader: PdfUploader(
        api: RestClient(dio),
        storage: Dio(BaseOptions(validateStatus: (_) => true))
          ..httpClientAdapter = storage,
      ),
    );
  }

  group('upload (the web\'s app/books/upload flow)', () {
    late PickedPdf pdf;
    setUp(() async {
      final file = File('${dir.path}/Lippincott.pdf')
        ..writeAsBytesSync(utf8.encode('%PDF-1.7 book'));
      pdf = await checkPdf(file);
      storage = FakeAdapter((_, _) => (status: 200, body: ''));
    });

    test('upload-url → PUT → extract-and-plan with profile + folder', () async {
      api = FakeAdapter((options, _) {
        return switch (options.uri.path) {
          '/api/books/upload-url' => (
            status: 200,
            body: jsonEncode({
              'key': 'books/u1/k.pdf',
              'uploadUrl': 'https://bucket.r2.test/k.pdf?sig=1',
            }),
          ),
          '/api/books/extract-and-plan' => (
            status: 200,
            body: jsonEncode({'bookId': 'b9'}),
          ),
          _ => (status: 404, body: '{}'),
        };
      });
      final id = await repo().upload(
        pdf: pdf,
        profile: 'medical',
        subjectId: 's1',
      );
      expect(id, 'b9');
      expect(api.requests.map((r) => r.uri.path), [
        '/api/books/upload-url',
        '/api/books/extract-and-plan',
      ]);
      expect(jsonDecode(api.bodies.last), {
        'key': 'books/u1/k.pdf',
        'fileName': 'Lippincott.pdf',
        'profile': 'medical',
        'subjectId': 's1',
      });
      expect(storage.requests.single.method, 'PUT');
    });

    test('daily study-file quota → PlanLimitException, no upload', () async {
      api = FakeAdapter(
        (_, _) => (
          status: 429,
          body: jsonEncode({
            'error': 'وصلت إلى حد ملفات الدراسة اليومي',
            'code': 'DAILY_LIMIT',
            'details': {'code': 'DAILY_LIMIT', 'planName': 'Free'},
          }),
        ),
      );
      await expectLater(
        repo().upload(pdf: pdf, profile: 'general', subjectId: 's1'),
        throwsA(isA<PlanLimitException>()),
      );
      expect(storage.requests, isEmpty);
    });

    test('server refuses the plan step → its Arabic message', () async {
      api = FakeAdapter(
        (options, _) => options.uri.path == '/api/books/upload-url'
            ? (
                status: 200,
                body: jsonEncode({
                  'key': 'k',
                  'uploadUrl': 'https://r2.test/k',
                }),
              )
            : (
                status: 400,
                body: jsonEncode({'error': 'اختر مجلدًا لهذا الملف أولًا.'}),
              ),
      );
      await expectLater(
        repo().upload(pdf: pdf, profile: 'general', subjectId: 's1'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            'اختر مجلدًا لهذا الملف أولًا.',
          ),
        ),
      );
    });
  });

  group('reads', () {
    test('books.get → detail with chapters, totals, access', () async {
      api = FakeAdapter(
        (_, _) => (
          status: 200,
          body: ok(
            bookJson(),
            dates: {
              'book.createdAt': ['Date'],
            },
          ),
        ),
      );
      final book = await repo().get('b1');
      expect(api.requests.single.uri.path, '/api/trpc/books.get');
      expect(book.title, 'Pharmacology Lippincott');
      expect(book.status, BookStatus.processing);
      expect(book.chapters, hasLength(3));
      expect(book.totalCards, 84);
      expect(book.hasFile, isTrue);
      expect(book.lowConfidenceSplit, isTrue);
      expect(book.createdAt, DateTime.utc(2026, 9, 28, 10));
      expect(book.isOwner, isTrue);
    });

    test(
      'examFocus.get: null and a shared "not created" both → null',
      () async {
        api = FakeAdapter((_, _) => (status: 200, body: ok(null)));
        expect(await repo().examFocus('b1'), isNull);
        api = FakeAdapter(
          (_, _) => (
            status: 412,
            body: jsonEncode({
              'error': {
                'json': {
                  'message':
                      'لم يُنشئ صاحب الملف بطاقات Exam Focus لهذا الملف بعد.',
                  'code': -32012,
                  'data': {'code': 'PRECONDITION_FAILED', 'httpStatus': 412},
                },
              },
            }),
          ),
        );
        expect(await repo().examFocus('b1'), isNull);
      },
    );

    test('retries send the same inputs as the web', () async {
      api = FakeAdapter((_, _) => (status: 200, body: ok({'success': true})));
      final r = repo();
      await r.retryChapter('c1');
      await r.retryExtraction('b1');
      await r.retryPageText('p7');
      await r.startAnalysis('b1');
      await r.resumeAnalysis('b1');
      expect(api.requests.map((q) => q.uri.path.split('/').last), [
        'books.retryChapter',
        'books.retryExtraction',
        'books.retryPageText',
        'books.startChapterAnalysis',
        'books.resumeChapterAnalysis',
      ]);
      expect(api.bodies.map(jsonDecode).map((b) => (b as Map)['json']), [
        {'chapterId': 'c1'},
        {'bookId': 'b1'},
        {'pageId': 'p7'},
        {'bookId': 'b1'},
        {'bookId': 'b1'},
      ]);
    });
  });

  group('derived states (same rules as app/books/[bookId]/page.tsx)', () {
    BookDetail make(String status, List<String> chapters, {String? role}) =>
        BookDetail.fromJson(
          bookJson(status: status, chapters: chapters, role: role ?? 'owner'),
        );

    test('extracting: no chapters yet, keeps polling', () {
      final b = make('extracting', const []);
      expect(b.isExtracting, isTrue);
      expect(b.hasChapters, isFalse);
      expect(b.needsPolling, isTrue);
    });

    test('all chapters pending → locked until the student starts', () {
      final b = make('processing', const ['pending', 'pending']);
      expect(b.toolsState, StudyToolsState.locked);
      expect(b.analysisInFlight, isFalse);
    });

    test('some done, some running → generating, in flight, 33%', () {
      final b = make('processing', const ['complete', 'processing', 'pending']);
      expect(b.toolsState, StudyToolsState.generating);
      expect(b.analysisInFlight, isTrue);
      expect(b.analysisPercent, 33);
    });

    test('a shared book never asks the server to resume', () {
      final b = make('processing', const [
        'complete',
        'processing',
      ], role: 'shared');
      expect(b.isOwner, isFalse);
      expect(b.analysisInFlight, isFalse);
    });

    test(
      'complete / failed chapters → ready; terminal statuses stop polling',
      () {
        final b = make('partial_failed', const ['complete', 'failed']);
        expect(b.toolsState, StudyToolsState.ready);
        expect(b.failedChapters.single.id, 'c1');
        expect(b.needsPolling, isFalse);
        expect(make('complete', const ['complete']).needsPolling, isFalse);
        expect(make('failed', const []).needsPolling, isFalse);
      },
    );
  });
}
