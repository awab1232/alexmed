// Visual check of the مِرآة screens on a device with in-memory data (no
// server). Pauses on each screen so `adb exec-out screencap` can capture it.

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
import 'package:nirolearn/features/library/data/library_models.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';
import 'package:nirolearn/features/mirror/data/mirror_models.dart';
import 'package:nirolearn/features/mirror/data/mirror_repository.dart';

import '../test/features/mirror/mirror_screens_test.dart'
    show FakeMirrorRepository, q1, q2;
import '../test/helpers/app_harness.dart';
import '../test/helpers/fake_http.dart';

Future<void> hold(WidgetTester tester, String label) async {
  debugPrint('SCREEN $label');
  for (var i = 0; i < 40; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('mirror screens', (tester) async {
    final library = FakeLibraryRepository()
      ..folders = [const Subject(id: 's1', name: 'أدوية', type: 'medical')];
    final mirror = FakeMirrorRepository()
      ..jobs = [
        const MirrorJob(
          id: 'j1',
          fileName: 'Pharmacology MCQs.pdf',
          status: MirrorJobStatus.pending,
          pageCount: 24,
          batches: [
            MirrorBatch(
              id: 'b1',
              startPage: 1,
              endPage: 8,
              status: 'generating',
            ),
            MirrorBatch(id: 'b2', startPage: 9, endPage: 16, status: 'pending'),
            MirrorBatch(
              id: 'b3',
              startPage: 17,
              endPage: 24,
              status: 'pending',
            ),
          ],
        ),
      ]
      ..decks = [
        const MirrorDeck(
          id: 'd1',
          fileName: 'Pharmacology MCQs.pdf',
          pageCount: 24,
          cards: [q1, q2],
          jobId: 'j1',
          jobStatus: MirrorJobStatus.pending,
        ),
      ];

    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(library),
          accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
          mirrorRepositoryProvider.overrideWithValue(mirror),
        ],
        child: const NiroLearnApp(),
      ),
    );
    await tester.pumpAndSettle();
    final router = ProviderScope.containerOf(
      tester.element(find.byType(NlBottomNav)),
    ).read(routerProvider);

    unawaited(router.push(Routes.uploadQuestionFile));
    await hold(tester, 'start-pdf');

    await tester.tap(find.text('نص أسئلة'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextField).first,
      '1. Which drug is a loop diuretic?\nA. Furosemide\nB. Spironolactone\nC. Amiloride\nD. Mannitol\nAnswer: A',
    );
    FocusManager.instance.primaryFocus?.unfocus();
    await hold(tester, 'start-text');

    unawaited(router.push(Routes.mirrorJob('j1', detailsOnly: true)));
    await hold(tester, 'job');

    unawaited(router.push(Routes.deck('d1')));
    await hold(tester, 'deck');
    await tester.tap(find.text('Mannitol'));
    await hold(tester, 'deck-wrong');
    await tester.drag(find.byType(PageView), const Offset(0, -500));
    await hold(tester, 'deck-explanation');
  });
}
