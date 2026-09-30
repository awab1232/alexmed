import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/features/question_files/data/question_file_models.dart';
import 'package:nirolearn/features/question_files/domain/question_rules.dart';
import 'package:nirolearn/features/question_files/presentation/question_deck_view.dart';

import '../../helpers/screen_harness.dart';

// Synthetic bilingual questions shaped like lib/test-fixtures/
// question-documents.ts (no real user file): an English stem and options
// inside the Arabic interface, an Arabic stem with an English drug name,
// Arabic options with an English term, and an English interface showing
// an Arabic question.
const english = QuestionItem(
  id: 'e1',
  questionText: 'In forensic practice, the hydrostatic test is primarily used to differentiate between?',
  options: ['The age of the deceased.', 'Stillbirth and live birth.'],
  extractedAnswerIndex: 1,
  aiExplanationAr: 'اختبار الطفو يفرّق بين المولود الميت والحي.',
  keywords: ['hydrostatic test', 'ولادة حية'],
);
const arabic = QuestionItem(
  id: 'a1',
  questionText: 'ما هو دور ACE inhibitor في علاج ارتفاع الضغط؟',
  options: ['يقلل إنتاج الأنجيوتنسين II', 'يزيد Aldosterone'],
  extractedAnswerIndex: 0,
);

TextDirection directionOf(WidgetTester tester, String text) {
  final element = tester.element(find.text(text));
  return Directionality.of(element);
}

Widget deck(List<QuestionItem> questions) => Scaffold(
  body: QuestionDeckView(
    questions: questions,
    answers: const {},
    onAnswer: (_, _) {},
  ),
);

void main() {
  testWidgets('English question inside the Arabic interface reads LTR', (
    tester,
  ) async {
    await pumpOne(tester, deck(const [english]));
    expect(directionOf(tester, english.questionText), TextDirection.ltr);
    expect(
      directionOf(tester, 'Stillbirth and live birth.'),
      TextDirection.ltr,
    );
    // The interface around it stays RTL.
    expect(directionOf(tester, 'السؤال 1 من 1'), TextDirection.rtl);
  });

  testWidgets('Arabic question with English terms stays RTL', (tester) async {
    await pumpOne(tester, deck(const [arabic]));
    expect(directionOf(tester, arabic.questionText), TextDirection.rtl);
    expect(
      directionOf(tester, 'يقلل إنتاج الأنجيوتنسين II'),
      TextDirection.rtl,
    );
  });

  testWidgets('explanation and keywords take their own direction', (
    tester,
  ) async {
    await pumpOne(
      tester,
      Scaffold(
        body: QuestionDeckView(
          questions: const [english],
          answers: const {'e1': CardAnswer(selected: 1, revealed: true)},
          onAnswer: (_, _) {},
        ),
      ),
    );
    expect(directionOf(tester, english.aiExplanationAr!), TextDirection.rtl);
    expect(directionOf(tester, 'hydrostatic test'), TextDirection.ltr);
    expect(directionOf(tester, 'ولادة حية'), TextDirection.rtl);
  });

  testWidgets('English interface shows an Arabic question RTL', (tester) async {
    await pumpOne(tester, deck(const [arabic]), locale: const Locale('en'));
    expect(directionOf(tester, arabic.questionText), TextDirection.rtl);
    expect(directionOf(tester, 'Question 1 of 1'), TextDirection.ltr);
  });

  testWidgets('narrow phone + large text: no overflow', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await pumpOne(
      tester,
      deck(const [english, arabic]),
      size: const Size(360, 640),
    );
    await pumpFrames(tester);
    expect(tester.takeException(), isNull);
  });
}
