import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/json.dart';
import '../../../core/api/trpc_client.dart';
import 'library_models.dart';

/// Folders, books, question-file decks and the Home summaries — the same
/// tRPC procedures the web's /subjects and /subjects/[id] pages use.
class LibraryRepository {
  LibraryRepository(this._trpc);

  final TrpcClient _trpc;

  Future<List<Subject>> subjects() => _trpc.query(
    'subjects.list',
    parse: (data) => [for (final row in asMapList(data)) Subject.fromJson(row)],
  );

  Future<Subject> subject(String id) => _trpc.query(
    'subjects.get',
    input: {'id': id},
    parse: (data) => Subject.fromJson(asMap(data)),
  );

  Future<Subject> createSubject({required String name, required String type}) =>
      _trpc.mutation(
        'subjects.create',
        input: {'name': name, 'type': type},
        parse: (data) => Subject.fromJson(asMap(data)),
      );

  Future<void> renameSubject({required String id, required String name}) =>
      _trpc.mutation(
        'subjects.update',
        input: {'id': id, 'name': name},
        parse: (_) {},
      );

  Future<void> deleteSubject(String id) =>
      _trpc.mutation('subjects.delete', input: {'id': id}, parse: (_) {});

  Future<List<BookSummary>> books() => _trpc.query(
    'books.list',
    parse: (data) => [
      for (final row in asMapList(data)) BookSummary.fromJson(row),
    ],
  );

  Future<List<DeckSummary>> decks() => _trpc.query(
    'decks.list',
    parse: (data) => [
      for (final row in asMapList(data)) DeckSummary.fromJson(row),
    ],
  );

  /// Books + question-file cards due for review (the web's StudyNext sums
  /// the two queues). The queues return whole cards; only the count is
  /// used here.
  Future<int> dueCount() async {
    final results = await Future.wait([
      _trpc.query('books.dueCards', parse: (data) => (data! as List).length),
      _trpc.query('decks.dueCards', parse: (data) => (data! as List).length),
    ]);
    return results[0] + results[1];
  }

  Future<void> moveBook({required String bookId, String? subjectId}) =>
      _trpc.mutation(
        'books.setSubject',
        input: {'bookId': bookId, 'subjectId': subjectId},
        parse: (_) {},
      );

  Future<void> moveDeck({required String deckId, String? subjectId}) =>
      _trpc.mutation(
        'decks.setSubject',
        input: {'deckId': deckId, 'subjectId': subjectId},
        parse: (_) {},
      );

  Future<SharedSummary> sharedSummary() => _trpc.query(
    'sharing.homeSummary',
    parse: (data) => SharedSummary.fromJson(asMap(data)),
  );

  /// The signed-in user's display name (auth.me), for the greeting.
  Future<String?> myName() => _trpc.query(
    'auth.me',
    parse: (data) => data == null ? null : asMap(data).strOrNull('name'),
  );
}

final libraryRepositoryProvider = Provider<LibraryRepository>(
  (ref) => LibraryRepository(ref.watch(trpcProvider)),
);

/// Changes whenever someone signs in or out, so every account-scoped
/// provider below is rebuilt and never shows the previous account's data.
final _accountScope = Provider<Object>(
  (ref) => ref.watch(sessionControllerProvider.select((s) => s.status)),
);

final subjectsProvider = FutureProvider<List<Subject>>((ref) {
  ref.watch(_accountScope);
  return ref.watch(libraryRepositoryProvider).subjects();
});

final subjectProvider = FutureProvider.family<Subject, String>((ref, id) {
  ref.watch(_accountScope);
  return ref.watch(libraryRepositoryProvider).subject(id);
});

final booksProvider = FutureProvider<List<BookSummary>>((ref) {
  ref.watch(_accountScope);
  return ref.watch(libraryRepositoryProvider).books();
});

final decksProvider = FutureProvider<List<DeckSummary>>((ref) {
  ref.watch(_accountScope);
  return ref.watch(libraryRepositoryProvider).decks();
});

final dueCountProvider = FutureProvider<int>((ref) {
  ref.watch(_accountScope);
  return ref.watch(libraryRepositoryProvider).dueCount();
});

final sharedSummaryProvider = FutureProvider<SharedSummary>((ref) {
  ref.watch(_accountScope);
  return ref.watch(libraryRepositoryProvider).sharedSummary();
});

final myNameProvider = FutureProvider<String?>((ref) {
  ref.watch(_accountScope);
  return ref.watch(libraryRepositoryProvider).myName();
});

/// Everything Home shows — refreshed together by pull-to-refresh.
void refreshLibrary(WidgetRef ref) {
  ref
    ..invalidate(subjectsProvider)
    ..invalidate(booksProvider)
    ..invalidate(decksProvider)
    ..invalidate(dueCountProvider)
    ..invalidate(sharedSummaryProvider);
}
