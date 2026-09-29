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
    this.errorMessage,
    this.coverage,
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
      errorMessage: deck.strOrNull('errorMessage'),
      coverage: deck['coverage'] is Map
          ? ExamFocusCoverage.fromJson(asMap(deck['coverage']))
          : null,
    );
  }

  /// processing | finalizing | complete | partial_failed | failed
  final String status;
  final List<ExamFocusUnit> units;
  final int totalCards;
  final Map<String, int> categoryCounts;
  final int bookmarkedCount;
  final bool isOwner;
  final String? errorMessage;
  final ExamFocusCoverage? coverage;

  bool get processing => status == 'processing' || status == 'finalizing';
  bool get ready => status == 'complete' || status == 'partial_failed';

  /// No longer changing (the web's "deckSettled").
  bool get settled => ready || status == 'failed';
  int get unitsDone => units.where((u) => u.complete).length;
  int get unitsFailed => units.where((u) => u.failed).length;
}

/// Category badge info — the web's EXAM_FOCUS_CATEGORY_INFO (display only;
/// `priority` orders the filter chips).
typedef CategoryInfo = ({
  String emoji,
  String label,
  String labelAr,
  int priority,
});

const examFocusCategories = <String, CategoryInfo>{
  'emergency': (emoji: '🚨', label: 'Emergency', labelAr: 'طوارئ', priority: 0),
  'must_know': (
    emoji: '🔥',
    label: 'Must Know',
    labelAr: 'لازم تعرفها',
    priority: 1,
  ),
  'high_yield': (
    emoji: '⭐',
    label: 'High Yield',
    labelAr: 'مهمة جدًا',
    priority: 2,
  ),
  'exam_trap': (
    emoji: '⚠️',
    label: 'Exam Trap',
    labelAr: 'فخ امتحان',
    priority: 3,
  ),
  'numbers': (
    emoji: '🔢',
    label: 'Numbers',
    labelAr: 'أرقام وحدود',
    priority: 4,
  ),
  'classification': (
    emoji: '📊',
    label: 'Classification',
    labelAr: 'تصنيف',
    priority: 5,
  ),
  'comparison': (
    emoji: '⚖️',
    label: 'Comparison',
    labelAr: 'مقارنة',
    priority: 6,
  ),
  'treatment': (emoji: '💊', label: 'Treatment', labelAr: 'علاج', priority: 7),
  'drug_dose': (
    emoji: '💉',
    label: 'Drug / Dose',
    labelAr: 'دواء وجرعة',
    priority: 8,
  ),
  'contraindication': (
    emoji: '❌',
    label: 'Contraindication',
    labelAr: 'مانع استعمال',
    priority: 9,
  ),
  'indication': (
    emoji: '✅',
    label: 'Indication',
    labelAr: 'دواعي الاستعمال',
    priority: 10,
  ),
  'clinical_clue': (
    emoji: '🩺',
    label: 'Clinical Clue',
    labelAr: 'دليل سريري',
    priority: 11,
  ),
  'investigation': (
    emoji: '🧪',
    label: 'Investigation',
    labelAr: 'فحوصات',
    priority: 12,
  ),
  'imaging': (emoji: '🩻', label: 'Imaging', labelAr: 'تصوير', priority: 13),
  'mechanism': (emoji: '🧠', label: 'Mechanism', labelAr: 'آلية', priority: 14),
  'pathophysiology': (
    emoji: '🧬',
    label: 'Pathophysiology',
    labelAr: 'فيزيولوجيا مرضية',
    priority: 15,
  ),
  'prognosis': (
    emoji: '📈',
    label: 'Prognosis',
    labelAr: 'إنذار',
    priority: 16,
  ),
  'definition': (
    emoji: '📌',
    label: 'Definition',
    labelAr: 'تعريف',
    priority: 17,
  ),
  'association': (
    emoji: '🔗',
    label: 'Association',
    labelAr: 'ارتباط',
    priority: 18,
  ),
};

CategoryInfo categoryInfo(String category) =>
    examFocusCategories[category] ?? examFocusCategories['high_yield']!;

/// Filter chips in priority order — only categories present in the deck.
List<({String category, int count})> visibleCategoryFilters(
  Map<String, int> counts,
) {
  final keys = examFocusCategories.keys.toList()
    ..sort(
      (a, b) => examFocusCategories[a]!.priority.compareTo(
        examFocusCategories[b]!.priority,
      ),
    );
  return [
    for (final k in keys)
      if ((counts[k] ?? 0) > 0) (category: k, count: counts[k]!),
  ];
}

/// One Exam Focus card (examFocus.cards item).
final class ExamFocusCard {
  const ExamFocusCard({
    required this.id,
    required this.category,
    required this.title,
    this.topic = '',
    this.points = const [],
    this.highlightLabel = '',
    this.highlightText = '',
    this.flag = '',
    this.sourcePages = const [],
    this.bookmarked = false,
  });

  factory ExamFocusCard.fromJson(JsonMap json) => ExamFocusCard(
    id: json.str('id'),
    category: json.strOrNull('category') ?? 'high_yield',
    title: json.strOrNull('title') ?? '',
    topic: json.strOrNull('topic') ?? '',
    points: [
      for (final p in (json['points'] as List?) ?? const [])
        if (p is String) p,
    ],
    highlightLabel: json.strOrNull('highlightLabel') ?? '',
    highlightText: json.strOrNull('highlightText') ?? '',
    flag: json.strOrNull('flag') ?? '',
    sourcePages: [
      for (final p in (json['sourcePages'] as List?) ?? const [])
        if (p is num) p.toInt(),
    ],
    bookmarked: json.boolean('bookmarked'),
  );

  final String id;
  final String category;
  final String title;
  final String topic;
  final List<String> points;
  final String highlightLabel;
  final String highlightText;
  final String flag;
  final List<int> sourcePages;
  final bool bookmarked;

  ExamFocusCard withBookmark(bool value) => ExamFocusCard(
    id: id,
    category: category,
    title: title,
    topic: topic,
    points: points,
    highlightLabel: highlightLabel,
    highlightText: highlightText,
    flag: flag,
    sourcePages: sourcePages,
    bookmarked: value,
  );
}

/// One page of examFocus.cards.
typedef ExamFocusPage = ({List<ExamFocusCard> items, int total, int? next});

/// deck.coverage — computed on the server when the deck is finalised.
final class ExamFocusCoverage {
  const ExamFocusCoverage({
    required this.complete,
    required this.contentPages,
    required this.coveredContentPages,
    required this.pagesWithoutText,
  });

  factory ExamFocusCoverage.fromJson(JsonMap json) => ExamFocusCoverage(
    complete: json.strOrNull('status') == 'COMPLETE',
    contentPages: json.integer('contentPages'),
    coveredContentPages: json.integer('coveredContentPages'),
    pagesWithoutText: ((json['pagesWithoutText'] as List?) ?? const []).length,
  );

  final bool complete;
  final int contentPages;
  final int coveredContentPages;
  final int pagesWithoutText;
}
