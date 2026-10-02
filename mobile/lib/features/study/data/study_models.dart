import '../../../core/api/json.dart';
import '../../library/data/library_models.dart';

/// Arabic labels of the knowledge-based card / question types — the web's
/// lib/knowledge-labels.ts (display strings only).
const cardTypeLabels = <String, String>{
  'definition': 'تعريف',
  'mechanism': 'آلية',
  'classification': 'تصنيف',
  'association': 'ارتباط',
  'clinical_distinction': 'تمييز سريري',
  'number_dose': 'رقم / جرعة',
  'confusion': 'خلط شائع',
  'recall': 'تذكّر',
};

const questionTypeLabels = <String, String>{
  'recall': 'تذكّر',
  'clinical_vignette': 'حالة سريرية',
  'association': 'ارتباط',
  'differentiation': 'تمييز',
  'next_best_step': 'الخطوة التالية',
  'diagnosis': 'تشخيص',
  'management': 'علاج',
  'complication': 'مضاعفات',
  'misconception': 'فخ شائع',
};

enum StudyTool {
  cards('cards'),
  mcqs('mcqs'),
  summary('explanation');

  const StudyTool(this.wire);

  /// The `?tool=` value the web uses.
  final String wire;

  static StudyTool parse(String? value) => switch (value) {
    'mcqs' => mcqs,
    'explanation' => summary,
    _ => cards,
  };

  /// generationJobs kind for this tool.
  String get jobKind => this == cards ? 'flashcards' : 'mcqs';
}

enum CardRating {
  again,
  hard,
  good,
  easy;

  /// "لم أتذكر" / "صعبة" count as still learning, as on the web.
  bool get learning => this == again || this == hard;
}

final class StudyCard {
  const StudyCard({
    required this.id,
    required this.chapterId,
    required this.questionEn,
    required this.questionAr,
    required this.answerEn,
    required this.answerAr,
    required this.sourcePage,
    this.relatedTermEn,
    this.relatedTermAr,
    this.cardType,
  });

  final String id;
  final String chapterId;
  final String questionEn;
  final String questionAr;
  final String answerEn;
  final String answerAr;
  final int sourcePage;
  final String? relatedTermEn;
  final String? relatedTermAr;

  /// Arabic label, or null for older (page-text) cards.
  final String? cardType;
}

final class StudyMcq {
  const StudyMcq({
    required this.id,
    required this.chapterId,
    required this.questionEn,
    required this.choices,
    required this.correctIndex,
    required this.explanationEn,
    required this.sourcePage,
    this.flagged = false,
    this.validationNote,
    this.questionType,
  });

  factory StudyMcq.fromJson(JsonMap json) => StudyMcq(
    id: json.str('id'),
    chapterId: json.str('chapterId'),
    questionEn: json.strOrNull('questionEn') ?? '',
    choices: [
      for (final c in (json['choices'] as List?) ?? const [])
        if (c is String) c,
    ],
    correctIndex: json.integer('correctIndex'),
    explanationEn: json.strOrNull('explanationEn') ?? '',
    sourcePage: json.integer('sourcePage'),
    flagged: json.strOrNull('validationStatus') == 'flagged',
    validationNote: json.strOrNull('validationNote'),
    questionType: questionTypeLabels[json.strOrNull('questionType')],
  );

  final String id;
  final String chapterId;
  final String questionEn;
  final List<String> choices;

  /// Used only for "تلميح" (remove one wrong choice) — as on the web. The
  /// answer itself is checked by the server (submitMcqAttempt).
  final int correctIndex;
  final String explanationEn;
  final int sourcePage;
  final bool flagged;
  final String? validationNote;
  final String? questionType;
}

/// submitMcqAttempt's result.
final class McqResult {
  const McqResult({
    required this.isCorrect,
    required this.correctIndex,
    required this.explanationEn,
  });

