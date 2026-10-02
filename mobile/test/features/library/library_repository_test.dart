import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/api/http_client.dart';
import 'package:nirolearn/core/api/trpc_client.dart';
import 'package:nirolearn/core/auth/session_store.dart';
import 'package:nirolearn/features/library/data/library_models.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';

import '../../helpers/fake_http.dart';

/// tRPC success envelope with superjson Date annotations, as the server
/// sends it.
String ok(Object? json, {Map<String, List<String>>? dates}) => jsonEncode({
  'result': {
    'data': {
      'json': json,
      if (dates != null) 'meta': {'values': dates},
    },
  },
});

void main() {
  late FakeAdapter adapter;
  final sessions = MemorySessionStore(
    StoredSession(token: 't', expiresAt: DateTime.utc(2099)),
  );

  LibraryRepository repo() => LibraryRepository(
    TrpcClient(
      createApiDio(
        env: testEnv,
        sessions: sessions,
        onSessionRejected: () {},
        adapter: adapter,
      ),
    ),
  );

  test('subjects.list → folders with counts and Dates', () async {
    adapter = FakeAdapter(
      (_, _) => (
        status: 200,
        body: ok(
          [
            {
              'id': 's1',
              'name': 'تشريح',
              'type': 'medical',
              'description': null,
              'color': null,
              'icon': null,
              'examDate': '2026-10-05T00:00:00.000Z',
              'targetDate': null,
              'createdAt': '2026-09-01T00:00:00.000Z',
              'bookCount': 3,
              'lastUpdatedAt': '2026-09-20T10:00:00.000Z',
              'deckCount': 1,
            },
          ],
          dates: {
            '0.examDate': ['Date'],
            '0.createdAt': ['Date'],
            '0.lastUpdatedAt': ['Date'],
          },
        ),
      ),
    );
    final folders = await repo().subjects();
    expect(folders.single.name, 'تشريح');
    expect(folders.single.typeLabel, 'طبي');
    expect(folders.single.bookCount, 3);
    expect(folders.single.deckCount, 1);
    expect(folders.single.examDate, DateTime.utc(2026, 10, 5));
    expect(adapter.requests.single.uri.path, '/api/trpc/subjects.list');
  });

  test('books.list → states follow the web rule', () async {
    adapter = FakeAdapter(
      (_, _) => (
        status: 200,
        body: ok([
          {
            'id': 'b1',
            'fileName': 'Cardio_Lecture_3.pdf',
            'pageCount': 40,
            'subjectId': 's1',
            'chapterCount': 0,
            'completeChapterCount': 0,
          },
          {
            'id': 'b2',
            'fileName': 'x.pdf',
            'pageCount': 10,
            'subjectId': null,
            'chapterCount': 4,
            'completeChapterCount': 0,
          },
          {
            'id': 'b3',
            'fileName': 'y.pdf',
            'pageCount': 10,
            'subjectId': null,
            'chapterCount': 4,
            'completeChapterCount': 2,
          },
        ]),
      ),
    );
    final books = await repo().books();
    expect(books.map((b) => b.state), [
      BookState.reading,
      BookState.preparing,
      BookState.ready,
    ]);
    expect(books.first.title, 'Cardio Lecture 3');
  });

  test('dueCount adds the book and question-file queues', () async {
    adapter = FakeAdapter((options, _) {
      final path = options.uri.path;
      return (
        status: 200,
        body: ok(
          List.filled(
            path.endsWith('books.dueCards') ? 3 : 2,
            <String, Object?>{},
          ),
        ),
      );
    });
    expect(await repo().dueCount(), 5);
    expect(adapter.requests.map((r) => r.uri.path).toSet(), {
      '/api/trpc/books.dueCards',
      '/api/trpc/decks.dueCards',
    });
  });

  test('sharing.homeSummary', () async {
    adapter = FakeAdapter(
      (_, _) => (
        status: 200,
        body: ok({
          'pending': 2,
          'unread': 1,
          'recent': [
            {
              'bookId': 'b9',
              'bookTitle': 'Pharma_Notes.pdf',
              'ownerName': null,
              'ownerUsername': 'sara',
            },
          ],
        }),
      ),
    );
    final summary = await repo().sharedSummary();
    expect(summary.pending, 2);
    expect(summary.recent.single.bookTitle, 'Pharma Notes');
    expect(summary.recent.single.ownerUsername, 'sara');
  });

  test('mutations send the web inputs', () async {
    adapter = FakeAdapter(
      (options, _) => (
        status: 200,
        body: options.uri.path.endsWith('subjects.create')
            ? ok({'id': 'new', 'name': 'فسيولوجي', 'type': 'medical'})
            : ok({'success': true}),
      ),
    );
    final r = repo();
    final created = await r.createSubject(name: 'فسيولوجي', type: 'medical');
    await r.renameSubject(id: 's1', name: 'تشريح 2');
    await r.deleteSubject('s1');
    await r.moveBook(bookId: 'b1', subjectId: null);
    await r.moveDeck(deckId: 'd1', subjectId: 's2');
    expect(created.id, 'new');
    expect(adapter.requests.map((r) => r.uri.path), [
      '/api/trpc/subjects.create',
      '/api/trpc/subjects.update',
      '/api/trpc/subjects.delete',
      '/api/trpc/books.setSubject',
      '/api/trpc/decks.setSubject',
    ]);
    expect(adapter.requests.every((r) => r.method == 'POST'), isTrue);
    expect(jsonDecode(adapter.bodies[3]), {
      'json': {'bookId': 'b1', 'subjectId': null},
    });
  });

  test('a changed server shape is a ServerException, not a crash', () async {
    adapter = FakeAdapter(
      (_, _) => (
        status: 200,
        body: ok([
          {'name': 'no id'},
        ]),
      ),
    );
    await expectLater(repo().subjects(), throwsA(isA<ServerException>()));
  });

  test('bookDisplayTitle matches lib/book-title.ts', () {
    expect(bookDisplayTitle('Anatomy_Lecture__1.PDF'), 'Anatomy Lecture 1');
    expect(bookDisplayTitle(''), 'كتاب بدون عنوان');
    expect(bookDisplayTitle(null), 'كتاب بدون عنوان');
    expect(bookDisplayTitle('.pdf'), '.pdf');
  });
}
