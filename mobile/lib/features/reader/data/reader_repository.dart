import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/json.dart';
import '../../../core/api/text_stream.dart';
import '../../../core/api/trpc_client.dart';
import '../domain/pdf_marks.dart';
import 'pdf_range_source.dart';

/// What the reader needs about the book. The storage key stays in memory
/// only — never shown, never logged.
final class ReaderBook {
  const ReaderBook({
    required this.id,
    required this.fileName,
    required this.fileKey,
    required this.pageCount,
  });

  final String id;
  final String fileName;
  final String fileKey;
  final int pageCount;
}

/// ask-selection quick actions (the web's SelectionAssistant).
enum AskAction { explain, arabic, exam, summarize, ask }

final class ChatTurn {
  const ChatTurn({
    required this.role,
    required this.content,
    this.citedPages = const [],
  });

  final String role; // user | assistant
  final String content;

  /// Source pages of an assistant answer (study chat).
  final List<int> citedPages;

  bool get isUser => role == 'user';

  Map<String, Object?> toJson() => {'role': role, 'content': content};
}

/// Reader, page marks, ask-about-selection and book chat — the web's
/// app/books/[bookId]/read, components/PdfViewer.tsx,
/// components/pdf/SelectionAssistant.tsx and components/study/StudyAiSheet.
class ReaderRepository {
  ReaderRepository({required this.trpc, required this.dio});

  final TrpcClient trpc;
  final Dio dio;

  /// books.get (owner or accepted share); null when the book has no file.
  Future<ReaderBook?> book(String bookId) => trpc.query(
    'books.get',
    offline: true,
    input: {'id': bookId},
    parse: (data) {
      final book = asMap(asMap(data)['book']);
      final key = book.strOrNull('fileKey');
      if (key == null || key.isEmpty) return null;
      return ReaderBook(
        id: book.str('id'),
        fileName: book.strOrNull('fileName') ?? '',
        fileKey: key,
        pageCount: book.integer('pageCount'),
      );
    },
  );

  PdfRangeSource source(ReaderBook book) =>
      PdfRangeSource(dio: dio, fileKey: book.fileKey);

  /// Every page's marks for this user in one call (superjson Map).
  Future<Map<int, PageMarks>> marks(String bookId) => trpc.query(
    'bookPageMarks.list',
    offline: true,
    input: {'bookId': bookId},
    parse: (data) => {
      if (data is Map)
        for (final MapEntry(:key, :value) in data.entries)
          if (value is Map && (key is num || int.tryParse('$key') != null))
            (key is num ? key.toInt() : int.parse('$key')): PageMarks.fromJson(
              value.cast<String, Object?>(),
            ),
    },
  );

  /// Replaces one page's marks (an empty set deletes the row).
  Future<void> saveMarks(String bookId, int pageNumber, PageMarks marks) =>
      trpc.mutation(
        'bookPageMarks.save',
        input: {
          'bookId': bookId,
          'pageNumber': pageNumber,
          'highlights': [for (final h in marks.highlights) h.toJson()],
          'strokes': [for (final s in marks.strokes) s.toJson()],
        },
        parse: (_) {},
      );

  /// «اسأل Niro» about the selected text (or the whole page when empty),
  /// streamed as plain text as it is written.
  Stream<String> askSelection({
    required String bookId,
    required int pageNumber,
    required String selectedText,
    required AskAction action,
    String? question,
    String? fileName,
    List<ChatTurn> history = const [],
    CancelToken? cancelToken,
  }) => streamTextAnswer(dio, '/api/books/ask-selection', {
    'bookId': bookId,
    'pageNumber': pageNumber,
    'selectedText': selectedText.length > 4000
        ? selectedText.substring(0, 4000)
        : selectedText,
    'action': action.name,
    'question': ?question,
    'fileName': ?fileName,
    'history': [
      for (final t
          in history.length > 10
              ? history.sublist(history.length - 10)
              : history)
        {
          'role': t.role,
          'content': t.content.length > 6000
              ? t.content.substring(0, 6000)
              : t.content,
        },
    ],
  }, cancelToken: cancelToken);

  /// The book's study-chat session (created once per user and book).
  Future<String> chatSession(String bookId) => trpc.mutation(
    'chat.getOrCreateSession',
    input: {'scope': 'book', 'bookId': bookId},
    parse: (data) => asMap(data).str('id'),
  );

  Future<List<ChatTurn>> chatMessages(String sessionId) => trpc.query(
    'chat.listMessages',
    offline: true,
    input: {'sessionId': sessionId},
    parse: (data) => [
      for (final m in asMapList(data))
        ChatTurn(
          role: m.strOrNull('role') ?? 'assistant',
          content: m.strOrNull('content') ?? '',
          citedPages: [
            for (final p in (m['citedPages'] as List?) ?? const [])
              if (p is Map && p['pageNumber'] is num)
                (p['pageNumber']! as num).toInt(),
          ],
        ),
    ],
  );

  /// Study chat answer, streamed; the server saves both turns.
  Stream<String> chatAsk({
    required String sessionId,
    required String question,
    CancelToken? cancelToken,
  }) => streamTextAnswer(dio, '/api/chat/stream', {
    'sessionId': sessionId,
    'question': question,
  }, cancelToken: cancelToken);
}

final readerRepositoryProvider = Provider<ReaderRepository>(
  (ref) => ReaderRepository(
    trpc: ref.watch(trpcProvider),
    dio: ref.watch(dioProvider),
  ),
);