  factory McqResult.fromJson(JsonMap json) => McqResult(
    isCorrect: json.boolean('isCorrect'),
    correctIndex: json.integer('correctIndex'),
    explanationEn: json.strOrNull('explanationEn') ?? '',
  );

  final bool isCorrect;
  final int correctIndex;
  final String explanationEn;
}

final class NoteBlock {
  const NoteBlock({
    required this.heading,
    required this.bodyEn,
    required this.bodyAr,
    required this.items,
    required this.tone,
  });

  factory NoteBlock.fromJson(JsonMap json) => NoteBlock(
    heading: json.strOrNull('heading') ?? '',
    bodyEn: json.strOrNull('bodyEn') ?? '',
    bodyAr: json.strOrNull('bodyAr') ?? '',
    items: _strings(json['items']),
    tone: json.strOrNull('tone') ?? 'default',
  );

  final String heading;
  final String bodyEn;
  final String bodyAr;
  final List<String> items;

  /// default | high_yield | warning | clinical
  final String tone;
}

final class NotePage {
  const NotePage({
    required this.title,
    required this.subtitle,
    required this.sourcePages,
    required this.blocks,
  });

  factory NotePage.fromJson(JsonMap json) => NotePage(
    title: json.strOrNull('title') ?? '',
    subtitle: json.strOrNull('subtitle') ?? '',
    sourcePages: _ints(json['sourcePages']),
    blocks: _maps(json['blocks']).map(NoteBlock.fromJson).toList(),
  );

  final String title;
  final String subtitle;
  final List<int> sourcePages;
  final List<NoteBlock> blocks;
}

final class SummarySection {
  const SummarySection({
    required this.id,
    required this.pageStart,
    required this.pageEnd,
    required this.summary,
  });

  factory SummarySection.fromJson(JsonMap json) => SummarySection(
    id: json.strOrNull('chunkId') ?? '',
    pageStart: json.integer('pageStart'),
    pageEnd: json.integer('pageEnd'),
    summary: json.strOrNull('summary') ?? '',
  );

  final String id;
  final int pageStart;
  final int pageEnd;
  final String summary;
}

final class StudyChapter {
  const StudyChapter({
    required this.id,
    required this.title,
    required this.analyzed,
    this.startPage = 0,
    this.endPage = 0,
    this.chapterSummary,
    this.explanationEn,
    this.explanationAr,
    this.keyPoints = const [],
    this.notePages = const [],
    this.summarySections = const [],
  });

  factory StudyChapter.fromJson(JsonMap json) {
    final manifest = json['coverageManifest'] is Map
        ? asMap(json['coverageManifest'])
        : null;
    return StudyChapter(
      id: json.str('id'),
      title: json.strOrNull('title') ?? '',
      analyzed: json.strOrNull('status') == 'complete',
      startPage: json.integer('startPage'),
      endPage: json.integer('endPage'),
      chapterSummary: json.strOrNull('chapterSummary'),
      explanationEn: json.strOrNull('explanationEn'),
      explanationAr: json.strOrNull('explanationAr'),
      keyPoints: _strings(json['keyPoints']),
      notePages: _maps(json['medicalNotePages'])
          .map(NotePage.fromJson)
          .toList(),
      summarySections: _maps(manifest?['summarySections'])
          .map(SummarySection.fromJson)
          .toList(),
    );
  }

  final String id;
  final String title;

  /// Chapter analysis finished (status "complete").
  final bool analyzed;
  final int startPage;
  final int endPage;
  final String? chapterSummary;
  final String? explanationEn;
  final String? explanationAr;
  final List<String> keyPoints;
  final List<NotePage> notePages;
  final List<SummarySection> summarySections;
}

final class OutputCoverage {
  const OutputCoverage({
    required this.coveredChunks,
    required this.requiredChunks,
    required this.status,
  });

  factory OutputCoverage.fromJson(JsonMap json) => OutputCoverage(
    coveredChunks: json.integer('coveredChunks'),
    requiredChunks: json.integer('requiredChunks'),
    status: json.strOrNull('status') ?? '',
  );

