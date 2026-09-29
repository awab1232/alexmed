import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/core/upload/pdf_upload.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/books/data/book_models.dart';
import 'package:nirolearn/features/books/data/book_repository.dart';
import 'package:nirolearn/features/books/presentation/book_screen.dart';
import 'package:nirolearn/features/books/presentation/book_upload_screen.dart';
import 'package:nirolearn/features/library/data/library_models.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';
import 'package:nirolearn/l10n/app_localizations.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/fake_http.dart';
import 'book_repository_test.dart' show bookJson;

class FakeBookRepository implements BookRepository {
  FakeBookRepository(this.book);

  BookDetail book;
  CoverageReport? coverageReport;
  CoverageDetail? detail;
  ExamFocusTile? examFocusTile;
  List<BookPage> pageList = const [];
  final calls = <String>[];

  int count(String call) => calls.where((c) => c == call).length;

  @override
  Future<String> upload({
    required PickedPdf pdf,
    required String profile,
    required String subjectId,
    void Function(double progress)? onProgress,
    CancelToken? cancelToken,
  }) async {
    calls.add('upload:$profile:$subjectId:${pdf.name}');
    onProgress?.call(0.5);
    onProgress?.call(1);
    return 'b9';
  }

  @override
  Future<BookDetail> get(String id) async {
    calls.add('get');
    return book;
  }

  @override
  Future<CoverageReport?> coverage(String bookId) async {
    calls.add('coverage');
    return coverageReport;
  }

  @override
  Future<CoverageDetail?> coverageDetail(String bookId) async {
    calls.add('detail');
    return detail;
  }

  @override
  Future<ExamFocusTile?> examFocus(String bookId) async {
    calls.add('examFocus');
    return examFocusTile;
  }

  @override
  Future<List<BookPage>> pages(String bookId) async {
    calls.add('pages');
    return pageList;
  }

  @override
  Future<void> startAnalysis(String bookId) async {
    calls.add('start');
    book = BookDetail.fromJson(
      bookJson(chapters: const ['processing', 'pending', 'pending']),
    );
  }

  @override
  Future<void> resumeAnalysis(String bookId) async => calls.add('resume');

  @override
  Future<void> retryChapter(String chapterId) async =>
      calls.add('retryChapter:$chapterId');

  @override
  Future<void> retryExtraction(String bookId) async =>
      calls.add('retryExtraction');

