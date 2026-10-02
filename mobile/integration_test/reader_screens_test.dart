// The real PDFium reader on a device: a generated 300-page PDF served in
// byte ranges by an in-memory adapter (no server), opened at page 150 like
// a source-page link. Prints how many bytes were actually fetched.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/app/router.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/auth/data/auth_repository.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';
import 'package:nirolearn/features/reader/data/reader_repository.dart';

import '../test/features/reader/reader_screen_test.dart'
    show FakeReaderRepository;
import '../test/helpers/app_harness.dart';
import '../test/helpers/bytes_range_adapter.dart';
import '../test/helpers/fake_http.dart';

Future<void> hold(WidgetTester tester, String label, [int ticks = 40]) async {
  debugPrint('SCREEN $label');
  for (var i = 0; i < ticks; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('pdf reader', (tester) async {
    final pdf = buildTestPdf(
      300,
      bodyText: 'The loop of Henle concentrates urine',
    );
    final repo = FakeReaderRepository(pdf: pdf);
    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(FakeLibraryRepository()),
          accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
          readerRepositoryProvider.overrideWithValue(repo),
        ],
        child: const NiroLearnApp(),
      ),
    );
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
    final router = ProviderScope.containerOf(
      tester.element(find.byType(NlBottomNav)),
    ).read(routerProvider);

    unawaited(router.push(Routes.bookRead('b1', page: 150)));
    await hold(tester, 'reader-150', 60);
    final fetched = repo.adapter.ranges.length;
    debugPrint(
      'METRIC file=${pdf.length}B requests=$fetched '
      'bytes=${repo.adapter.bytesServed}',
    );

    await tester.tap(find.byTooltip('قلم'));
    await tester.pump();
    final center = tester.getCenter(find.byType(Scaffold).last);
    final gesture = await tester.startGesture(center - const Offset(100, 60));
    for (var i = 0; i < 20; i++) {
      await gesture.moveBy(const Offset(10, 4));
      await tester.pump(const Duration(milliseconds: 16));
    }
    await gesture.up();
    await hold(tester, 'reader-pen', 20);

    await tester.tap(find.byTooltip('قلم'));
    await tester.tap(find.byTooltip('بحث في الملف'));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.enterText(find.byType(TextField), 'page 12');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await hold(tester, 'reader-search', 40);
    debugPrint(
      'METRIC afterSearch requests=${repo.adapter.ranges.length} '
      'bytes=${repo.adapter.bytesServed}',
    );
    await tester.tap(find.text('صفحة 12').first);
    await hold(tester, 'reader-12', 30);

    await tester.tap(find.byTooltip('اسأل Niro عن الصفحة'));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text('اشرح الصفحة'));
    await hold(tester, 'reader-ask', 20);
  });
}
