import '../../../core/api/json.dart';

/// One processing unit of an Exam Focus deck (a page range).
final class ExamFocusUnit {
  const ExamFocusUnit({
    required this.id,
    required this.pageStart,
    required this.pageEnd,
    required this.status,
    this.errorMessage,
    this.factCount = 0,
  });

  factory ExamFocusUnit.fromJson(JsonMap json) => ExamFocusUnit(
    id: json.str('id'),
    pageStart: json.integer('pageStart'),
    pageEnd: json.integer('pageEnd'),
    status: json.strOrNull('status') ?? '',
    errorMessage: json.strOrNull('errorMessage'),
    factCount: json.integer('factCount'),
  );

  final String id;
  final int pageStart;
  final int pageEnd;

  /// pending | processing | retrying | complete | failed
  final String status;
  final String? errorMessage;
  final int factCount;

  bool get complete => status == 'complete';
  bool get failed => status == 'failed';
}

/// examFocus.get — the deck, its units, per-category counts and the
/// viewer's bookmark count. Null from the server = not created yet.
final class ExamFocusDeck {
  const ExamFocusDeck({
    required this.status,
    required this.units,
    this.totalCards = 0,
    this.categoryCounts = const {},
    this.bookmarkedCount = 0,
    this.isOwner = true,
  });

  factory ExamFocusDeck.fromJson(JsonMap json) {
    final deck = asMap(json['deck']);
    final access = json['access'] is Map ? asMap(json['access']) : null;
    final counts = json['categoryCounts'] is Map
        ? asMap(json['categoryCounts'])
        : const <String, Object?>{};
    return ExamFocusDeck(
      status: deck.strOrNull('status') ?? '',
      totalCards: deck.integer('totalCards'),
      units: json['units'] is List
          ? asMapList(json['units']).map(ExamFocusUnit.fromJson).toList()
          : const [],
      categoryCounts: {
        for (final MapEntry(:key, :value) in counts.entries)
          if (value is num) key: value.toInt(),
      },
      bookmarkedCount: json.integer('bookmarkedCount'),
      isOwner: (access?.strOrNull('role') ?? 'owner') == 'owner',
    );
  }

  /// processing | finalizing | complete | partial_failed | failed
  final String status;
  final List<ExamFocusUnit> units;
  final int totalCards;
  final Map<String, int> categoryCounts;
  final int bookmarkedCount;
  final bool isOwner;

  bool get processing => status == 'processing' || status == 'finalizing';
  bool get ready => status == 'complete' || status == 'partial_failed';

  /// No longer changing (the web's "deckSettled").
  bool get settled => ready || status == 'failed';
  int get unitsDone => units.where((u) => u.complete).length;
  int get unitsFailed => units.where((u) => u.failed).length;
}
