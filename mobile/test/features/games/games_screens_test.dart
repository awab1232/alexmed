import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/api/trpc_client.dart';
import 'package:nirolearn/core/storage/local_store.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/games/data/games_models.dart';
import 'package:nirolearn/features/games/data/games_repository.dart';
import 'package:nirolearn/features/games/domain/game_rules.dart';
import 'package:nirolearn/features/games/presentation/games_screen.dart';
import 'package:nirolearn/features/games/presentation/play_screen.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/screen_harness.dart';

class FakeGamesRepository extends GamesRepository {
  FakeGamesRepository({LocalStore? store})
    : super(trpc: TrpcClient(Dio()), store: store ?? MemoryLocalStore());

  @override
  Future<List<GameSummary>> overview() async => games;
  @override
  Future<GameSummary> game(String gameId) async =>
      games.firstWhere((g) => g.id == gameId);
  @override
  Future<GameSession?> activeSession(String gameId) async => active;
  @override
  Future<GameSession> startStage(String gameId, int stage) async {
    calls.add('start:$gameId:$stage');
    if (startError != null) throw startError!;
    return session!;
  }

  @override
  Future<StageResult> submitQuiz(
    String sessionId,
    List<QuizAnswer> answers,
  ) async {
    calls.add('submitQuiz:${answers.map((a) => a.choice).join(',')}');
    if (submitError != null) throw submitError!;
    return result;
  }

  @override
  Future<void> sudokuSave(String sessionId, SudokuState state) async =>
      calls.add('sudokuSave');

  @override
  Future<({int index, int value, int hintsUsed})> sudokuHint(
    String sessionId,
    List<int> board,
  ) async => (index: 0, value: 5, hintsUsed: 1);

  @override
  Future<StageResult> submitSudoku(String sessionId, SudokuState state) async {
    calls.add('submitSudoku');
    return result;
  }

  List<GameSummary> games = [];
  GameSession? active;
  GameSession? session;
  Object? startError;
  Object? submitError;
  StageResult result = const StageResult(
    gameId: 'math',
    stage: 1,
    passed: true,
    score: 1234,
    correct: 2,
    total: 2,
    accuracy: 100,
    nextStage: 2,
    unlockedStage: 2,
    bestScore: 1234,
    newBest: true,
  );
  final calls = <String>[];
}

const q1 = QuizQuestion(
  id: 'a',
  prompt: '7 × 8 = ?',
  options: ['54', '56', '64', '48'],
  correctIndex: 1,
  timeLimitMs: 8000,
);
const q2 = QuizQuestion(
  id: 'b',
  prompt: '9 × 6 = ?',
  options: ['54', '56', '63', '45'],
  correctIndex: 0,
  timeLimitMs: 8000,
);

const quizSession = GameSession(
  sessionId: 'aaaaaaaa-1111-2222-3333-444444444444',
  gameId: 'math',
  stage: 1,
  kind: GameKind.quiz,
  questions: [q1, q2],
  passCorrect: 2,
);

const math = GameSummary(
  id: 'math',
  kind: GameKind.quiz,
  emoji: '➕',
  title: 'تحدي الحساب',
  tagline: 'اختبر سرعتك في الحساب',
  totalStages: 100,
  progress: GameProgress(
    currentStage: 3,
    highestUnlockedStage: 3,
    completedStages: [1, 2],
    bestScore: 1800,
    totalCorrect: 18,
    totalWrong: 2,
    stageBests: {'2': 900},
  ),
);

