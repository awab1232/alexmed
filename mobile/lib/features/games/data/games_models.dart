import '../../../core/api/json.dart';

// 🧠 Brain games — shapes of brainGames.* (lib/trpc/brainGamesRouter.ts).
// Server-authoritative: stages are generated, stored and scored on the
// server; the app renders and reports answers.

enum GameKind { quiz, sudoku }

final class GameProgress {
  const GameProgress({
    this.currentStage = 1,
    this.highestUnlockedStage = 1,
    this.completedStages = const [],
    this.bestScore = 0,
    this.totalCorrect = 0,
    this.totalWrong = 0,
    this.bestTimeMs,
    this.stageBests = const {},
  });

  factory GameProgress.fromJson(JsonMap json) => GameProgress(
    currentStage: json.integer('currentStage', fallback: 1),
    highestUnlockedStage: json.integer('highestUnlockedStage', fallback: 1),
    completedStages: json['completedStages'] is List
        ? [for (final s in json['completedStages']! as List) (s as num).toInt()]
        : const [],
    bestScore: json.integer('bestScore'),
    totalCorrect: json.integer('totalCorrect'),
    totalWrong: json.integer('totalWrong'),
    bestTimeMs: json.intOrNull('bestTimeMs'),
    stageBests: json['stageBests'] is Map
        ? {
            for (final MapEntry(:key, :value) in asMap(
              json['stageBests'],
            ).entries)
              if (value is Map) key: asMap(value).integer('score'),
          }
        : const {},
  );

  final int currentStage;
  final int highestUnlockedStage;
  final List<int> completedStages;
  final int bestScore;
  final int totalCorrect;
  final int totalWrong;
  final int? bestTimeMs;

  /// Stage → best score on it.
  final Map<String, int> stageBests;

  int? get accuracy {
    final all = totalCorrect + totalWrong;
    return all == 0 ? null : (totalCorrect / all * 100).round();
  }
}

/// brainGames.overview row / brainGames.game.
final class GameSummary {
  const GameSummary({
    required this.id,
    required this.kind,
    required this.emoji,
    required this.title,
    required this.tagline,
    required this.totalStages,
    this.progress,
    this.activeStage,
  });

  factory GameSummary.fromJson(JsonMap json) => GameSummary(
    id: json.str('id'),
    kind: json.strOrNull('kind') == 'sudoku' ? GameKind.sudoku : GameKind.quiz,
    emoji: json.strOrNull('emoji') ?? '',
    title: json.strOrNull('titleAr') ?? json.strOrNull('title') ?? '',
    tagline: json.strOrNull('taglineAr') ?? json.strOrNull('tagline') ?? '',
    totalStages: json.integer('totalStages', fallback: 1),
    progress: json['progress'] is Map
        ? GameProgress.fromJson(asMap(json['progress']))
        : null,
    activeStage: json['activeSession'] is Map
        ? asMap(json['activeSession']).intOrNull('stage')
        : null,
  );

  final String id;
  final GameKind kind;
  final String emoji;
  final String title;
  final String tagline;
  final int totalStages;
  final GameProgress? progress;

  /// brainGames.game only: the stage of an unfinished session.
  final int? activeStage;
}

final class QuizQuestion {
  const QuizQuestion({
    required this.id,
    required this.prompt,
    required this.options,
    required this.correctIndex,
    required this.timeLimitMs,
    this.instruction,
    this.explanation,
    this.category,
  });

  factory QuizQuestion.fromJson(JsonMap json) => QuizQuestion(
    id: json.str('id'),
    prompt: json.strOrNull('prompt') ?? '',
    options: [for (final o in json['options']! as List) '$o'],
    correctIndex: json.integer('correctIndex'),
    timeLimitMs: json.integer('timeLimitMs', fallback: 8000),
    instruction: json.strOrNull('instruction'),
    explanation: json.strOrNull('explanation'),
    category: json.strOrNull('category'),
  );

  final String id;
  final String prompt;
  final List<String> options;

