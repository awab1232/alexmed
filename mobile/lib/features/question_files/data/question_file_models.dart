import '../../../core/api/json.dart';

/// books.status for a question file (the web's STATUS_LABELS).
enum QuestionFileStatus { extracting, complete, failed, pending, other }

QuestionFileStatus _status(String? value) => switch (value) {
  'extracting' => QuestionFileStatus.extracting,
  'complete' => QuestionFileStatus.complete,
  'failed' => QuestionFileStatus.failed,
  'pending' || 'processing' => QuestionFileStatus.pending,
  _ => QuestionFileStatus.other,
};

/// questionFiles.list row.
final class QuestionFileSummary {
  const QuestionFileSummary({
    required this.id,
    required this.fileName,
    required this.status,
    this.questionCount = 0,
    this.extractionError,
  });

  factory QuestionFileSummary.fromJson(JsonMap json) => QuestionFileSummary(
    id: json.str('id'),
    fileName: json.strOrNull('fileName') ?? '',
    status: _status(json.strOrNull('status')),
    questionCount: json.integer('questionCount'),
    extractionError: json.strOrNull('extractionError'),
  );

  final String id;
  final String fileName;
  final QuestionFileStatus status;
  final int questionCount;
  final String? extractionError;
}

List<String>? _strings(Object? value) =>
    value is List ? [for (final v in value) '$v'] : null;

/// One question as the cards render it — the safe projection the server's
/// readQuestionFileContent returns (components/questions/QuestionList.tsx
/// `QuestionListItem`). Used by question files, protected doctor sets and
/// the doctor's preview. Needs-review questions never arrive here.
final class QuestionItem {
  const QuestionItem({
    required this.id,
    required this.questionText,
    this.options,
    this.extractedAnswerIndex,
    this.aiInferredAnswerIndex,
    this.explanationText,
    this.sourcePage = 0,
    this.keywords,
    this.aiExplanationAr,
    this.imageUrl,
    this.questionTextAr,
    this.optionsAr,
    this.translationSource,
  });

  factory QuestionItem.fromJson(JsonMap json) => QuestionItem(
    id: json.str('id'),
    questionText: json.strOrNull('questionText') ?? '',
    options: _strings(json['options']),
    extractedAnswerIndex: json.intOrNull('extractedAnswerIndex'),
    aiInferredAnswerIndex: json.intOrNull('aiInferredAnswerIndex'),
    explanationText: json.strOrNull('explanationText'),
    sourcePage: json.integer('sourcePage'),
    keywords: _strings(json['keywords']),
    aiExplanationAr: json.strOrNull('aiExplanationAr'),
    imageUrl: json.strOrNull('imageUrl'),
    questionTextAr: json.strOrNull('questionTextAr'),
    optionsAr: _strings(json['optionsAr']),
    translationSource: json.strOrNull('translationSource'),
  );

  final String id;
  final String questionText;
  final List<String>? options;
  final int? extractedAnswerIndex;
  final int? aiInferredAnswerIndex;
  final String? explanationText;
  final int sourcePage;
  final List<String>? keywords;
  final String? aiExplanationAr;
  final String? imageUrl;
  final String? questionTextAr;
  final List<String>? optionsAr;

  /// "source" (the file had Arabic) / "machine" (translated once by the
  /// pipeline — labelled «ترجمة آلية»).
  final String? translationSource;

  bool get hasTranslation => (questionTextAr ?? '').isNotEmpty;
}

/// A needs-review block — only in the doctor's preview, with its reasons.
final class NeedsReviewItem {
  const NeedsReviewItem({
    required this.id,
    required this.orderIndex,
    required this.questionText,
    required this.sourcePage,
    required this.reasons,
    this.options,
  });

  factory NeedsReviewItem.fromJson(JsonMap json) => NeedsReviewItem(
    id: json.str('id'),
    orderIndex: json.integer('orderIndex'),
    questionText: json.strOrNull('questionText') ?? '',
    options: _strings(json['options']),
    sourcePage: json.integer('sourcePage'),
    reasons: _strings(json['reasons']) ?? const [],
  );

  final String id;
  final int orderIndex;
  final String questionText;
  final List<String>? options;
  final int sourcePage;
  final List<String> reasons;
}

/// Image pages read + AI enrichment done (getQuestionFileCoverage).
final class QuestionFileCoverage {
  const QuestionFileCoverage({
    this.imagePagesTotal = 0,
    this.imagePagesProcessed = 0,
    this.questionsTotal = 0,
    this.questionsAiComplete = 0,
    this.done = true,
  });

  factory QuestionFileCoverage.fromJson(JsonMap json) => QuestionFileCoverage(
    imagePagesTotal: json.integer('imagePagesTotal'),
    imagePagesProcessed: json.integer('imagePagesProcessed'),
    questionsTotal: json.integer('questionsTotal'),
    questionsAiComplete: json.integer('questionsAiComplete'),
    done: json.boolean('done', fallback: true),
  );

  final int imagePagesTotal;
  final int imagePagesProcessed;
  final int questionsTotal;
  final int questionsAiComplete;
  final bool done;
}

/// The content part shared by questionFiles.get, questionSets.get and
/// doctor.preview: questions (+ needs-review for the doctor) and coverage.
final class QuestionContent {
  const QuestionContent({
    required this.questions,
    this.needsReview = const [],
    this.coverage = const QuestionFileCoverage(),
  });

  factory QuestionContent.fromJson(JsonMap json) => QuestionContent(
    questions: [
      for (final q in asMapList(json['questions'] ?? const <Object?>[]))
        QuestionItem.fromJson(q),
    ],
    needsReview: json['needsReview'] is List
        ? [
            for (final q in asMapList(json['needsReview']))
              NeedsReviewItem.fromJson(q),
          ]
        : const [],
    coverage: json['coverage'] is Map
        ? QuestionFileCoverage.fromJson(asMap(json['coverage']))
        : const QuestionFileCoverage(),
  );

  final List<QuestionItem> questions;
  final List<NeedsReviewItem> needsReview;
  final QuestionFileCoverage coverage;
}

/// questionFiles.get.
final class QuestionFileDetail {
  const QuestionFileDetail({
    required this.id,
    required this.fileName,
    required this.status,
    required this.content,
    this.pageCount = 0,
    this.extractionError,
  });

  factory QuestionFileDetail.fromJson(JsonMap json) {
    final book = asMap(json['book']);
    return QuestionFileDetail(
      id: book.str('id'),
      fileName: book.strOrNull('fileName') ?? '',
      status: _status(book.strOrNull('status')),
      pageCount: book.integer('pageCount'),
      extractionError: book.strOrNull('extractionError'),
      content: QuestionContent.fromJson(json),
    );
  }

  final String id;
  final String fileName;
  final QuestionFileStatus status;
  final int pageCount;
  final String? extractionError;
  final QuestionContent content;

  List<QuestionItem> get questions => content.questions;

  /// The web polls while extracting, or while images / AI enrichment are
  /// still being added to a complete file.
  bool get stillWorking =>
      status == QuestionFileStatus.extracting ||
      (status == QuestionFileStatus.complete && !content.coverage.done);
}