void main() {
  testWidgets('games list: progress, open a game', (tester) async {
    final repo = FakeGamesRepository()..games = [math];
    await pumpOne(
      tester,
      const GamesScreen(),
      overrides: [gamesRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    expect(find.text('تحدي الحساب'), findsOneWidget);
    expect(find.text('▶ تابع المستوى 3'), findsOneWidget);
    await tester.tap(find.text('تحدي الحساب'));
    await pumpFrames(tester);
    expect(find.text('ROUTE /games/math'), findsOneWidget);
  });

  testWidgets('game: steps back to replay an unlocked level', (tester) async {
    final repo = FakeGamesRepository()..games = [math];
    await pumpOne(
      tester,
      const GameScreen(gameId: 'math'),
      overrides: [gamesRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    expect(find.text('العب المستوى 3'), findsOneWidget);
    await tester.tap(find.byTooltip('المستوى السابق'));
    await pumpFrames(tester);
    expect(find.text('أعد لعب المستوى 2'), findsOneWidget);
    expect(find.text('✓ مكتمل · 900'), findsOneWidget);
    // Can't go past the highest unlocked level.
    await tester.tap(find.byTooltip('المستوى التالي'));
    await pumpFrames(tester);
    final next = tester.widget<IconButton>(
      find.ancestor(
        of: find.byTooltip('المستوى التالي'),
        matching: find.byType(IconButton),
      ),
    );
    expect(next.onPressed, isNull);
  });

  testWidgets('quiz: answers kept on the device, submitted, result shown', (
    tester,
  ) async {
    final store = MemoryLocalStore();
    final repo = FakeGamesRepository(store: store)
      ..games = [math]
      ..session = quizSession;
    await pumpOne(
      tester,
      const PlayScreen(gameId: 'math', stage: 1),
      overrides: [gamesRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    expect(repo.calls, contains('start:math:1'));
    await tester.tap(find.text('▶ ابدأ'));
    await pumpFrames(tester, 2);
    expect(find.text('7 × 8 = ?'), findsOneWidget);
    await tester.tap(findLabel('56'));
    await pumpFrames(tester, 2);
    expect(find.text('✓ صحيح'), findsOneWidget);
    // Saved the moment it was given.
    final saved = await repo.loadQuiz(quizSession.sessionId);
    expect(saved!.answers.single.choice, 1);
    // Auto-advance after 850 ms.
    await pumpFrames(tester, 10);
    expect(find.text('9 × 6 = ?'), findsOneWidget);
    await tester.tap(findLabel('56'));
    await pumpFrames(tester, 12);
    expect(repo.calls, contains('submitQuiz:1,1'));
    expect(find.text('أنهيت المستوى 1'), findsOneWidget);
    expect(find.text('⭐ رقم قياسي جديد لهذا المستوى!'), findsOneWidget);
    expect(await repo.loadQuiz(quizSession.sessionId), isNull);
  });

  testWidgets('quiz: resumes a stored stage and never re-asks an answer', (
    tester,
  ) async {
    final store = MemoryLocalStore();
    final repo = FakeGamesRepository(store: store)
      ..games = [math]
      ..active = quizSession;
    await repo.saveQuiz(
      quizSession.sessionId,
      const QuizProgress(
        index: 0,
        answers: [QuizAnswer(choice: 0, timeMs: 3000)],
        shownAt: 1,
      ),
    );
    await pumpOne(
      tester,
      const PlayScreen(gameId: 'math', stage: 1),
      overrides: [gamesRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    expect(repo.calls.where((c) => c.startsWith('start')), isEmpty);
    // The stored wrong answer's feedback, not a fresh question.
    expect(find.text('✗ خطأ'), findsOneWidget);
  });

  testWidgets('quiz: offline submit keeps the answers and offers retry', (
    tester,
  ) async {
    final repo = FakeGamesRepository()
      ..games = [math]
      ..session = quizSession
      ..submitError = const NetworkException();
    await repo.saveQuiz(
      quizSession.sessionId,
      const QuizProgress(
        index: 2,
        answers: [
          QuizAnswer(choice: 1, timeMs: 900),
          QuizAnswer(choice: 0, timeMs: 1200),
        ],
      ),
    );
    await pumpOne(
      tester,
      const PlayScreen(gameId: 'math', stage: 1),
      overrides: [gamesRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    expect(find.text('انقطع الاتصال'), findsOneWidget);
    repo.submitError = null;
    await tester.tap(find.widgetWithText(NlButton, 'أعد المحاولة'));
    await pumpFrames(tester, 3);
    expect(find.text('أنهيت المستوى 1'), findsOneWidget);
  });

  testWidgets('locked stage: the server refuses, back to the levels', (
    tester,
  ) async {
    final repo = FakeGamesRepository()
      ..games = [math]
      ..startError = const ForbiddenException('هذا المستوى مقفل.');
    await pumpOne(
      tester,
      const PlayScreen(gameId: 'math', stage: 9),
      overrides: [gamesRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    expect(find.text('هذا المستوى مقفل'), findsOneWidget);
    expect(find.text('العودة للمستويات'), findsOneWidget);
  });

  testWidgets('sudoku: place, conflict counts a mistake, notes, hint, undo', (
    tester,
  ) async {
    final puzzle = List.filled(81, 0)
      ..[1] = 3
      ..[2] = 4;
    final repo = FakeGamesRepository()
      ..games = [
        const GameSummary(
          id: 'sudoku',
          kind: GameKind.sudoku,
          emoji: '🧩',
          title: 'سودوكو',
          tagline: '',
          totalStages: 50,
        ),
      ]
      ..session = GameSession(
        sessionId: 'bbbbbbbb-1111-2222-3333-444444444444',
        gameId: 'sudoku',
        stage: 1,
        kind: GameKind.sudoku,
        puzzle: puzzle,
        difficulty: 'easy',
        maxHints: 3,
      );
    await pumpOne(
      tester,
      const PlayScreen(gameId: 'sudoku', stage: 1),
      size: const Size(412, 1600),
      overrides: [gamesRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    expect(find.text('✗ 0'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('صف 1 عمود 1: فارغة'));
    await tester.pump();
    await tester.tap(find.bySemanticsLabel('3 — متبقٍ 8'));
    await tester.pump();
    expect(find.text('✗ 1'), findsOneWidget); // 3 repeats in the row
    await tester.tap(find.bySemanticsLabel('تراجع'));
    await tester.pump();
    expect(find.bySemanticsLabel('صف 1 عمود 1: فارغة'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('تلميح (3)'));
    await pumpFrames(tester);
    expect(find.bySemanticsLabel('تلميح (2)'), findsOneWidget);
    expect(find.bySemanticsLabel('صف 1 عمود 1: 5'), findsOneWidget);
    // Autosave to the server shortly after the last move.
    await pumpFrames(tester, 20);
    expect(repo.calls, contains('sudokuSave'));
  });
}
