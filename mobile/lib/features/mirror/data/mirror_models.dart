import '../../../core/api/json.dart';

/// The explanation depth a student picks (web `depthOptions`).
enum MirrorDepth {
  quick('quick'),
  balanced('balanced'),
  detailed('detailed');

  const MirrorDepth(this.wire);
  final String wire;
}

/// mirror_job_status — "pending" is the generating phase.
enum MirrorJobStatus { extracting, pending, complete, partialFailed, failed }

MirrorJobStatus _jobStatus(String? value) => switch (value) {
  'extracting' => MirrorJobStatus.extracting,
  'complete' => MirrorJobStatus.complete,
  'partial_failed' => MirrorJobStatus.partialFailed,
  'failed' => MirrorJobStatus.failed,
  _ => MirrorJobStatus.pending,
};

extension MirrorJobStatusX on MirrorJobStatus {
  /// No more cards are coming (web TERMINAL_JOB_STATUSES).
  bool get isTerminal =>
      this == MirrorJobStatus.complete ||
      this == MirrorJobStatus.partialFailed ||
      this == MirrorJobStatus.failed;
}

final class MirrorBatch {
  const MirrorBatch({
    required this.id,
    required this.startPage,
    required this.endPage,
    required this.status,
    this.errorMessage,
  });

  factory MirrorBatch.fromJson(JsonMap json) => MirrorBatch(
    id: json.str('id'),
    startPage: json.integer('startPage'),
    endPage: json.integer('endPage'),
    status: json.strOrNull('status') ?? 'pending',
    errorMessage: json.strOrNull('errorMessage'),
  );

  final String id;
  final int startPage;
  final int endPage;

  /// pending / generating / processing / retrying / complete / failed.
  final String status;
  final String? errorMessage;

  bool get isComplete => status == 'complete';
  bool get isFailed => status == 'failed';
}

/// mirror.get — a job and its batches.
final class MirrorJob {
  const MirrorJob({
    required this.id,
    required this.fileName,
    required this.status,
    required this.batches,
    this.pageCount = 0,
    this.deckId,
    this.fromText = false,
    this.extractionError,
  });

  factory MirrorJob.fromJson(JsonMap json) {
    final job = asMap(json['job']);
    return MirrorJob(
      id: job.str('id'),
      fileName: job.strOrNull('fileName') ?? '',
      status: _jobStatus(job.strOrNull('status')),
      pageCount: job.integer('pageCount'),
      deckId: job.strOrNull('deckId'),
      fromText: job.strOrNull('sourceType') == 'text',
      extractionError: job.strOrNull('extractionError'),
      batches: json['batches'] is List
          ? [
              for (final b in asMapList(json['batches']))
                MirrorBatch.fromJson(b),
            ]
          : const [],
    );
  }

  final String id;
  final String fileName;
  final MirrorJobStatus status;
  final int pageCount;
  final String? deckId;
  final bool fromText;
  final String? extractionError;
  final List<MirrorBatch> batches;

  int get completeCount => batches.where((b) => b.isComplete).length;
  List<MirrorBatch> get failedBatches =>
      batches.where((b) => b.isFailed).toList();

  /// The web opens the deck as soon as the first batch is ready.
  bool get canOpenDeck => deckId != null && completeCount >= 1;
}

/// One مِرآة flashcard (a row of `cards` + its section and image).
final class MirrorCard {
  const MirrorCard({
    required this.id,
    required this.question,
    this.questionArabic = '',
    this.answer = '',
    this.answerArabic = '',
    this.explanation = '',
    this.explanationArabic = '',
    this.keyIdea = '',
    this.keyIdeaArabic = '',
    this.keyword = '',
    this.keywordArabic = '',
    this.sourcePage = 0,
    this.needsReview = false,
    this.confidence = 'high',
    this.imageUrl,
    this.sectionId,
  });

