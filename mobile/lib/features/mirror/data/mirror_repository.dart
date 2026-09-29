import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/json.dart';
import '../../../core/api/rest_client.dart';
import '../../../core/api/trpc_client.dart';
import '../../../core/upload/pdf_upload.dart';
import 'mirror_models.dart';

/// مِرآة on the existing server — the same calls as the web's
/// components/Home.tsx and app/mirror/[jobId]/page.tsx. All analysis, OCR
/// and card generation stays on the server (QStash workers); the app only
/// uploads, starts jobs, and reads their progress.
class MirrorRepository {
  MirrorRepository({
    required this.trpc,
    required this.rest,
    required this.uploader,
  });

  final TrpcClient trpc;
  final RestClient rest;
  final PdfUploader uploader;

  /// Upload → /api/mirror/upload-and-plan. Returns the job id.
  Future<String> startFromPdf({
    required PickedPdf pdf,
    required MirrorDepth depth,
    required String subjectId,
    void Function(double progress)? onProgress,
    CancelToken? cancelToken,
  }) async {
    final key = await uploader.upload(
      pdf,
      uploadUrlPath: '/api/pdf/upload-url',
      onProgress: onProgress,
      cancelToken: cancelToken,
    );
    final planned = await rest.postJson('/api/mirror/upload-and-plan', {
      'key': key,
      'fileName': pdf.name,
      'depth': depth.wire,
      'subjectId': subjectId,
    }, cancelToken: cancelToken);
    return asMap(planned).str('jobId');
  }

  /// Pasted question text (mirror.submitText) — to a new file in a folder,
  /// or added to an existing file. Returns (jobId, deckId).
  Future<({String jobId, String deckId})> startFromText({
    required String text,
    required MirrorDepth depth,
    String? subjectId,
    String? appendToDeckId,
    String? title,
  }) {
    final target = appendToDeckId != null
        ? {
            'mode': 'append',
            'deckId': appendToDeckId,
            if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
          }
        : {
            'mode': 'new',
            'subjectId': subjectId,
            if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
          };
    return trpc.mutation(
      'mirror.submitText',
      input: {'text': text, 'depth': depth.wire, 'target': target},
      parse: (data) {
        final json = asMap(data);
        return (jobId: json.str('jobId'), deckId: json.str('deckId'));
      },
    );
  }

  Future<MirrorJob> job(String id) => trpc.query(
    'mirror.get',
    input: {'id': id},
    parse: (data) => MirrorJob.fromJson(asMap(data)),
  );

  Future<void> retryBatch(String batchId) => trpc.mutation(
    'mirror.retryBatch',
    input: {'batchId': batchId},
    parse: (_) {},
  );

  Future<void> retryExtraction(String jobId) => trpc.mutation(
    'mirror.retryExtraction',
    input: {'jobId': jobId},
    parse: (_) {},
  );

  Future<MirrorDeck> deck(String id) => trpc.query(
    'decks.get',
    input: {'id': id},
    parse: (data) => MirrorDeck.fromJson(asMap(data)),
  );

  Future<void> deleteDeck(String id) =>
      trpc.mutation('decks.delete', input: {'id': id}, parse: (_) {});
}

final mirrorRepositoryProvider = Provider<MirrorRepository>(
  (ref) => MirrorRepository(
    trpc: ref.watch(trpcProvider),
    rest: ref.watch(restClientProvider),
    uploader: ref.watch(pdfUploaderProvider),
  ),
);
