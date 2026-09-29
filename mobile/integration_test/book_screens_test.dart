// Visual check of the study-book upload and book screens on a device with
// in-memory data (no server). Pauses on each screen so
// `adb exec-out screencap` can capture it.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/app/router.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/core/upload/pdf_upload.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/auth/data/auth_repository.dart';
import 'package:nirolearn/features/books/data/book_models.dart';
import 'package:nirolearn/features/books/data/book_repository.dart';
import 'package:nirolearn/features/library/data/library_models.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';

import '../test/features/books/book_repository_test.dart' show bookJson;
import '../test/features/books/book_screens_test.dart' show FakeBookRepository;
import '../test/helpers/app_harness.dart';
import '../test/helpers/fake_http.dart';

Future<void> hold(WidgetTester tester, String label) async {
  debugPrint('SCREEN $label');
  for (var i = 0; i < 40; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

BookDetail detail(String status, List<String> chapters) =>
    BookDetail.fromJson(bookJson(status: status, chapters: chapters));

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('book screens', (tester) async {
    final pdf = File('${Directory.systemTemp.path}/Guyton_Physiology.pdf')
      ..writeAsBytesSync(utf8.encode('%PDF-1.7 ${'x' * 4000000}'));
    final library = FakeLibraryRepository()
      ..folders = [
        const Subject(id: 's1', name: 'فسيولوجيا', type: 'medical'),
        const Subject(id: 's2', name: 'English', type: 'english'),
      ]
      ..bookList = [
        const BookSummary(id: 'b0', fileName: 'Guyton Physiology.pdf'),
      ];
    final books = FakeBookRepository(detail('extracting', const []));

    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(library),
          accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
          bookRepositoryProvider.overrideWithValue(books),
          pdfPathPickerProvider.overrideWithValue(() async => pdf.path),
        ],
        child: const NiroLearnApp(),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    final router = ProviderScope.containerOf(
      tester.element(find.byType(NlBottomNav)),
    ).read(routerProvider);

    unawaited(router.push(Routes.uploadBookIn('s1')));
    await hold(tester, 'upload-empty');
    await tester.runAsync(() async {
      await tester.tap(find.text('اختر ملف PDF'));
      await Future<void>.delayed(const Duration(milliseconds: 500));
    });
    await hold(tester, 'upload-picked');

    router.pop();
    await tester.pump(const Duration(seconds: 1));

    unawaited(router.push(Routes.book('b1')));
    await hold(tester, 'book-extracting');
    router.pop();

    books.book = detail('processing', const ['pending', 'pending', 'pending']);
    unawaited(router.push(Routes.book('b1')));
    await hold(tester, 'book-locked');
    router.pop();

    books
      ..book = detail('processing', const ['complete', 'processing', 'pending'])
      ..coverageReport = const CoverageReport(
        totalPages: 120,
        pagesWithVisuals: 14,
        visualPending: 30,
      )
      ..detail = const CoverageDetail(
        totalPages: 120,
        processedPages: 90,
        coverage: 75,
      )
      ..examFocusTile = const ExamFocusTile(status: 'processing');
    unawaited(router.push(Routes.book('b1')));
    await hold(tester, 'book-generating');
    router.pop();

    books
      ..book = detail('partial_failed', const ['complete', 'failed', 'complete'])
      ..coverageReport = const CoverageReport(
        totalPages: 120,
        pagesWithVisuals: 14,
        failed: 1,
      )
      ..detail = const CoverageDetail(
        totalPages: 120,
        processedPages: 119,
        coverage: 99,
        failedPages: [37],
      )
      ..pageList = const [
        BookPage(id: 'p37', pageNumber: 37, textFailed: true),
      ]
      ..examFocusTile = const ExamFocusTile(status: 'complete', totalCards: 58);
    unawaited(router.push(Routes.book('b1')));
    await hold(tester, 'book-partial');
    await tester.drag(find.byType(ListView).last, const Offset(0, -700));
    await hold(tester, 'book-partial-bottom');
    router.pop();

    books
      ..book = detail('complete', const ['complete', 'complete', 'complete'])
      ..coverageReport = const CoverageReport(
        totalPages: 120,
        pagesWithVisuals: 14,
      )
      ..detail = const CoverageDetail(
        totalPages: 120,
        processedPages: 120,
        coverage: 100,
        complete: true,
      )
      ..pageList = const [];
    unawaited(router.push(Routes.book('b1')));
    await hold(tester, 'book-ready');
  });
}