  final int coveredChunks;
  final int requiredChunks;
  final String status;

  bool get short => status == 'PARTIAL' || status == 'FAILED';
}

/// The book-level processing manifest (computed on the server).
final class StudyManifest {
  const StudyManifest({
    this.totalPages = 0,
    this.extractedPages = 0,
    this.failedPages = const [],
    this.outputs = const {},
  });

  factory StudyManifest.fromJson(JsonMap json) => StudyManifest(
    totalPages: json.integer('totalPages'),
    extractedPages: json.integer('extractedPages'),
    failedPages: _ints(json['failedPages']),
    outputs: {
      if (json['outputs'] is Map)
        for (final MapEntry(:key, :value) in asMap(json['outputs']).entries)
          if (value is Map) key: OutputCoverage.fromJson(asMap(value)),
    },
  );

  final int totalPages;
  final int extractedPages;
  final List<int> failedPages;

  /// Keyed flashcards / mcqs / summary.
  final Map<String, OutputCoverage> outputs;
}

/// books.getStudyContent — the whole file's study content in page order.
final class StudyContent {
  const StudyContent({
    required this.bookId,
    required this.fileName,
    required this.chapters,
    required this.cards,
    required this.mcqs,
    required this.manifest,
    this.terms = const [],
    this.isOwner = true,
  });

  factory StudyContent.fromJson(JsonMap json) {
    final book = asMap(json['book']);
    final access = json['access'] is Map ? asMap(json['access']) : null;
    // Arabic term for a card's English term, same lookup as the web
    // (same chapter, case-insensitive English match).
    final terms = <String, Map<String, String>>{};
    for (final term in _maps(json['terms'])) {
      final chapter = term.strOrNull('chapterId');
      final en = term.strOrNull('en');
      final ar = term.strOrNull('ar');
      if (chapter == null || en == null || ar == null) continue;
      terms.putIfAbsent(chapter, () => {})[en.toLowerCase()] ??= ar;
    }
    return StudyContent(
      bookId: book.str('id'),
      fileName: book.strOrNull('fileName') ?? '',
      chapters: _maps(json['chapters']).map(StudyChapter.fromJson).toList(),
      cards: [
        for (final card in _maps(json['cards']))
          StudyCard(
            id: card.str('id'),
            chapterId: card.str('chapterId'),
            questionEn: card.strOrNull('questionEn') ?? '',
            questionAr: card.strOrNull('questionAr') ?? '',
            answerEn: card.strOrNull('answerEn') ?? '',
            answerAr: card.strOrNull('answerAr') ?? '',
            sourcePage: card.integer('sourcePage'),
            relatedTermEn: card.strOrNull('relatedTermEn'),
            relatedTermAr:
                terms[card.strOrNull('chapterId')]?[card
                    .strOrNull('relatedTermEn')
                    ?.toLowerCase()],
            cardType: cardTypeLabels[card.strOrNull('cardType')],
          ),
      ],
      mcqs: _maps(json['mcqs']).map(StudyMcq.fromJson).toList(),
      terms: [
        for (final (i, term) in _maps(json['terms']).indexed)
          (
            id: term.strOrNull('id') ?? '$i',
            en: term.strOrNull('en') ?? '',
            ar: term.strOrNull('ar') ?? '',
          ),
      ],
      manifest: json['manifest'] is Map
          ? StudyManifest.fromJson(asMap(json['manifest']))
          : const StudyManifest(),
      isOwner: (access?.strOrNull('role') ?? 'owner') == 'owner',
    );
  }

  final String bookId;
  final String fileName;
  final List<StudyChapter> chapters;
  final List<StudyCard> cards;
  final List<StudyMcq> mcqs;
  final StudyManifest manifest;

  /// The file's glossary (English ⇄ Arabic), used by the match game.
  final List<({String id, String en, String ar})> terms;
  final bool isOwner;

