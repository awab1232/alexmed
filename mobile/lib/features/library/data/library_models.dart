import '../../../core/api/json.dart';

/// Subject types (subjectsRouter's enum) with the web's Arabic labels
/// (app/subjects/page.tsx TYPE_LABELS).
const subjectTypeLabels = <String, String>{
  'general': 'عام',
  'medical': 'طبي',
  'english': 'لغة إنجليزية',
  'mathematics': 'رياضيات',
  'aptitude': 'قدرات',
  'programming': 'برمجة',
  'custom': 'مخصص',
};

/// A folder ("مجلد") — the web reuses subjects for folders.
final class Subject {
  const Subject({
    required this.id,
    required this.name,
    required this.type,
    this.bookCount = 0,
    this.deckCount = 0,
    this.lastUpdatedAt,
    this.examDate,
  });

  /// subjects.list row (bookCount, deckCount, lastUpdatedAt) or
  /// subjects.get row (no counts).
  factory Subject.fromJson(JsonMap json) => Subject(
    id: json.str('id'),
    name: json.str('name'),
    type: json.strOrNull('type') ?? 'general',
    bookCount: json.integer('bookCount'),
    deckCount: json.integer('deckCount'),
    lastUpdatedAt: json.date('lastUpdatedAt'),
    examDate: json.date('examDate'),
  );

  final String id;
  final String name;
  final String type;
  final int bookCount;
  final int deckCount;
  final DateTime? lastUpdatedAt;
  final DateTime? examDate;

  String get typeLabel => subjectTypeLabels[type] ?? type;
}

enum BookState { reading, preparing, ready }

/// A study book (books.list — study_book source type only).
final class BookSummary {
  const BookSummary({
    required this.id,
    required this.fileName,
    this.subjectId,
    this.pageCount = 0,
    this.chapterCount = 0,
    this.completeChapterCount = 0,
    this.updatedAt,
  });

  factory BookSummary.fromJson(JsonMap json) => BookSummary(
    id: json.str('id'),
    fileName: json.strOrNull('fileName') ?? '',
    subjectId: json.strOrNull('subjectId'),
    pageCount: json.integer('pageCount'),
    chapterCount: json.integer('chapterCount'),
    completeChapterCount: json.integer('completeChapterCount'),
    updatedAt: json.date('updatedAt'),
  );

  final String id;
  final String fileName;
  final String? subjectId;
  final int pageCount;
  final int chapterCount;
  final int completeChapterCount;
  final DateTime? updatedAt;

  String get title => bookDisplayTitle(fileName);

  /// Same rule as the web's StudyNext.bookState.
  BookState get state {
    if (chapterCount == 0) return BookState.reading;
    if (completeChapterCount == 0) return BookState.preparing;
    return BookState.ready;
  }
}

/// A مِرآة flashcard deck made from a question file (decks.list).
final class DeckSummary {
  const DeckSummary({
    required this.id,
    required this.fileName,
    this.subjectId,
    this.pageCount = 0,
    this.cardCount = 0,
  });

  factory DeckSummary.fromJson(JsonMap json) => DeckSummary(
    id: json.str('id'),
    fileName: json.strOrNull('fileName') ?? '',
    subjectId: json.strOrNull('subjectId'),
    pageCount: json.integer('pageCount'),
    cardCount: json.integer('cardCount'),
  );

  final String id;
  final String fileName;
  final String? subjectId;
  final int pageCount;
  final int cardCount;

  String get title => bookDisplayTitle(fileName);
}

final class SharedPack {
  const SharedPack({
    required this.bookId,
    required this.bookTitle,
    this.ownerName,
    this.ownerUsername,
  });

  factory SharedPack.fromJson(JsonMap json) => SharedPack(
    bookId: json.str('bookId'),
    bookTitle: bookDisplayTitle(json.strOrNull('bookTitle')),
    ownerName: json.strOrNull('ownerName'),
    ownerUsername: json.strOrNull('ownerUsername'),
  );

  final String bookId;
  final String bookTitle;
  final String? ownerName;
  final String? ownerUsername;
}

/// sharing.homeSummary — pending requests, unread notifications, recent packs.
final class SharedSummary {
  const SharedSummary({
    this.pending = 0,
    this.unread = 0,
    this.recent = const [],
  });

  factory SharedSummary.fromJson(JsonMap json) => SharedSummary(
    pending: json.integer('pending'),
    unread: json.integer('unread'),
    recent: json['recent'] is List
        ? [
            for (final row in asMapList(json['recent']))
              SharedPack.fromJson(row),
          ]
        : const [],
  );

  final int pending;
  final int unread;
  final List<SharedPack> recent;
}

/// A title, not a file name (web lib/book-title.ts): drop ".pdf", turn
/// underscores into spaces.
String bookDisplayTitle(String? fileName) {
  final name = (fileName ?? '').trim();
  if (name.isEmpty) return 'كتاب بدون عنوان';
  final withoutExt = name.replaceFirst(
    RegExp(r'\.pdf$', caseSensitive: false),
    '',
  );
  final spaced = withoutExt
      .replaceAll(RegExp('_+'), ' ')
      .replaceAll(RegExp(r'\s{2,}'), ' ')
      .trim();
  return spaced.isEmpty ? name : spaced;
}
