// Visual check of review, stats, weak points and today's plan on a device
// with in-memory data (no server).

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
import 'package:nirolearn/features/progress/data/progress_repository.dart';
import 'package:nirolearn/features/study/data/study_repository.dart';

import '../test/features/progress/progress_screens_test.dart'
    show FakeProgressRepository;
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

  testWidgets('progress screens', (tester) async {
    final library = FakeLibraryRepository()
      ..due = 2
      ..folders = [
        Subject(
          id: 's1',
          name: 'فسيولوجيا',
          type: 'medical',
          bookCount: 2,
          examDate: DateTime.now().add(const Duration(days: 12)),
        ),
      ]
      ..bookList = [
        const BookSummary(
          id: 'b1',
          fileName: 'Renal_Physiology.pdf',
          chapterCount: 2,
          completeChapterCount: 2,
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
          progressRepositoryProvider.overrideWithValue(
            FakeProgressRepository(),
          ),
          studyRepositoryProvider.overrideWithValue(
            FakeStudyRepository(studyJson()),
          ),
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

    unawaited(router.push(Routes.review));
    await hold(tester, 'review');
    await tester.tap(find.text('اظهر الإجابة'));
    await hold(tester, 'review-answer');
    router.pop();

    unawaited(router.push(Routes.stats));
    await hold(tester, 'stats');
    router.pop();

    unawaited(router.push(Routes.weakPoints));
    await hold(tester, 'weak');
    router.pop();

    unawaited(router.push(Routes.today));
    await hold(tester, 'today');
  });
}
