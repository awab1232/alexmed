import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/features/games/domain/game_rules.dart';

/// The ported game rules must match lib/brain-games — expected values are
/// the web code's own output (tool/export_game_rules_fixtures.ts).
void main() {
  final f = jsonDecode(
    File('test/fixtures/game_rules_web.json').readAsStringSync(),
  ) as Map<String, Object?>;
  List<Map<String, Object?>> list(String key) =>
      (f[key]! as List).cast<Map<String, Object?>>();

  test('speedBonus', () {
    for (final c in list('bonus')) {
      expect(
        speedBonus(c['timeMs']! as int, c['limitMs']! as int),
        c['bonus'],
        reason: '$c',
      );
    }
  });

  test('scoreQuizStage (30 generated stages)', () {
    for (final c in list('quiz')) {
      final questions = [
        for (final q in (c['questions']! as List).cast<Map<String, Object?>>())
          (
            correctIndex: q['correctIndex']! as int,
            timeLimitMs: q['timeLimitMs']! as int,
          ),
      ];
      final answers = [
        for (final a in (c['answers']! as List).cast<Map<String, Object?>>())
          QuizAnswer.fromJson(a),
      ];
      final r = scoreQuizStage(questions, answers, c['passCorrect']! as int);
      expect(r.score, c['score'], reason: '$c');
      expect(r.correct, c['correct']);
      expect(r.wrong, c['wrong']);
      expect(r.timeouts, c['timeouts']);
      expect(r.pointsPerQuestion, c['points']);
      expect(r.passed, c['passed']);
      expect(r.perfect, c['perfect']);
    }
  });

  test('stageState', () {
    for (final c in list('stages')) {
      final p = c['progress'] as Map<String, Object?>?;
      final got = stageState(
        c['stage']! as int,
        currentStage: p?['currentStage'] as int?,
        highestUnlockedStage: p?['highestUnlockedStage'] as int?,
        completedStages: ((p?['completedStages'] as List?) ?? const [])
            .cast<int>(),
      );
      expect(got.name, c['state'], reason: '$c');
    }
  });

  test('sudoku peers and conflicts', () {
    final peers = (f['peers']! as List).cast<List<Object?>>();
    for (var i = 0; i < 81; i++) {
      expect([...sudokuPeers[i]]..sort(), peers[i], reason: 'cell $i');
    }
    for (final c in list('boards')) {
      final board = (c['board']! as List).cast<int>();
      expect(conflictingCells(board).toList()..sort(), c['conflicts']);
    }
  });
}
