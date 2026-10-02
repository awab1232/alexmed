// Visual check of the study screens (flashcards, quiz, summary, preparing)
// on a device with in-memory data (no server).

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
import 'package:nirolearn/features/study/data/study_repository.dart';

import '../test/features/study/study_fakes.dart';
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

  testWidgets('study screens', (tester) async {
    final study = FakeStudyRepository(studyJson());
    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(FakeLibraryRepository()),
          accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
          studyRepositoryProvider.overrideWithValue(study),
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

    unawaited(router.push(Routes.bookStudy('b1', 'cards')));
    await hold(tester, 'cards-front');
    await tester.tap(find.byType(PageView));
    await hold(tester, 'cards-back');
    await tester.tap(find.text('جيدة'));
    await tester.tap(find.text('EN'));
    await hold(tester, 'cards-arabic');
    router.pop();

    unawaited(router.push(Routes.bookStudy('b1', 'mcqs')));
    await hold(tester, 'quiz');
    await tester.tap(find.text('Distal tubule'));
    await hold(tester, 'quiz-wrong');
    router.pop();

    unawaited(router.push(Routes.bookStudy('b1', 'explanation')));
    await hold(tester, 'summary');
    router.pop();

    study
      ..contentJson = studyJson(cardChapters: const [])
      ..decks = [deck('processing', done: 3, total: 8)];
    unawaited(router.push(Routes.bookStudy('b1', 'cards')));
    await hold(tester, 'preparing');
  });
}