  /// Sent so feedback is instant; the server re-scores from its own copy.
  final int correctIndex;
  final int timeLimitMs;
  final String? instruction;
  final String? explanation;
  final String? category;
}

/// A started (or resumed) stage — PublicSession.
final class GameSession {
  const GameSession({
    required this.sessionId,
    required this.gameId,
    required this.stage,
    required this.kind,
    this.questions = const [],
    this.passCorrect = 0,
    this.puzzle = const [],
    this.difficulty = '',
    this.maxHints = 0,
    this.hintsUsed = 0,
    this.clientState,
  });

  factory GameSession.fromJson(JsonMap json) {
    final data = asMap(json['stageData']);
    final sudoku = data.strOrNull('kind') == 'sudoku';
    return GameSession(
      sessionId: json.str('sessionId'),
      gameId: json.str('gameId'),
      stage: json.integer('stage', fallback: 1),
      kind: sudoku ? GameKind.sudoku : GameKind.quiz,
      questions: sudoku
          ? const []
          : [
              for (final q in asMapList(data['questions']))
                QuizQuestion.fromJson(q),
            ],
      passCorrect: data.integer('passCorrect'),
      puzzle: sudoku
          ? [for (final v in data['puzzle']! as List) (v as num).toInt()]
          : const [],
      difficulty: data.strOrNull('difficulty') ?? '',
      maxHints: data.integer('maxHints'),
      hintsUsed: json.integer('hintsUsed'),
      clientState: json['clientState'] is Map
          ? asMap(json['clientState'])
          : null,
    );
  }

  final String sessionId;
  final String gameId;
  final int stage;
  final GameKind kind;
  final List<QuizQuestion> questions;
  final int passCorrect;
  final List<int> puzzle;
  final String difficulty;
  final int maxHints;
  final int hintsUsed;

  /// The Sudoku autosave the server holds (board, notes, time, mistakes).
  final JsonMap? clientState;
}

/// The server's verdict — the only result ever shown.
final class StageResult {
  const StageResult({
    required this.gameId,
    required this.stage,
    required this.passed,
    required this.score,
    this.correct = 0,
    this.total = 0,
    this.accuracy = 0,
    this.fastestMs,
    this.timeMs,
    this.hintsUsed,
    this.unlockedStage,
    this.nextStage,
    this.bestScore = 0,
    this.newBest = false,
  });

  factory StageResult.fromJson(JsonMap json) => StageResult(
    gameId: json.str('gameId'),
    stage: json.integer('stage', fallback: 1),
    passed: json.boolean('passed'),
    score: json.integer('score'),
    correct: json.integer('correct'),
    total: json.integer('total'),
    accuracy: json.integer('accuracy'),
    fastestMs: json.intOrNull('fastestMs'),
    timeMs: json.intOrNull('timeMs'),
    hintsUsed: json.intOrNull('hintsUsed'),
    unlockedStage: json.intOrNull('unlockedStage'),
    nextStage: json.intOrNull('nextStage'),
    bestScore: json.integer('bestScore'),
    newBest: json.boolean('newBest'),
  );

  final String gameId;
  final int stage;
  final bool passed;
  final int score;
  final int correct;
  final int total;
  final int accuracy;
  final int? fastestMs;
  final int? timeMs;
  final int? hintsUsed;
  final int? unlockedStage;
  final int? nextStage;
  final int bestScore;
  final bool newBest;
}

/// "7.3 ث" under a minute, else "m:ss" (the web's formatMs / seconds).
String formatGameMs(int? ms) {
  if (ms == null) return '—';
  if (ms < 60000) return '${(ms / 1000).toStringAsFixed(1)} ث';
  final s = (ms / 1000).round();
  return '${s ~/ 60}:${'${s % 60}'.padLeft(2, '0')}';
}

const sudokuDifficultyAr = {
  'easy': 'سهل',
  'medium': 'متوسط',
  'hard': 'صعب',
  'expert': 'خبير',
};
