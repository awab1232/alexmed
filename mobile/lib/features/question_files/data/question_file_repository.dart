import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/json.dart';
import '../../../core/api/rest_client.dart';
import '../../../core/api/trpc_client.dart';
import '../../../core/upload/pdf_upload.dart';
import 'question_file_models.dart';

/// كتبي question files (PR16) — the web's app/books/upload (question-file
/// kind) and app/books/question-files. Extraction, OCR, segmentation,
/// image attribution and AI enrichment all run on the server; needs-review
/// questions are filtered out there and never reach a student.
class QuestionFileRepository {
  QuestionFileRepository({
    required this.trpc,
    required this.rest,
    required this.uploader,
  });

  final TrpcClient trpc;
  final RestClient rest;
  final PdfUploader uploader;

  /// Upload → /api/books/extract-questions-and-plan. Returns the file's id.
  Future<String> upload({
    required PickedPdf pdf,
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
    final planned = await rest.postJson(
      '/api/books/extract-questions-and-plan',
      {'key': key, 'fileName': pdf.name, 'subjectId': subjectId},
      cancelToken: cancelToken,
    );
    return asMap(planned).str('bookId');
  }

  Future<List<QuestionFileSummary>> list() => trpc.query(
    'questionFiles.list',
    offline: true,
    parse: (data) => [
      for (final row in asMapList(data)) QuestionFileSummary.fromJson(row),
    ],
  );

  Future<QuestionFileDetail> get(String id) => trpc.query(
    'questionFiles.get',
    offline: true,
    input: {'bookId': id},
    parse: (data) => QuestionFileDetail.fromJson(asMap(data)),
  );

  Future<void> retryExtraction(String id) => trpc.mutation(
    'questionFiles.retryExtraction',
    input: {'bookId': id},
    parse: (_) {},
  );
}

final questionFileRepositoryProvider = Provider<QuestionFileRepository>(
  (ref) => QuestionFileRepository(
    trpc: ref.watch(trpcProvider),
    rest: ref.watch(restClientProvider),
    uploader: ref.watch(pdfUploaderProvider),
  ),
);

final questionFilesProvider = FutureProvider<List<QuestionFileSummary>>((ref) {
  ref.watch(sessionControllerProvider.select((s) => s.status));
  return ref.watch(questionFileRepositoryProvider).list();
});
