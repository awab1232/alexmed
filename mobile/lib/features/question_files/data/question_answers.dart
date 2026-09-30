import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/persisted_map.dart';
import '../domain/question_rules.dart';

/// The student's answers per question file (file id → question id →
/// answer) and where they were, kept on the device — leaving the file or
/// restarting the app keeps both. Protected doctor sets never use this: their
/// answers stay inside the screen and are gone when it closes.
final questionAnswersProvider =
    NotifierProvider<QuestionAnswers, Map<String, Map<String, CardAnswer>>>(
      QuestionAnswers.new,
    );

class QuestionAnswers extends PersistedMapNotifier<Map<String, CardAnswer>> {
  @override
  String get storeKey => 'answers-question-files';

  // Answers of the 40 most recently used files.
  @override
  int get maxEntries => 40;

  @override
  Object? encode(Map<String, CardAnswer> value) => {
    for (final MapEntry(:key, :value) in value.entries)
      key: {'s': value.selected, 'r': value.revealed},
  };

  @override
  Map<String, CardAnswer>? decode(Object? json) {
    if (json is! Map) return null;
    return {
      for (final MapEntry(:key, :value) in json.entries)
        if (value is Map)
          '$key': CardAnswer(
            selected: (value['s'] as num?)?.toInt(),
            revealed: value['r'] == true,
          ),
    };
  }

  void set(String fileId, String questionId, CardAnswer answer) =>
      put(fileId, {...?state[fileId], questionId: answer});
}

final questionPositionProvider =
    NotifierProvider<QuestionPositions, Map<String, int>>(
      QuestionPositions.new,
    );

class QuestionPositions extends PersistedIntMap {
  @override
  String get storeKey => 'pos-question-files';
}
