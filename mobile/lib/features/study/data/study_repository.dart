import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/json.dart';
import '../../../core/api/trpc_client.dart';
import '../../exam_focus/data/exam_focus_models.dart';
import 'study_models.dart';

/// Studying a book on the existing server — the same calls as the web's
/// app/books/[bookId]/study page and components/study/*. Cards, questions
/// and summaries are generated on the server; the app reads them, records
/// reviews / answers, and queues generation exactly as the web does.
class StudyRepository {
  StudyRepository({required this.trpc, required this.dio});

  final TrpcClient trpc;
  final Dio dio;

  Future<StudyContent> content(String bookId) => trpc.query(
    'books.getStudyContent',
    input: {'bookId': bookId},
    parse: (data) => StudyContent.fromJson(asMap(data)),
  );

  /// FSRS review on the server (the owner's schedule, or the recipient's own
  /// progress for a shared book).
  Future<void> rateCard(String cardId, CardRating rating) => trpc.mutation(
    'books.rateCard',
    input: {'cardId': cardId, 'rating': rating.name},
    parse: (_) {},
  );

  /// The server checks the answer and records the attempt.
  Future<McqResult> submitMcq(String mcqId, int selectedIndex) => trpc.mutation(
    'books.submitMcqAttempt',
    input: {'mcqId': mcqId, 'selectedIndex': selectedIndex},
    parse: (data) => McqResult.fromJson(asMap(data)),
  );

  /// Queues generation for one analysed chapter (owner only).
  Future<void> generate(StudyTool tool, String chapterId) => trpc.mutation(
    tool == StudyTool.cards
        ? 'books.generateChapterFlashcards'
        : 'books.generateChapterMcqs',
    input: {'chapterId': chapterId},
    parse: (_) {},
  );

  /// "تجهيز ملخص منظم" for one chapter (owner only; a background job).
  Future<void> composeNotes(String chapterId) => trpc.mutation(
    'books.generateMedicalNotePages',
    input: {'chapterId': chapterId},
    parse: (_) {},
  );

  Future<List<GenerationJob>> jobs(String bookId) => trpc.query(
    'books.generationJobs',
    input: {'bookId': bookId},
    parse: (data) => asMapList(data).map(GenerationJob.fromJson).toList(),
  );

  /// examFocus.get — null when not created yet, or (shared book) when the
  /// owner never made one.
  Future<ExamFocusDeck?> examFocus(String bookId) async {
    try {
      return await trpc.query(
        'examFocus.get',
        input: {'bookId': bookId},
        parse: (data) =>
            data == null ? null : ExamFocusDeck.fromJson(asMap(data)),
      );
    } on RejectedException catch (e) {
      if (e.code == 'PRECONDITION_FAILED') return null;
      rethrow;
    }
  }

  Future<void> startExamFocus(String bookId) => trpc.mutation(
    'examFocus.start',
    input: {'bookId': bookId},
    parse: (_) {},
  );

  Future<void> resumeExamFocus(String bookId) => trpc.mutation(
    'examFocus.resume',
    input: {'bookId': bookId},
    parse: (_) {},
  );

  /// Where a page image lives. The server answers with a redirect to a
  /// short-lived signed storage URL; it is read here without following it,
  /// so the session cookie never goes to storage.
  Future<String?> pageImageUrl(String bookId, int page) async {
    final response = await dio.get<Object?>(
      '/api/books/$bookId/pages/$page/image',
      options: Options(
        followRedirects: false,
        validateStatus: (status) => status != null && status < 500,
      ),
    );
    final status = response.statusCode ?? 0;
    if (status < 300 || status >= 400) return null;
    return response.headers.value('location');
  }
}

final studyRepositoryProvider = Provider<StudyRepository>(
  (ref) => StudyRepository(
    trpc: ref.watch(trpcProvider),
    dio: ref.watch(dioProvider),
  ),
);
