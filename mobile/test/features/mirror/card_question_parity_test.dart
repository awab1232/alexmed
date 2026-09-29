import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/features/mirror/domain/card_question.dart';

/// The Dart port must split questions exactly like the web's
/// lib/mirror-card-question.ts — expected values are that code's own output
/// (tool/export_card_question_fixtures.ts).
void main() {
  final cases = (jsonDecode(
    File('test/fixtures/card_question_web.json').readAsStringSync(),
  ) as List).cast<Map<String, Object?>>();

  test('fixtures exist', () => expect(cases, hasLength(10)));

  for (final (i, c) in cases.indexed) {
    final question = c['question']! as String;
    test('case $i: ${question.split('\n').first}', () {
      final arabic = c['arabic'] == true;
      final parsed = parseCardQuestion(question, arabic: arabic);
      final stem = c['stem']! as Map<String, Object?>;
      expect(
        parsed.stem,
        TextRange(stem['start']! as int, stem['end']! as int),
      );
      expect(parsed.options, [
        for (final o in (c['options']! as List).cast<Map<String, Object?>>())
          TextRange(o['start']! as int, o['end']! as int),
      ]);
      if (!arabic) {
        final options = [for (final r in parsed.options) r.of(question)];
        expect(
          resolveCardAnswer(c['answer']! as String, question, options),
          c['correct'],
        );
      }
    });
  }
}
