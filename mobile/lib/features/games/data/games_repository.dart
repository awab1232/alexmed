import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/json.dart';
import '../../../core/api/trpc_client.dart';
import '../../../core/storage/local_store.dart';
import '../domain/game_rules.dart';
import 'games_models.dart';

/// Brain games on the existing server (online only). The stage in play is
/// also kept on the device (the web uses localStorage) so a closed app
/// resumes exactly where it was — answers already given are never asked
/// again, and a finished stage is re-submitted (the server is idempotent).
class GamesRepository {
  GamesRepository({required this.trpc, required this.store});

  final TrpcClient trpc;
  final LocalStore store;

  Future<List<GameSummary>> overview() => trpc.query(
    'brainGames.overview',
    parse: (data) => [for (final g in asMapList(data)) GameSummary.fromJson(g)],
  );

  Future<GameSummary> game(String gameId) => trpc.query(
    'brainGames.game',
    input: {'gameId': gameId},
    parse: (data) => GameSummary.fromJson(asMap(data)),
  );

  Future<GameSession?> activeSession(String gameId) => trpc.query(
    'brainGames.activeSession',
    input: {'gameId': gameId},
    parse: (data) => data == null ? null : GameSession.fromJson(asMap(data)),
  );

  /// The server refuses a locked stage (FORBIDDEN).
  Future<GameSession> startStage(String gameId, int stage) => trpc.mutation(
    'brainGames.startStage',
    input: {'gameId': gameId, 'stage': stage},
    parse: (data) => GameSession.fromJson(asMap(data)),
  );

  Future<StageResult> submitQuiz(String sessionId, List<QuizAnswer> answers) =>
      trpc.mutation(
        'brainGames.submitQuiz',
        input: {
          'sessionId': sessionId,
          'answers': [for (final a in answers) a.toJson()],
        },
        parse: (data) => StageResult.fromJson(asMap(data)),
      );

  Future<void> sudokuSave(String sessionId, SudokuState state) => trpc.mutation(
    'brainGames.sudokuSave',
    input: {'sessionId': sessionId, ...state.toJson()},
    parse: (_) {},
  );

  Future<({int index, int value, int hintsUsed})> sudokuHint(
    String sessionId,
    List<int> board,
  ) => trpc.mutation(
    'brainGames.sudokuHint',
    input: {'sessionId': sessionId, 'board': board},
    parse: (data) {
      final json = asMap(data);
      return (
        index: json.integer('index'),
        value: json.integer('value'),
        hintsUsed: json.integer('hintsUsed'),
      );
    },
  );

  Future<StageResult> submitSudoku(String sessionId, SudokuState state) =>
      trpc.mutation(
        'brainGames.submitSudoku',
        input: {
          'sessionId': sessionId,
          'board': state.board,
          'elapsedMs': state.elapsedMs,
          'mistakes': state.mistakes,
        },
        parse: (data) => StageResult.fromJson(asMap(data)),
      );

  // ── On-device resume copies (the web's localStorage keys) ─────────────

  String _quizKey(String sessionId) => 'game-quiz-${sessionId.toLowerCase()}';
  String _sudokuKey(String sessionId) =>
      'game-sudoku-${sessionId.toLowerCase()}';

  Future<QuizProgress?> loadQuiz(String sessionId) async {
    try {
      final json = await store.read(_quizKey(sessionId));
      return json is Map ? QuizProgress.fromJson(json.cast()) : null;
    } catch (_) {
      return null;
    }
  }

  Future<void> saveQuiz(String sessionId, QuizProgress progress) async {
    try {
      await store.write(_quizKey(sessionId), progress.toJson());
    } catch (_) {}
  }

  Future<void> clearQuiz(String sessionId) async {
    try {
      await store.delete(_quizKey(sessionId));
    } catch (_) {}
  }

  Future<SudokuState?> loadSudoku(String sessionId) async {
    try {
      return SudokuState.tryParse(await store.read(_sudokuKey(sessionId)));
    } catch (_) {
      return null;
    }
  }

  Future<void> saveSudokuLocal(String sessionId, SudokuState state) async {
    try {
      await store.write(_sudokuKey(sessionId), state.toJson());
    } catch (_) {}
  }

  Future<void> clearSudoku(String sessionId) async {
    try {
      await store.delete(_sudokuKey(sessionId));
    } catch (_) {}
  }
}

/// A quiz stage in progress: where the student is, their answers, and when
/// the current question was shown (epoch ms) — the deadline is always
/// shownAt + limit, so reopening the app never grants extra time.
final class QuizProgress {
  const QuizProgress({
    required this.index,
    required this.answers,
    this.shownAt,
  });

  factory QuizProgress.fromJson(Map<String, Object?> json) => QuizProgress(
    index: (json['index'] as num?)?.toInt() ?? 0,
    answers: [
      for (final a in (json['answers'] as List?) ?? const [])
        QuizAnswer.fromJson((a as Map).cast()),
    ],
    shownAt: (json['shownAt'] as num?)?.toInt(),
  );

  final int index;
  final List<QuizAnswer> answers;
  final int? shownAt;

  Map<String, Object?> toJson() => {
    'index': index,
    'answers': [for (final a in answers) a.toJson()],
    'shownAt': shownAt,
  };
}

/// A Sudoku board in progress (the web's SavedBoard).
final class SudokuState {
  const SudokuState({
    required this.board,
    required this.notes,
    required this.elapsedMs,
    required this.mistakes,
  });

  static SudokuState? tryParse(Object? value) {
    if (value is! Map) return null;
    final board = value['board'];
    final notes = value['notes'];
    if (board is! List || board.length != 81) return null;
    if (notes is! List || notes.length != 81) return null;
    return SudokuState(
      board: [for (final v in board) (v as num).toInt()],
      notes: [
        for (final n in notes)
          [for (final d in (n as List)) (d as num).toInt()],
      ],
      elapsedMs: (value['elapsedMs'] as num?)?.toInt() ?? 0,
      mistakes: (value['mistakes'] as num?)?.toInt() ?? 0,
    );
  }

  final List<int> board;
  final List<List<int>> notes;
  final int elapsedMs;
  final int mistakes;

  Map<String, Object?> toJson() => {
    'board': board,
    'notes': notes,
    'elapsedMs': elapsedMs,
    'mistakes': mistakes,
  };
}

final gamesRepositoryProvider = Provider<GamesRepository>(
  (ref) => GamesRepository(
    trpc: ref.watch(trpcProvider),
    store: ref.watch(localStoreProvider),
  ),
);

final gamesOverviewProvider = FutureProvider<List<GameSummary>>((ref) {
  ref.watch(sessionControllerProvider.select((s) => s.status));
  return ref.watch(gamesRepositoryProvider).overview();
});

final gameProvider = FutureProvider.family<GameSummary, String>((ref, id) {
  ref.watch(sessionControllerProvider.select((s) => s.status));
  return ref.watch(gamesRepositoryProvider).game(id);
});
