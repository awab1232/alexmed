import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/features/question_files/data/question_file_models.dart';
import 'package:nirolearn/features/question_files/domain/question_rules.dart';

/// The card rules must match components/questions/QuestionList.tsx — the
/// expected values are that code's own output
/// (tool/export_question_rules_fixtures.ts).
void main() {
  final fixture = jsonDecode(
    File('test/fixtures/question_rules_web.json').readAsStringSync(),
  ) as Map<String, Object?>;
  final questions = [
    for (final q
        in (fixture['questions']! as List).cast<Map<String, Object?>>())
      QuestionItem.fromJson({...q, 'questionText': 'Q'}),
  ];

  test('correctAnswerOf', () {
    final raw = (fixture['questions']! as List).cast<Map<String, Object?>>();
    for (final (i, q) in questions.indexed) {
      final expected = raw[i]['correct']! as Map<String, Object?>;
      final got = correctAnswerOf(q);
      expect(got.index, expected['index'], reason: q.id);
      expect(got.fromAi, expected['fromAi'], reason: q.id);
    }
  });

  test('deckProgress', () {
    for (final c
        in (fixture['progress']! as List).cast<Map<String, Object?>>()) {
      final answers = {
        for (final MapEntry(:key, :value)
            in (c['answers']! as Map<String, Object?>).entries)
          key: CardAnswer(
            selected: (value! as Map)['selected'] as int?,
            revealed: (value as Map)['revealed'] as bool,
          ),
      };
      final result = c['result']! as Map<String, Object?>;
      final got = deckProgress(questions, answers);
      expect(got.answered, result['answered']);
      expect(got.correct, result['correct']);
    }
  });

  test('optionState', () {
    final states = (fixture['states']! as List).cast<Map<String, Object?>>();
    expect(states, hasLength(24));
    for (final c in states) {
      final got = [
        for (var i = 0; i < 4; i++)
          optionState(
            i,
            selected: c['selected'] as int?,
            revealed: c['revealed']! as bool,
            correct: c['correct'] as int?,
          ).name,
      ];
      expect(got, c['states'], reason: '$c');
    }
  });

  test('arabicNumber', () {
    expect(arabicNumber(3), '٣');
    expect(arabicNumber(12), '١٢');
  });
}
