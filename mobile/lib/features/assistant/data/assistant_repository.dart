import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/text_stream.dart';
import '../../../core/storage/local_store.dart';
import '../domain/niro_turn.dart';

/// Niro, the general assistant — the web's app/assistant: POST
/// /api/assistant/chat (plan quota, rate limits and the model all on the
/// server), the answer streamed as plain text. The conversation stays on
/// this device, as the web keeps it in the browser (D8, recommended
/// default), and is deleted on sign-out.
class AssistantRepository {
  AssistantRepository({required this.dio, required this.store});

  final Dio dio;
  final LocalStore store;

  static const _historyKey = 'niro-history';
  static const _cameraExplainedKey = 'niro-camera-explained';

  Stream<String> ask({
    required String message,
    String? imageDataUrl,
    required List<Map<String, Object?>> history,
    CancelToken? cancelToken,
  }) => streamTextAnswer(dio, '/api/assistant/chat', {
    'message': message,
    'image': ?imageDataUrl,
    'history': history,
  }, cancelToken: cancelToken);

  Future<List<NiroTurn>> loadHistory() async {
    try {
      final saved = await store.read(_historyKey);
      if (saved is! List) return const [];
      final turns = [
        for (final t in saved)
          if (t is Map) NiroTurn.fromJson(t.cast<String, Object?>()),
      ];
      return turns.length > savedTurns
          ? turns.sublist(turns.length - savedTurns)
          : turns;
    } catch (_) {
      return const [];
    }
  }

  Future<void> saveHistory(List<NiroTurn> turns) async {
    final trimmed = turns.length > savedTurns
        ? turns.sublist(turns.length - savedTurns)
        : turns;
    try {
      await store.write(_historyKey, [for (final t in trimmed) t.toJson()]);
    } catch (_) {
      // Storage failing never breaks the chat — it works for this visit.
    }
  }

  Future<bool> cameraExplained() async {
    try {
      return await store.read(_cameraExplainedKey) == true;
    } catch (_) {
      return false;
    }
  }

  Future<void> setCameraExplained() async {
    try {
      await store.write(_cameraExplainedKey, true);
    } catch (_) {
      // Worst case the explanation shows again next time.
    }
  }
}

final assistantRepositoryProvider = Provider<AssistantRepository>(
  (ref) => AssistantRepository(
    dio: ref.watch(dioProvider),
    store: ref.watch(localStoreProvider),
  ),
);
