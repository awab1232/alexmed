// Visual check of the mind map and the match game on a device with
// in-memory data (no server).

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
import 'package:nirolearn/features/mindmap/data/mindmap_repository.dart';
import 'package:nirolearn/features/study/data/study_repository.dart';

import '../test/features/match/match_mindmap_screens_test.dart'
    show FakeMindMapRepository, map;
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

  testWidgets('mind map and match', (tester) async {
    final json = studyJson()
      ..['terms'] = [
        {
          'id': 't1',
          'chapterId': 'c0',
          'en': 'Hypokalaemia',
          'ar': 'نقص البوتاسيوم',
        },
        {
          'id': 't2',
          'chapterId': 'c0',
          'en': 'Tachycardia',
          'ar': 'تسرع القلب',
        },
      ];
    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(FakeLibraryRepository()),
          accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
          studyRepositoryProvider.overrideWithValue(FakeStudyRepository(json)),
          mindMapRepositoryProvider.overrideWithValue(
            FakeMindMapRepository([map()]),
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

    unawaited(router.push(Routes.bookMindmap('b1')));
    await hold(tester, 'mindmap');
    await tester.tap(find.text('Chapter 1'));
    await hold(tester, 'mindmap-open');
    router.pop();

    unawaited(router.push(Routes.bookMatch('b1')));
    await hold(tester, 'match');
    await tester.tap(find.byType(InkWell).at(3));
    await hold(tester, 'match-selected');
  });
}