  String get title => bookDisplayTitle(fileName);

  List<StudyChapter> get analyzed => chapters.where((c) => c.analyzed).toList();

  /// Analysed chapters that have no cards (or questions) yet — what the web
  /// queues for generation when the owner opens the tool.
  List<StudyChapter> missingFor(StudyTool tool) {
    final have = {
      for (final item in tool == StudyTool.cards ? cards : mcqs)
        item is StudyCard ? item.chapterId : (item as StudyMcq).chapterId,
    };
    return analyzed.where((c) => !have.contains(c.id)).toList();
  }
}

/// One Exam Focus fact and what was built from it (the coverage matrix).
final class KnowledgeRow {
  const KnowledgeRow({
    required this.orderIndex,
    required this.title,
    required this.sourcePages,
    required this.cardCount,
    required this.questionCount,
    required this.questionTypes,
  });

  final int orderIndex;
  final String title;
  final List<int> sourcePages;
  final int cardCount;
  final int questionCount;

  /// Arabic labels, distinct.
  final List<String> questionTypes;
}

/// books.getKnowledgeCoverage — the matrix (fact → cards / questions →
/// pages) and, per chapter, how many cards / questions still come from the
/// older page-text generation ("V1") instead of the knowledge base.
final class KnowledgeCoverage {
  const KnowledgeCoverage({required this.rows, required this.v1ChapterIds});

  factory KnowledgeCoverage.fromJson(JsonMap json, StudyTool tool) {
    final key = tool == StudyTool.cards ? 'cards' : 'mcqs';
    return KnowledgeCoverage(
      rows: [
        for (final r in _maps(json['rows']))
          KnowledgeRow(
            orderIndex: r.integer('orderIndex'),
            title: r.strOrNull('title') ?? '',
            sourcePages: _ints(r['sourcePages']),
            cardCount: ((r['cardIds'] as List?) ?? const []).length,
            questionCount: ((r['questionIds'] as List?) ?? const []).length,
            questionTypes: {
              for (final t in _strings(r['questionTypes']))
                questionTypeLabels[t] ?? t,
            }.where((t) => t.isNotEmpty).toList(),
          ),
      ],
      v1ChapterIds: {
        for (final c in _maps(json['chapters']))
          if (c[key] is Map &&
              asMap(c[key]).integer('v1') > 0 &&
              asMap(c[key]).integer('knowledge') == 0)
            c.str('chapterId'),
      },
    );
  }

  final List<KnowledgeRow> rows;

  /// Analysed chapters whose cards / questions are all V1.
  final Set<String> v1ChapterIds;

  int covered(StudyTool tool) => rows
      .where(
        (r) => tool == StudyTool.cards ? r.cardCount > 0 : r.questionCount > 0,
      )
      .length;
}

/// generationJobs row.
final class GenerationJob {
  const GenerationJob({
    required this.chapterId,
    required this.kind,
    required this.status,
    this.errorMessage,
  });

  factory GenerationJob.fromJson(JsonMap json) => GenerationJob(
    chapterId: json.str('chapterId'),
    kind: json.strOrNull('kind') ?? '',
    status: json.strOrNull('status') ?? '',
    errorMessage: json.strOrNull('errorMessage'),
  );

  final String chapterId;

  /// flashcards | mcqs | medical_notes | …
  final String kind;

  /// queued | processing | completed | failed
  final String status;

  final String? errorMessage;

  bool get settled => status == 'completed' || status == 'failed';
  bool get active => status == 'queued' || status == 'processing';
}

List<String> _strings(Object? value) => value is List
    ? [
        for (final v in value)
          if (v is String) v,
      ]
    : const [];

List<int> _ints(Object? value) => value is List
    ? [
        for (final v in value)
          if (v is num) v.toInt(),
      ]
    : const [];

List<JsonMap> _maps(Object? value) => value is List
    ? [
        for (final v in value)
          if (v is Map) asMap(v),
      ]
    : const [];
