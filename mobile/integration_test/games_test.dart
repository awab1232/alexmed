// Brain games on a device with in-memory data (no server): list, game,
// a quiz stage (answer, feedback, result) and a Sudoku board. Pauses on
// each screen for `adb exec-out screencap`.

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
import 'package:nirolearn/features/games/data/games_models.dart';
import 'package:nirolearn/features/games/data/games_repository.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';

import '../test/features/games/games_screens_test.dart'
    show FakeGamesRepository, math, quizSession;
import '../test/helpers/app_harness.dart';
import '../test/helpers/fake_http.dart';

Future<void> hold(WidgetTester tester, String label) async {
  debugPrint('SCREEN $label');
  for (var i = 0; i < 20; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

// A real Sudoku (stage-like) with some cells given.
const _solution = [
  5, 3, 4, 6, 7, 8, 9, 1, 2, 6, 7, 2, 1, 9, 5, 3, 4, 8, //
  1, 9, 8, 3, 4, 2, 5, 6, 7, 8, 5, 9, 7, 6, 1, 4, 2, 3, //
  4, 2, 6, 8, 5, 3, 7, 9, 1, 7, 1, 3, 9, 2, 4, 8, 5, 6, //
  9, 6, 1, 5, 3, 7, 2, 8, 4, 2, 8, 7, 4, 1, 9, 6, 3, 5, //
  3, 4, 5, 2, 8, 6, 1, 7, 9,
];

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('games screens', (tester) async {
    final puzzle = [
      for (var i = 0; i < 81; i++) (i * 7) % 3 == 0 ? _solution[i] : 0,
    ];
    final repo = FakeGamesRepository()
      ..games = [
        math,
        const GameSummary(
          id: 'multiplication',
          kind: GameKind.quiz,
          emoji: '✖️',
          title: 'جدول الضرب',
          tagline: 'قدّيش سريع بجدول الضرب؟',
          totalStages: 100,
        ),
        const GameSummary(
          id: 'sudoku',
          kind: GameKind.sudoku,
          emoji: '🧩',
          title: 'سودوكو',
          tagline: 'منطق. تركيز. حل.',
          totalStages: 50,
          progress: GameProgress(currentStage: 4, highestUnlockedStage: 4),
        ),
      ]
      ..session = quizSession;

    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(FakeLibraryRepository()),
          accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
          gamesRepositoryProvider.overrideWithValue(repo),
        ],
        child: const NiroLearnApp(),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    final router = ProviderScope.containerOf(
      tester.element(find.byType(NlBottomNav)),
    ).read(routerProvider);

    router.go(Routes.games);
    await hold(tester, 'games-list');
    unawaited(router.push(Routes.game('math')));
    await hold(tester, 'games-detail');
    unawaited(router.push(Routes.gamePlay('math', 1)));
    await hold(tester, 'games-ready');
    await tester.tap(find.text('▶ ابدأ'));
    await tester.pump(const Duration(milliseconds: 1500));
    await hold(tester, 'games-question');
    await tester.tap(findLabel('54'));
    await tester.pump(const Duration(milliseconds: 300));
    debugPrint('SCREEN games-feedback');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(findLabel('54'));
    await hold(tester, 'games-result');

    repo.session = GameSession(
      sessionId: 'cccccccc-1111-2222-3333-444444444444',
      gameId: 'sudoku',
      stage: 4,
      kind: GameKind.sudoku,
      puzzle: puzzle,
      difficulty: 'medium',
      maxHints: 3,
    );
    router.go(Routes.games);
    await tester.pump(const Duration(seconds: 1));
    unawaited(router.push(Routes.gamePlay('sudoku', 4)));
    await hold(tester, 'games-sudoku-open');
    final board = tester.getRect(find.byType(AspectRatio).first);
    Offset cell(int r, int c) => Offset(
      board.left + board.width * (c + 0.5) / 9,
      board.top + board.height * (r + 0.5) / 9,
    );
    // The pad follows the board in the tree: its digit is the last match.
    Finder pad(int d) => find.text('$d').last;
    await tester.tapAt(cell(0, 1));
    await tester.pump();
    await tester.tap(pad(3));
    await tester.pump();
    await tester.tap(find.text('ملاحظات'));
    await tester.pump();
    await tester.tapAt(cell(1, 2));
    await tester.pump();
    for (final d in [1, 4, 8]) {
      await tester.tap(pad(d));
      await tester.pump();
    }
    await tester.tapAt(cell(4, 4));
    await tester.pump();
    await hold(tester, 'games-sudoku');
  });
}