  @override
  Future<void> retryPageText(String pageId) async =>
      calls.add('retryPage:$pageId');

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

BookDetail book(
  String status,
  List<String> chapters, {
  String role = 'owner',
}) => BookDetail.fromJson(
  bookJson(status: status, chapters: chapters, role: role),
);

Future<void> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  required FakeBookRepository books,
  FakeLibraryRepository? library,
  String? pickedPath,
}) async {
  tester.view.physicalSize =
      const Size(412, 2000) * tester.view.devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => screen),
      GoRoute(
        path: '/books/:id',
        builder: (_, state) =>
            Scaffold(body: Text('BOOK ${state.pathParameters['id']}')),
        routes: [
          GoRoute(
            path: 'study',
            builder: (_, state) => Scaffold(
              body: Text('STUDY ${state.uri.queryParameters['tool']}'),
            ),
          ),
        ],
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      retry: noAutomaticRetry,
      overrides: [
        envProvider.overrideWithValue(testEnv),
        sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
        bookRepositoryProvider.overrideWithValue(books),
        libraryRepositoryProvider.overrideWithValue(
          library ?? FakeLibraryRepository(),
        ),
        accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
        pdfPathPickerProvider.overrideWithValue(() async => pickedPath),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('ar'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        theme: buildNiroTheme(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  group('upload screen', () {
    late Directory dir;
    late String pdfPath;
    setUp(() {
      dir = Directory.systemTemp.createTempSync('nl_up');
      pdfPath = (File(
        '${dir.path}/Lippincott_Pharmacology.pdf',
      )..writeAsBytesSync(utf8.encode('%PDF-1.7 book'))).path;
    });
    tearDown(() => dir.deleteSync(recursive: true));

    Future<void> pick(WidgetTester tester) async {
      // checkPdf reads the real file: run it outside the fake clock.
      await tester.runAsync(() async {
        await tester.tap(find.text('اختر ملف PDF'));
        await Future<void>.delayed(const Duration(milliseconds: 300));
      });
      await tester.pumpAndSettle();
    }

    NlButton submit(WidgetTester tester) =>
        tester.widget<NlButton>(find.widgetWithText(NlButton, 'حوّل إلى فصول'));

    testWidgets(
      'from a folder: folder + its type preselected; upload opens the book',
      (tester) async {
        final books = FakeBookRepository(book('processing', const []));
        final library = FakeLibraryRepository()
          ..folders = [
            const Subject(id: 's1', name: 'أدوية', type: 'medical'),
            const Subject(id: 's2', name: 'English', type: 'english'),
          ];
        await pumpScreen(
          tester,
          const BookUploadScreen(subjectId: 's1'),
          books: books,
          library: library,
          pickedPath: pdfPath,
        );
        await tester.pumpAndSettle();
        expect(find.textContaining('أدوية'), findsWidgets);
        // The folder type is the preselected profile (ink pill, white text).
        expect(
          tester.widget<Text>(find.text('طبي')).style?.color,
          Colors.white,
        );
        expect(submit(tester).onPressed, isNull); // no file yet

        await pick(tester);
        expect(
          find.textContaining('Lippincott_Pharmacology.pdf'),
          findsOneWidget,
        );
        expect(submit(tester).onPressed, isNotNull);

        // The student's own choice wins over the folder type.
        await tester.tap(find.text('برمجة'));
        await tester.pump();
        await tester.tap(find.widgetWithText(NlButton, 'حوّل إلى فصول'));
        await tester.pumpAndSettle();
        expect(
          books.calls.single,
          'upload:programming:s1:Lippincott_Pharmacology.pdf',
        );
        expect(find.text('BOOK b9'), findsOneWidget);
      },
    );

    testWidgets('no folder yet → submit disabled even with a file', (
      tester,
    ) async {
      final books = FakeBookRepository(book('processing', const []));
      await pumpScreen(
        tester,
        const BookUploadScreen(),
        books: books,
        library: FakeLibraryRepository()
          ..folders = [const Subject(id: 's1', name: 'أدوية', type: 'medical')],
        pickedPath: pdfPath,
      );
      await tester.pumpAndSettle();
      await pick(tester);
      expect(submit(tester).onPressed, isNull);
      // Plan quota from billing.mine: 1 of 1 used today.
      expect(find.text('متبقي اليوم 0 من 1 ملفات دراسة'), findsOneWidget);
    });

    testWidgets('same name already in the library → notice + open it', (
      tester,
    ) async {
      final books = FakeBookRepository(book('processing', const []));
      final library = FakeLibraryRepository()
        ..folders = [const Subject(id: 's1', name: 'أدوية', type: 'medical')]
        ..bookList = [
          const BookSummary(id: 'b1', fileName: 'Lippincott Pharmacology.PDF'),
        ];
      await pumpScreen(
        tester,
        const BookUploadScreen(subjectId: 's1'),
        books: books,
        library: library,
        pickedPath: pdfPath,
      );
      await tester.pumpAndSettle();
      await pick(tester);
      expect(find.text('عندك ملف بنفس الاسم'), findsOneWidget);
      // Uploading anyway stays possible.
      expect(submit(tester).onPressed, isNotNull);
      await tester.tap(find.text('افتح الموجود'));
      await tester.pumpAndSettle();
      expect(find.text('BOOK b1'), findsOneWidget);
    });

    testWidgets('a renamed non-PDF is refused before any upload', (
      tester,
    ) async {
      final fake = File('${dir.path}/notes.pdf')..writeAsStringSync('<html>');
      final books = FakeBookRepository(book('processing', const []));
      await pumpScreen(
        tester,
        const BookUploadScreen(subjectId: 's1'),
        books: books,
        pickedPath: fake.path,
      );
      await tester.pumpAndSettle();
      await pick(tester);
      expect(find.text('هذا الملف ليس PDF صالحًا.'), findsOneWidget);
      expect(books.calls, isEmpty);
    });
  });

  group('book screen', () {
    Future<FakeBookRepository> open(
      WidgetTester tester,
      BookDetail detail, {
      CoverageReport? coverage,
      CoverageDetail? coverageDetail,
      List<BookPage> pages = const [],
      ExamFocusTile? examFocus,
    }) async {
      final books = FakeBookRepository(detail)
        ..coverageReport = coverage
        ..detail = coverageDetail
        ..pageList = pages
        ..examFocusTile = examFocus;
      await pumpScreen(
        tester,
        const BookScreen(bookId: 'b1', pollInterval: Duration(seconds: 1)),
        books: books,
      );
      await tester.pump();
      return books;
    }

    testWidgets('reading pages: stages shown, polling continues', (
      tester,
    ) async {
      final books = await open(tester, book('extracting', const []));
      expect(find.text('Pharmacology Lippincott'), findsOneWidget);
      expect(
        find.text('أدوات الدراسة تظهر هنا بعد ما نخلّص قراءة صفحات الملف.'),
        findsOneWidget,
      );
      expect(find.text('قراءة الصفحات'), findsOneWidget);
      expect(books.count('get'), 1);
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(books.count('get'), 2);
    });

    testWidgets('not started: one tap prepares all tools', (tester) async {
      final books = await open(
        tester,
        book('processing', const ['pending', 'pending']),
      );
      expect(find.text('بانتظار اختيارك'), findsOneWidget);
      await tester.tap(find.widgetWithText(NlButton, 'جهّز أدوات الدراسة'));
      await tester.pump();
      await tester.pump();
      expect(books.calls, contains('start'));
      expect(find.text('قيد التجهيز'), findsNWidgets(5));
      // Parts still being analysed are listed while it runs.
      expect(find.text('Chapter 1'), findsOneWidget);
    });

    testWidgets('analysis running: asks the server to resume stalled parts', (
      tester,
    ) async {
      final books = await open(
        tester,
        book('processing', const ['complete', 'processing']),
      );
      expect(books.count('resume'), 1);
      // Not again within the minute, even though it keeps polling.
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(books.count('get'), 2);
      expect(books.count('resume'), 1);
    });

    testWidgets('ready: tools open the study screens; polling stops', (
      tester,
    ) async {
      final books = await open(
        tester,
        book('complete', const ['complete', 'complete']),
        coverage: const CoverageReport(totalPages: 120, pagesWithVisuals: 9),
        coverageDetail: const CoverageDetail(
          totalPages: 120,
          processedPages: 120,
          coverage: 100,
          complete: true,
        ),
        examFocus: const ExamFocusTile(status: 'complete', totalCards: 42),
      );
      expect(find.text('جاهز للدراسة'), findsOneWidget);
      expect(find.text('42 معلومة مركّزة، مرتبة حسب الأهمية'), findsOneWidget);
      expect(find.text('مكتملة'), findsOneWidget);
      // Nothing left to wait for.
      await tester.pump(const Duration(seconds: 10));
      expect(books.count('get'), 1);
      // No failed page → the heavy page list is never fetched.
      expect(books.count('pages'), 0);

      await tester.tap(find.text('بطاقات'));
      await tester.pumpAndSettle();
      expect(find.text('STUDY cards'), findsOneWidget);
    });

    testWidgets('partly failed: banner, failed page + chapter retries', (
      tester,
    ) async {
      final books = await open(
        tester,
        book('partial_failed', const ['complete', 'failed']),
        coverageDetail: const CoverageDetail(
          totalPages: 80,
          processedPages: 79,
          coverage: 99,
          failedPages: [7],
        ),
        pages: const [
          BookPage(id: 'p7', pageNumber: 7, textFailed: true),
          BookPage(id: 'p8', pageNumber: 8, textFailed: false),
        ],
      );
      expect(
        find.text(
          'اكتمل معظم الكتاب، لكن 1 فصل تعذّر تحليله و1 صفحة تعذّرت قراءتها. يمكنك إعادة المحاولة أدناه.',
        ),
        findsOneWidget,
      );
      expect(find.text('صفحة 7'), findsOneWidget);
      // A permanently failed page: the coverage stage shows failed, not a
      // spinner that never ends.
      expect(
        find.descendant(
          of: find
              .ancestor(
                of: find.text('التحقق من اكتمال التغطية'),
                matching: find.byType(Row),
              )
              .first,
          matching: find.byType(CircularProgressIndicator),
        ),
        findsNothing,
      );
      expect(find.text('صفحة 8'), findsNothing);
      await tester.tap(find.widgetWithText(NlButton, 'أعد المحاولة').first);
      await tester.pump();
      await tester.pump();
      expect(books.calls, contains('retryPage:p7'));
      await tester.tap(find.widgetWithText(NlButton, 'أعد المحاولة').last);
      await tester.pump();
      await tester.pump();
      expect(books.calls, contains('retryChapter:c1'));
    });

    testWidgets('reading failed: server reason + retry reading', (
      tester,
    ) async {
      final failed = bookJson(status: 'failed', chapters: const []);
      (failed['book']! as Map)['extractionError'] = 'الملف محمي بكلمة مرور.';
      final books = await open(tester, BookDetail.fromJson(failed));
      expect(find.text('الملف محمي بكلمة مرور.'), findsOneWidget);
      await tester.tap(find.text('إعادة محاولة الاستخراج'));
      await tester.pump();
      await tester.pump();
      expect(books.calls, contains('retryExtraction'));
    });

    testWidgets('shared with me: no generate, no retries, owner shown', (
      tester,
    ) async {
      await open(
        tester,
        book('partial_failed', const ['pending', 'failed'], role: 'shared'),
      );
      expect(find.textContaining('مشترك من'), findsOneWidget);
      expect(find.text('جهّز أدوات الدراسة'), findsNothing);
      expect(find.widgetWithText(NlButton, 'أعد المحاولة'), findsNothing);
    });
  });
}
