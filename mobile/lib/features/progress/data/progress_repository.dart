import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/json.dart';
import '../../../core/api/trpc_client.dart';
import '../../library/data/library_models.dart' show bookDisplayTitle;
import '../../study/data/study_models.dart' show CardRating;

enum DueSource { book, deck }

/// One due card from كتبي (`books.dueCards`, FSRS, 4 ratings) or مِرآة
/// (`decks.dueCards`, SM-2, 3 ratings) — the web review page merges both
/// on the client, oldest due first.
final class DueCard {
  const DueCard({
    required this.id,
    required this.source,
    required this.questionEn,
    required this.questionAr,
    required this.answerEn,
    required this.answerAr,
    required this.tag,
    required this.dueAt,
    this.relatedTermEn,
    this.bookId,
    this.sourcePage,
  });

  factory DueCard.fromBook(JsonMap json) => DueCard(
    id: json.str('id'),
    source: DueSource.book,
    questionEn: json.strOrNull('questionEn') ?? '',
    questionAr: json.strOrNull('questionAr') ?? '',
    answerEn: json.strOrNull('answerEn') ?? '',
    answerAr: json.strOrNull('answerAr') ?? '',
    tag: [
      bookDisplayTitle(json.strOrNull('bookFileName')),
      json.strOrNull('chapterTitle') ?? '',
    ].where((s) => s.isNotEmpty).join(' · '),
    dueAt: json.date('dueAt') ?? DateTime.fromMillisecondsSinceEpoch(0),
    relatedTermEn: json.strOrNull('relatedTermEn'),
    bookId: json.strOrNull('bookId'),
    sourcePage: json.intOrNull('sourcePage'),
  );

  factory DueCard.fromDeck(JsonMap json) => DueCard(
    id: json.str('id'),
    source: DueSource.deck,
    questionEn: json.strOrNull('question') ?? '',
    questionAr: json.strOrNull('questionArabic') ?? '',
    answerEn: json.strOrNull('answer') ?? '',
    answerAr: json.strOrNull('answerArabic') ?? '',
    tag: bookDisplayTitle(json.strOrNull('deckFileName')),
    dueAt: json.date('dueAt') ?? DateTime.fromMillisecondsSinceEpoch(0),
    relatedTermEn: json.strOrNull('keyword'),
    sourcePage: json.intOrNull('sourcePage'),
  );

  final String id;
  final DueSource source;
  final String questionEn;
  final String questionAr;
  final String answerEn;
  final String answerAr;

  /// File (and chapter) the card comes from.
  final String tag;
  final DateTime dueAt;
  final String? relatedTermEn;
  final String? bookId;
  final int? sourcePage;
}

final class StudyStats {
  const StudyStats({
    this.cardsReviewed = 0,
    this.accuracyPercent = 0,
    this.streakDays = 0,
    this.hoursStudied = 0,
  });

  factory StudyStats.fromJson(JsonMap json) => StudyStats(
    cardsReviewed: json.integer('cardsReviewed'),
    accuracyPercent: json.integer('accuracyPercent'),
    streakDays: json.integer('streakDays'),
    hoursStudied: json['hoursStudied'] is num
        ? (json['hoursStudied']! as num).toDouble()
        : 0,
  );

  final int cardsReviewed;
  final int accuracyPercent;
  final int streakDays;
  final double hoursStudied;
}

final class WeakChapter {
  const WeakChapter({
    required this.bookId,
    required this.title,
    required this.wrongCount,
  });

  final String bookId;

  /// "Book · chapter".
  final String title;
  final int wrongCount;
}

final class WeakQuestion {
  const WeakQuestion({
    required this.mcqId,
    required this.questionEn,
    required this.choices,
    required this.explanationEn,
    required this.meta,
  });

  final String mcqId;
  final String questionEn;
  final List<String> choices;
  final String explanationEn;

  /// "Book · chapter".
  final String meta;
}

typedef WeakPoints = ({
  List<WeakChapter> chapters,
  List<WeakQuestion> questions,
});

/// One day of the 7-day review forecast (كتبي cards).
typedef ForecastDay = ({DateTime day, int count});

/// Review, stats, weak points and the forecast — the web's /review,
/// /books/stats, /books/weak-points and /today, same procedures.
class ProgressRepository {
  ProgressRepository(this.trpc);

  final TrpcClient trpc;

  /// Both due lists, merged and sorted like the web.
  Future<List<DueCard>> due() async {
    final results = await Future.wait([
      trpc.query(
        'books.dueCards',
        offline: true,
        parse: (data) => asMapList(data).map(DueCard.fromBook).toList(),
      ),
      trpc.query(
        'decks.dueCards',
        offline: true,
        parse: (data) => asMapList(data).map(DueCard.fromDeck).toList(),
      ),
    ]);
    return [...results[0], ...results[1]]
      ..sort((a, b) => a.dueAt.compareTo(b.dueAt));
  }

  /// كتبي cards take 4 ratings (FSRS); مِرآة cards 3 (SM-2, no "again").
  Future<void> rate(DueCard card, CardRating rating) {
    assert(card.source == DueSource.book || rating != CardRating.again);
    return trpc.mutation(
      card.source == DueSource.book ? 'books.rateCard' : 'decks.rateCard',
      input: {'cardId': card.id, 'rating': rating.name},
      parse: (_) {},
      // Kept and sent later when offline (blueprint §14).
      queueOffline: true,
    );
  }

  /// "اشرحها ببساطة" — an AI answer on the assistant quota (book cards).
  Future<String> explain(String cardId) => trpc.mutation(
    'books.explainCard',
    input: {'cardId': cardId},
    parse: (data) => asMap(data).strOrNull('explanationAr') ?? '',
  );

  Future<StudyStats> stats() => trpc.query(
    'books.stats',
    offline: true,
    parse: (data) => StudyStats.fromJson(asMap(data)),
  );

  Future<WeakPoints> weakPoints() => trpc.query(
    'books.listWeakPoints',
    offline: true,
    parse: (data) {
      final json = asMap(data);
      String meta(JsonMap r) => [
        bookDisplayTitle(r.strOrNull('bookFileName')),
        r.strOrNull('chapterTitle') ?? '',
      ].where((s) => s.isNotEmpty).join(' · ');
      return (
        chapters: [
          for (final r in asMapList(json['chapters']))
            WeakChapter(
              bookId: r.str('bookId'),
              title: meta(r),
              wrongCount: r.integer('wrongCount'),
            ),
        ],
        questions: [
          for (final r in asMapList(json['questions']))
            WeakQuestion(
              mcqId: r.str('mcqId'),
              questionEn: r.strOrNull('questionEn') ?? '',
              choices: [
                for (final c in (r['choices'] as List?) ?? const [])
                  if (c is String) c,
              ],
              explanationEn: r.strOrNull('explanationEn') ?? '',
              meta: meta(r),
            ),
        ],
      );
    },
  );

  Future<List<ForecastDay>> forecast() => trpc.query(
    'books.upcomingForecast',
    offline: true,
    parse: (data) => [
      for (final r in asMapList(data))
        if (r.date('day') case final day?)
          (day: day, count: r.integer('count')),
    ],
  );
}

final progressRepositoryProvider = Provider<ProgressRepository>(
  (ref) => ProgressRepository(ref.watch(trpcProvider)),
);
