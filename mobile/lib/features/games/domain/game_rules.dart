// Ported from lib/brain-games (games.ts: scoreQuizStage, speedBonus,
// stageState; sudoku.ts: UNITS, PEERS, conflictingCells) and proven
// identical by test/features/games/game_rules_parity_test.dart on the web
// code's own output (tool/export_game_rules_fixtures.ts). The app uses the
// score only for the live "⭐" counter; the server scores every stage.

const basePoints = 100;
const maxSpeedBonus = 100;
const perfectStageBonus = 200;
const minHumanAnswerMs = 250;
const deadlineGraceMs = 400;

/// One answer: the chosen option (null = timed out) and the time taken.
final class QuizAnswer {
  const QuizAnswer({required this.choice, required this.timeMs});

  factory QuizAnswer.fromJson(Map<String, Object?> json) => QuizAnswer(
    choice: (json['choice'] as num?)?.toInt(),
    timeMs: (json['timeMs']! as num).toInt(),
  );

  final int? choice;
  final int timeMs;

  Map<String, Object?> toJson() => {'choice': choice, 'timeMs': timeMs};
}

int speedBonus(int timeMs, int limitMs) {
  if (timeMs < minHumanAnswerMs) return 0;
  final ratio = (timeMs / limitMs).clamp(0.0, 1.0);
  // Math.round: halves round up.
  return (maxSpeedBonus * (1 - ratio) + 0.5).floor();
}

final class QuizScore {
  const QuizScore({
    required this.score,
    required this.correct,
    required this.wrong,
    required this.timeouts,
    required this.pointsPerQuestion,
    required this.passed,
    required this.perfect,
  });

  final int score;
  final int correct;
  final int wrong;
  final int timeouts;
  final List<int> pointsPerQuestion;
  final bool passed;
  final bool perfect;
}

QuizScore scoreQuizStage(
  List<({int correctIndex, int timeLimitMs})> questions,
  List<QuizAnswer?> answers,
  int passCorrect,
) {
  var score = 0;
  var correct = 0;
  var wrong = 0;
  var timeouts = 0;
  final points = <int>[];
  for (final (i, q) in questions.indexed) {
    final a = i < answers.length ? answers[i] : null;
    final late =
        a == null ||
        a.choice == null ||
        a.timeMs > q.timeLimitMs + deadlineGraceMs;
    if (late) {
      timeouts++;
      points.add(0);
      continue;
    }
    final timeMs = a.timeMs.clamp(0, q.timeLimitMs);
    if (a.choice != q.correctIndex) {
      wrong++;
      points.add(0);
      continue;
    }
    correct++;
    final p = basePoints + speedBonus(timeMs, q.timeLimitMs);
    score += p;
    points.add(p);
  }
  final perfect = questions.isNotEmpty && correct == questions.length;
  if (perfect) score += perfectStageBonus;
  return QuizScore(
    score: score,
    correct: correct,
    wrong: wrong,
    timeouts: timeouts,
    pointsPerQuestion: points,
    passed: correct >= passCorrect,
    perfect: perfect,
  );
}

enum StageState { completed, current, unlocked, locked }

StageState stageState(
  int stage, {
  int? currentStage,
  int? highestUnlockedStage,
  List<int> completedStages = const [],
}) {
  final current = currentStage ?? 1;
  final highest = highestUnlockedStage ?? 1;
  if (stage == current && stage <= highest) return StageState.current;
  if (completedStages.contains(stage)) return StageState.completed;
  return stage <= highest ? StageState.unlocked : StageState.locked;
}

// ── Sudoku ──────────────────────────────────────────────────────────────

int rowOf(int i) => i ~/ 9;
int colOf(int i) => i % 9;
int boxOf(int i) => (rowOf(i) ~/ 3) * 3 + colOf(i) ~/ 3;

/// The 27 units: 9 rows, 9 columns, 9 boxes.
final List<List<int>> sudokuUnits = [
  for (var r = 0; r < 9; r++) [for (var c = 0; c < 9; c++) r * 9 + c],
  for (var c = 0; c < 9; c++) [for (var r = 0; r < 9; r++) r * 9 + c],
  for (var b = 0; b < 9; b++)
    [
      for (var k = 0; k < 9; k++)
        ((b ~/ 3) * 3 + k ~/ 3) * 9 + (b % 3) * 3 + k % 3,
    ],
];

/// Each cell's 20 peers.
final List<List<int>> sudokuPeers = [
  for (var i = 0; i < 81; i++)
    {
      for (final unit in sudokuUnits)
        if (unit.contains(i)) ...unit.where((j) => j != i),
    }.toList(),
];

/// Cells whose value repeats in a row, column or box.
Set<int> conflictingCells(List<int> board) {
  final conflicts = <int>{};
  for (final unit in sudokuUnits) {
    final seen = <int, List<int>>{};
    for (final i in unit) {
      if (board[i] == 0) continue;
      (seen[board[i]] ??= []).add(i);
    }
    for (final list in seen.values) {
      if (list.length > 1) conflicts.addAll(list);
    }
  }
  return conflicts;
}