  factory MirrorCard.fromJson(JsonMap json) => MirrorCard(
    id: json.str('id'),
    question: json.strOrNull('question') ?? '',
    questionArabic: json.strOrNull('questionArabic') ?? '',
    answer: json.strOrNull('answer') ?? '',
    answerArabic: json.strOrNull('answerArabic') ?? '',
    explanation: json.strOrNull('explanation') ?? '',
    explanationArabic: json.strOrNull('explanationArabic') ?? '',
    keyIdea: json.strOrNull('keyIdea') ?? '',
    keyIdeaArabic: json.strOrNull('keyIdeaArabic') ?? '',
    keyword: json.strOrNull('keyword') ?? '',
    keywordArabic: json.strOrNull('keywordArabic') ?? '',
    sourcePage: json.integer('sourcePage'),
    needsReview: json.strOrNull('status') == 'needs_review',
    confidence: json.strOrNull('confidence') ?? 'high',
    imageUrl: json.strOrNull('imageUrl'),
    sectionId: json.strOrNull('sectionId'),
  );

  final String id;
  final String question;
  final String questionArabic;
  final String answer;
  final String answerArabic;
  final String explanation;
  final String explanationArabic;
  final String keyIdea;
  final String keyIdeaArabic;
  final String keyword;
  final String keywordArabic;
  final int sourcePage;
  final bool needsReview;

  /// high / medium / low.
  final String confidence;
  final String? imageUrl;
  final String? sectionId;

  /// Search across the same fields as the web.
  bool matches(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return '$question $questionArabic $answer $keyIdea $keyword'
        .toLowerCase()
        .contains(q);
  }
}

/// A part of the deck: its original upload, or a later pasted-text addition.
final class DeckSection {
  const DeckSection({
    required this.id,
    required this.label,
    required this.fromText,
    required this.cardCount,
  });

  factory DeckSection.fromJson(JsonMap json) => DeckSection(
    id: json.str('id'),
    label: json.strOrNull('label') ?? '',
    fromText: json.strOrNull('sourceType') == 'text',
    cardCount: json.integer('cardCount'),
  );

  final String id;
  final String label;
  final bool fromText;
  final int cardCount;
}

/// decks.get — the deck, its cards, sections, and the job still feeding it.
final class MirrorDeck {
  const MirrorDeck({
    required this.id,
    required this.fileName,
    required this.cards,
    this.pageCount = 0,
    this.subjectId,
    this.sections = const [],
    this.jobId,
    this.jobStatus,
    this.failedBatchCount = 0,
  });

  factory MirrorDeck.fromJson(JsonMap json) {
    final deck = asMap(json['deck']);
    final job = json['job'] is Map ? asMap(json['job']) : null;
    return MirrorDeck(
      id: deck.str('id'),
      fileName: deck.strOrNull('fileName') ?? '',
      pageCount: deck.integer('pageCount'),
      subjectId: deck.strOrNull('subjectId'),
      cards: [for (final c in asMapList(json['cards'])) MirrorCard.fromJson(c)],
      sections: json['sections'] is List
          ? [
              for (final s in asMapList(json['sections']))
                DeckSection.fromJson(s),
            ]
          : const [],
      jobId: job?.strOrNull('id'),
      jobStatus: job == null ? null : _jobStatus(job.strOrNull('status')),
      failedBatchCount: job?.integer('failedBatchCount') ?? 0,
    );
  }

  final String id;
  final String fileName;
  final int pageCount;
  final String? subjectId;
  final List<MirrorCard> cards;
  final List<DeckSection> sections;
  final String? jobId;
  final MirrorJobStatus? jobStatus;
  final int failedBatchCount;

  /// More cards are still being generated (the web keeps polling).
  bool get isLive => jobStatus != null && !jobStatus!.isTerminal;

  int get needsReviewCount => cards.where((c) => c.needsReview).length;

  DeckSection? section(String? id) {
    for (final s in sections) {
      if (s.id == id) return s;
    }
    return null;
  }
}
