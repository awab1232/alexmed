import '../../../core/api/json.dart';
import '../../library/data/library_models.dart';

/// Book profiles — the server's `book_profile` enum. Chosen at upload; it
/// selects the analysis prompts on the server. Same labels as the web's
/// app/books/upload PROFILE_LABELS (identical to the folder types).
const bookProfiles = subjectTypeLabels;

/// books.status on the server.
enum BookStatus {
  pending,
  extracting,
  processing,
  complete,
  partialFailed,
  failed;

  static BookStatus parse(String? value) => switch (value) {
    'extracting' => extracting,
    'processing' => processing,
    'complete' => complete,
    'partial_failed' => partialFailed,
    'failed' => failed,
    _ => pending,
  };

  /// The web stops polling books.get at these (TERMINAL_BOOK_STATUSES).
  bool get terminal =>
      this == complete || this == partialFailed || this == failed;
}

/// book_chapters.status on the server.
enum ChapterStatus {
  pending,
  analyzing,
  processing,
  retrying,
  complete,
  failed;

  static ChapterStatus parse(String? value) => switch (value) {
    'analyzing' => analyzing,
    'processing' => processing,
    'retrying' => retrying,
    'complete' => complete,
    'failed' => failed,
    _ => pending,
  };
}

final class BookChapter {
  const BookChapter({
    required this.id,
    required this.title,
    required this.status,
    this.startPage = 0,
    this.endPage = 0,
    this.errorMessage,
  });

  factory BookChapter.fromJson(JsonMap json) => BookChapter(
    id: json.str('id'),
    title: json.strOrNull('title') ?? '',
    status: ChapterStatus.parse(json.strOrNull('status')),
    startPage: json.integer('startPage'),
    endPage: json.integer('endPage'),
    errorMessage: json.strOrNull('errorMessage'),
  );

  final String id;
  final String title;
  final ChapterStatus status;
  final int startPage;
  final int endPage;
  final String? errorMessage;
}

/// books.get — the book, its chapters (processing units), totals and who
/// is looking (owner or an accepted share).
final class BookDetail {
  const BookDetail({
    required this.id,
    required this.fileName,
    required this.status,
    required this.chapters,
    this.subjectId,
    this.pageCount = 0,
    this.hasFile = false,
    this.createdAt,
    this.extractionError,
    this.lowConfidenceSplit = false,
    this.totalCards = 0,
    this.totalMcqs = 0,
    this.isOwner = true,
    this.ownerName,
    this.ownerUsername,
  });

  factory BookDetail.fromJson(JsonMap json) {
    final book = asMap(json['book']);
    final access = json['access'] is Map ? asMap(json['access']) : null;
    return BookDetail(
      id: book.str('id'),
      fileName: book.strOrNull('fileName') ?? '',
      status: BookStatus.parse(book.strOrNull('status')),
      subjectId: book.strOrNull('subjectId'),
      pageCount: book.integer('pageCount'),
      hasFile: book.strOrNull('fileKey') != null,
      createdAt: book.date('createdAt'),
      extractionError: book.strOrNull('extractionError'),
      lowConfidenceSplit: book.strOrNull('chapterDetectionConfidence') == 'low',
      chapters: asMapList(json['chapters']).map(BookChapter.fromJson).toList(),
      totalCards: json.integer('totalCards'),
      totalMcqs: json.integer('totalMcqs'),
      isOwner: (access?.strOrNull('role') ?? 'owner') == 'owner',
      ownerName: access?.strOrNull('ownerName'),
      ownerUsername: access?.strOrNull('ownerUsername'),
    );
  }

  final String id;
  final String fileName;
  final BookStatus status;
  final String? subjectId;
  final int pageCount;
  final bool hasFile;
  final DateTime? createdAt;
  final String? extractionError;
  final bool lowConfidenceSplit;
  final List<BookChapter> chapters;
  final int totalCards;
  final int totalMcqs;
  final bool isOwner;
  final String? ownerName;
  final String? ownerUsername;

  String get title => bookDisplayTitle(fileName);

  // The same derived states as the web's app/books/[bookId]/page.tsx.

  bool get isExtracting => status == BookStatus.extracting;
  bool get hasChapters => chapters.isNotEmpty;
  int get completeCount =>
      chapters.where((c) => c.status == ChapterStatus.complete).length;
  List<BookChapter> get failedChapters =>
      chapters.where((c) => c.status == ChapterStatus.failed).toList();

