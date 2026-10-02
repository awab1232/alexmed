// Large-file check for the real reader: a 300-page PDF padded to ~60 MB
// (an unreferenced block, like a scanned book's images), served in byte
// ranges by an in-memory adapter. The reader must show pages after
// fetching a small fraction of the file, across repeated open / scroll /
// close. Memory is read with `adb shell dumpsys meminfo` while each SCREEN
// is held.

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

  testWidgets('large pdf', (tester) async {
    final pdf = buildTestPdf(300, padBytes: 60 * 1024 * 1024);
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
    await hold(tester, 'large-before', 8);

    for (var round = 1; round <= 5; round++) {
      unawaited(router.push(Routes.bookRead('b1', page: round * 50)));
      await hold(tester, 'large-open-$round', 24);
      await tester.fling(
        find.byType(Scaffold).last,
        const Offset(0, -2500),
        4000,
      );
      await hold(tester, 'large-scrolled-$round', 12);
      debugPrint(
        'METRIC round=$round file=${pdf.length}B '
        'requests=${repo.adapter.ranges.length} '
        'bytes=${repo.adapter.bytesServed}',
      );
      router.pop();
      await hold(tester, 'large-closed-$round', 12);
    }
    expect(repo.adapter.bytesServed, lessThan(pdf.length ~/ 4));
  });
}
