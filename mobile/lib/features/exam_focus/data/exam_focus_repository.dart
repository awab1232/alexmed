import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/json.dart';
import '../../../core/api/trpc_client.dart';
import 'exam_focus_models.dart';

/// Exam Focus on the existing server — the same calls as the web's
/// app/books/[bookId]/exam-focus. Extraction, deduplication and card
/// building all run in queue workers; the app starts / follows / reads.
class ExamFocusRepository {
  ExamFocusRepository(this.trpc);

  final TrpcClient trpc;

  /// Null = not created yet. A shared book whose owner never made one
  /// fails with the server's own message (RejectedException
  /// PRECONDITION_FAILED), shown as is.
  Future<ExamFocusDeck?> get(String bookId) => trpc.query(
    'examFocus.get',
    input: {'bookId': bookId},
    parse: (data) => data == null ? null : ExamFocusDeck.fromJson(asMap(data)),
  );

  Future<void> start(String bookId) => trpc.mutation(
    'examFocus.start',
    input: {'bookId': bookId},
    parse: (_) {},
  );

  /// Refused while generating or within the cooldown — the server says why.
  Future<void> regenerate(String bookId) => trpc.mutation(
    'examFocus.regenerate',
    input: {'bookId': bookId},
    parse: (_) {},
  );

  /// Re-runs only the failed units.
  Future<void> retryFailed(String bookId) => trpc.mutation(
    'examFocus.retryFailed',
    input: {'bookId': bookId},
    parse: (_) {},
  );

  Future<void> resume(String bookId) => trpc.mutation(
    'examFocus.resume',
    input: {'bookId': bookId},
    parse: (_) {},
  );

  /// Filtered and searched on the server over the whole deck.
  Future<ExamFocusPage> cards(
    String bookId, {
    String? category,
    bool bookmarkedOnly = false,
    String? search,
    int cursor = 0,
    int limit = 40,
  }) => trpc.query(
    'examFocus.cards',
    input: {
      'bookId': bookId,
      'category': ?category,
      if (bookmarkedOnly) 'bookmarkedOnly': true,
      if (search != null && search.isNotEmpty) 'search': search,
      'cursor': cursor,
      'limit': limit,
    },
    parse: (data) {
      final json = asMap(data);
      return (
        items: asMapList(json['items']).map(ExamFocusCard.fromJson).toList(),
        total: json.integer('total'),
        next: json.intOrNull('nextCursor'),
      );
    },
  );

  Future<void> setBookmark(String cardId, bool bookmarked) => trpc.mutation(
    'examFocus.setBookmark',
    input: {'cardId': cardId, 'bookmarked': bookmarked},
    parse: (_) {},
  );
}

final examFocusRepositoryProvider = Provider<ExamFocusRepository>(
  (ref) => ExamFocusRepository(ref.watch(trpcProvider)),
);

/// Where the student was in the unfiltered deck, per book, for this app
/// session (the web keeps it in localStorage). Survives leaving and
/// reopening the screen; kept across restarts once offline storage lands
/// (P14).
final examFocusPositionProvider =
    NotifierProvider<_Positions, Map<String, int>>(_Positions.new);

class _Positions extends Notifier<Map<String, int>> {
  @override
  Map<String, int> build() {
    // A new account starts fresh.
    ref.watch(sessionControllerProvider.select((s) => s.status));
    return {};
  }

  void set(String bookId, int index) => state = {...state, bookId: index};
}