  /// Nothing is analysed until the student asks (startChapterAnalysis).
  bool get chaptersNotStarted =>
      hasChapters && chapters.every((c) => c.status == ChapterStatus.pending);

  /// Every chapter reached complete or failed.
  bool get chaptersPhaseDone =>
      hasChapters &&
      chapters.every(
        (c) =>
            c.status == ChapterStatus.complete ||
            c.status == ChapterStatus.failed,
      );

  StudyToolsState get toolsState => chaptersNotStarted
      ? StudyToolsState.locked
      : !chaptersPhaseDone
      ? StudyToolsState.generating
      : StudyToolsState.ready;

  int get analysisPercent =>
      hasChapters ? (completeCount * 100 / chapters.length).round() : 0;

  /// The owner's started analysis is still moving — the web then asks the
  /// server every minute to re-queue stalled chapters.
  bool get analysisInFlight =>
      isOwner &&
      chapters.any((c) => c.status != ChapterStatus.pending) &&
      chapters.any(
        (c) =>
            c.status == ChapterStatus.pending ||
            c.status == ChapterStatus.processing ||
            c.status == ChapterStatus.retrying,
      );

  /// Keep polling books.get until the book reaches a terminal status (web).
  bool get needsPolling => !status.terminal;
}

enum StudyToolsState { locked, generating, ready }

/// books.listPages row — only what the failed-page retry needs.
final class BookPage {
  const BookPage({
    required this.id,
    required this.pageNumber,
    required this.textFailed,
    this.textError,
  });

  factory BookPage.fromJson(JsonMap json) => BookPage(
    id: json.str('id'),
    pageNumber: json.integer('pageNumber'),
    textFailed: json.strOrNull('textStatus') == 'failed',
    textError: json.strOrNull('textErrorMessage'),
  );

  final String id;
  final int pageNumber;
  final bool textFailed;
  final String? textError;
}

/// books.getCoverageReport — page-level visual processing counts.
final class CoverageReport {
  const CoverageReport({
    this.totalPages = 0,
    this.pagesWithVisuals = 0,
    this.needsReview = 0,
    this.failed = 0,
    this.visualPending = 0,
  });

  factory CoverageReport.fromJson(JsonMap json) => CoverageReport(
    totalPages: json.integer('totalPages'),
    pagesWithVisuals: json.integer('pagesWithVisuals'),
    needsReview: json.integer('needsReview'),
    failed: json.integer('failed'),
    visualPending: json.integer('visualPending'),
  );

  final int totalPages;
  final int pagesWithVisuals;
  final int needsReview;
  final int failed;
  final int visualPending;

  int get visualDone => totalPages - visualPending;
}

/// books.getCoverageDetail — exact missing / failed page numbers; COMPLETE
/// only when every page is really processed (computed on the server).
final class CoverageDetail {
  const CoverageDetail({
    this.totalPages = 0,
    this.processedPages = 0,
    this.coverage = 0,
    this.complete = false,
    this.missingPages = const [],
    this.failedPages = const [],
  });

  factory CoverageDetail.fromJson(JsonMap json) => CoverageDetail(
    totalPages: json.integer('totalPages'),
    processedPages: json.integer('processedPages'),
    coverage: json.integer('coverage'),
    complete: json.strOrNull('status') == 'COMPLETE',
    missingPages: _ints(json['missingPages']),
    failedPages: _ints(json['failedPages']),
  );

  final int totalPages;
  final int processedPages;
  final int coverage;
  final bool complete;
  final List<int> missingPages;
  final List<int> failedPages;
}

List<int> _ints(Object? value) => value is List
    ? [
        for (final v in value)
          if (v is num) v.toInt(),
      ]
    : const [];

/// examFocus.get for the book page's tile: null = not created yet.
final class ExamFocusTile {
  const ExamFocusTile({required this.status, this.totalCards = 0});

  factory ExamFocusTile.fromJson(JsonMap json) {
    final deck = asMap(json['deck']);
    return ExamFocusTile(
      status: deck.strOrNull('status') ?? '',
      totalCards: deck.integer('totalCards'),
    );
  }

  final String status;
  final int totalCards;

  bool get ready => status == 'complete' || status == 'partial_failed';
  bool get busy => status == 'processing' || status == 'finalizing';
}
