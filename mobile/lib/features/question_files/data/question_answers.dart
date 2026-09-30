import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../domain/question_rules.dart';

/// The student's answers per question file (file id → question id →
/// answer) and where they were, for this app session — leaving and
/// reopening a file keeps both. Protected doctor sets never use this: their
/// answers stay inside the screen and are gone when it closes.
final questionAnswersProvider =
    NotifierProvider<QuestionAnswers, Map<String, Map<String, CardAnswer>>>(
      QuestionAnswers.new,
    );

class QuestionAnswers extends Notifier<Map<String, Map<String, CardAnswer>>> {
  @override
  Map<String, Map<String, CardAnswer>> build() {
    // A new account starts fresh.
    ref.watch(sessionControllerProvider.select((s) => s.status));
    return {};
  }

  void set(String fileId, String questionId, CardAnswer answer) {
    state = {
      ...state,
      fileId: {...?state[fileId], questionId: answer},
    };
  }

  /// Every answer in [fileId] (restored from disk, P14).
  void restore(String fileId, Map<String, CardAnswer> answers) {
    state = {...state, fileId: answers};
  }
}

final questionPositionProvider =
    NotifierProvider<QuestionPositions, Map<String, int>>(
      QuestionPositions.new,
    );

class QuestionPositions extends Notifier<Map<String, int>> {
  @override
  Map<String, int> build() {
    ref.watch(sessionControllerProvider.select((s) => s.status));
    return {};
  }

  void set(String fileId, int index) => state = {...state, fileId: index};
}
