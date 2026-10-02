import '../data/question_file_models.dart';

// The question cards' rules, ported from components/questions/QuestionList.tsx
// (correctAnswerOf, optionState, deckProgress) and proven identical by
// test/features/question_files/question_rules_parity_test.dart on the web
// code's own output (tool/export_question_rules_fixtures.ts).

/// The answer a card checks against: the file's own stated answer, else the
/// pipeline's AI suggestion (labelled as such), else none.
({int? index, bool fromAi}) correctAnswerOf(QuestionItem question) {
  if (question.extractedAnswerIndex != null) {
    return (index: question.extractedAnswerIndex, fromAi: false);
  }
  if (question.aiInferredAnswerIndex != null) {
    return (index: question.aiInferredAnswerIndex, fromAi: true);
  }
  return (index: null, fromAi: false);
}

enum OptionState { idle, correct, wrong, chosen, dimmed }

/// How option [i] looks once the card is answered or revealed. Before that
/// every option is idle and tappable.
OptionState optionState(
  int i, {
  required int? selected,
  required bool revealed,
  required int? correct,
}) {
  if (!revealed) return OptionState.idle;
  if (correct == null) {
    return selected == i ? OptionState.chosen : OptionState.idle;
  }
  if (i == correct) return OptionState.correct;
  if (i == selected) return OptionState.wrong;
  return OptionState.dimmed;
}

/// A student's answer to one card.
final class CardAnswer {
  const CardAnswer({this.selected, this.revealed = false});

  final int? selected;
  final bool revealed;

  static const empty = CardAnswer();
}

/// The running tally for the progress line.
({int answered, int correct}) deckProgress(
  List<QuestionItem> questions,
  Map<String, CardAnswer> answers,
) {
  var answered = 0;
  var correct = 0;
  for (final question in questions) {
    final answer = answers[question.id];
    if (answer == null || answer.selected == null) continue;
    answered++;
    if (answer.selected == correctAnswerOf(question).index) correct++;
  }
  return (answered: answered, correct: correct);
}

/// ✓ / ✗ / none for the picker.
bool? answerMark(QuestionItem question, CardAnswer? answer) {
  if (answer?.selected == null) return null;
  return answer!.selected == correctAnswerOf(question).index;
}

const _arabicDigits = '٠١٢٣٤٥٦٧٨٩';

/// 12 → ١٢ (the Arabic translation's option numbers).
String arabicNumber(int n) => '$n'.replaceAllMapped(
  RegExp(r'\d'),
  (m) => _arabicDigits[int.parse(m[0]!)],
);
