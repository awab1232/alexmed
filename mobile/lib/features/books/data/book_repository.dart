import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/json.dart';
import '../../../core/api/rest_client.dart';
import '../../../core/api/trpc_client.dart';
import '../../../core/upload/pdf_upload.dart';
import 'book_models.dart';

/// Study books on the existing server — the same calls as the web's
/// app/books/upload/page.tsx and app/books/[bookId]/page.tsx. Extraction,
/// OCR, chapter detection and analysis all run on the server (QStash
/// workers); the app uploads, starts, reads progress and asks for retries.
class BookRepository {
  BookRepository({
    required this.trpc,
    required this.rest,
    required this.uploader,
  });

  final TrpcClient trpc;
  final RestClient rest;
  final PdfUploader uploader;

  /// Upload → /api/books/extract-and-plan. Returns the new book's id.
  Future<String> upload({
    required PickedPdf pdf,
    required String profile,
    required String subjectId,
    void Function(double progress)? onProgress,
    CancelToken? cancelToken,
  }) async {
    final key = await uploader.upload(
      pdf,
      uploadUrlPath: '/api/books/upload-url',
      onProgress: onProgress,
      cancelToken: cancelToken,
    );
    final planned = await rest.postJson('/api/books/extract-and-plan', {
      'key': key,
      'fileName': pdf.name,
      'profile': profile,
      'subjectId': subjectId,
    }, cancelToken: cancelToken);
    return asMap(planned).str('bookId');
  }

  Future<BookDetail> get(String id) => trpc.query(
    'books.get',
    input: {'id': id},
    parse: (data) => BookDetail.fromJson(asMap(data)),
  );

  Future<List<BookPage>> pages(String bookId) => trpc.query(
    'books.listPages',
    input: {'bookId': bookId},
    parse: (data) => asMapList(data).map(BookPage.fromJson).toList(),
  );

  Future<CoverageReport?> coverage(String bookId) => trpc.query(
    'books.getCoverageReport',
    input: {'bookId': bookId},
    parse: (data) => data == null ? null : CoverageReport.fromJson(asMap(data)),
  );

  Future<CoverageDetail?> coverageDetail(String bookId) => trpc.query(
    'books.getCoverageDetail',
    input: {'bookId': bookId},
    parse: (data) => data == null ? null : CoverageDetail.fromJson(asMap(data)),
  );

  /// Null = not created yet, or (shared book) the owner has not made one.
  Future<ExamFocusTile?> examFocus(String bookId) async {
    try {
      return await trpc.query(
        'examFocus.get',
        input: {'bookId': bookId},
        parse: (data) =>
            data == null ? null : ExamFocusTile.fromJson(asMap(data)),
      );
    } on RejectedException catch (e) {
      if (e.code == 'PRECONDITION_FAILED') return null;
      rethrow;
    }
  }

  /// "جهّز أدوات الدراسة" — idempotent on the server.
  Future<void> startAnalysis(String bookId) => trpc.mutation(
    'books.startChapterAnalysis',
    input: {'bookId': bookId},
    parse: (_) {},
  );

  /// Re-queues chapters that stopped moving; the server decides which.
  Future<void> resumeAnalysis(String bookId) => trpc.mutation(
    'books.resumeChapterAnalysis',
    input: {'bookId': bookId},
    parse: (_) {},
  );

  Future<void> retryChapter(String chapterId) => trpc.mutation(
    'books.retryChapter',
    input: {'chapterId': chapterId},
    parse: (_) {},
  );

  Future<void> retryExtraction(String bookId) => trpc.mutation(
    'books.retryExtraction',
    input: {'bookId': bookId},
    parse: (_) {},
  );

  /// A shared book leaves the viewer's library; the owner keeps the
  /// original and can share it again.
  Future<void> removeFromLibrary(String bookId) => trpc.mutation(
    'sharing.removeFromLibrary',
    input: {'bookId': bookId},
    parse: (_) {},
  );

  Future<void> retryPageText(String pageId) => trpc.mutation(
    'books.retryPageText',
    input: {'pageId': pageId},
    parse: (_) {},
  );
}

final bookRepositoryProvider = Provider<BookRepository>(
  (ref) => BookRepository(
    trpc: ref.watch(trpcProvider),
    rest: ref.watch(restClientProvider),
    uploader: ref.watch(pdfUploaderProvider),
  ),
);
