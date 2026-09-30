import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/library/data/library_models.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';
import 'package:nirolearn/features/progress/data/progress_repository.dart';
import 'package:nirolearn/features/progress/presentation/progress_screens.dart';
import 'package:nirolearn/features/progress/presentation/review_screen.dart';
import 'package:nirolearn/features/study/data/study_models.dart';
import 'package:nirolearn/features/study/data/study_repository.dart';
import 'package:nirolearn/features/study/presentation/study_screen.dart';
import 'package:nirolearn/l10n/app_localizations.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/fake_http.dart';
import '../study/study_fakes.dart';

DueCard dueBook(String id, int minutesAgo) => DueCard(
  id: id,
  source: DueSource.book,
  questionEn: 'Book question $id',
  questionAr: 'سؤال كتاب $id',
  answerEn: 'Book answer $id',
  answerAr: 'جواب كتاب $id',
  tag: 'Renal Physiology · Chapter 1',
  dueAt: DateTime.now().subtract(Duration(minutes: minutesAgo)),
  bookId: 'b1',
  sourcePage: 3,
);

DueCard dueDeck(String id, int minutesAgo) => DueCard(
  id: id,
  source: DueSource.deck,
  questionEn: 'Deck question $id',
  questionAr: 'سؤال ملف $id',
  answerEn: 'Deck answer $id',
  answerAr: 'جواب ملف $id',
  tag: 'Pharma Qs',
  dueAt: DateTime.now().subtract(Duration(minutes: minutesAgo)),
);

class FakeProgressRepository implements ProgressRepository {
  List<DueCard> dueCards = [dueDeck('d1', 90), dueBook('k1', 30)];
  bool failRate = false;
  final calls = <String>[];

  @override
  Future<List<DueCard>> due() async {
    calls.add('due');
    return [...dueCards]..sort((a, b) => a.dueAt.compareTo(b.dueAt));
  }

  @override
  Future<void> rate(DueCard card, CardRating rating) async {
    calls.add('rate:${card.source.name}:${card.id}:${rating.name}');
    if (failRate) throw const NetworkException();
  }

  @override
  Future<String> explain(String cardId) async {
    calls.add('explain:$cardId');
    return 'شرح أبسط للبطاقة';
  }

  @override
  Future<StudyStats> stats() async => const StudyStats(
    cardsReviewed: 128,
    accuracyPercent: 76,
    streakDays: 5,
    hoursStudied: 3.5,
  );

  @override
  Future<WeakPoints> weakPoints() async => (
    chapters: const [
      WeakChapter(
        bookId: 'b1',
        title: 'Renal Physiology · Chapter 1',
        wrongCount: 2,
      ),
    ],
    questions: const [
      WeakQuestion(
        mcqId: 'm1',
        questionEn: 'Which segment reabsorbs most sodium?',
        choices: ['Proximal tubule', 'Loop of Henle', 'Distal tubule'],
        explanationEn: 'About 65% proximally.',
        meta: 'Renal Physiology · Chapter 1',
      ),
    ],
  );

  @override
  Future<List<ForecastDay>> forecast() async => [
    (day: DateTime(2026, 10, 1), count: 12),
    (day: DateTime(2026, 10, 2), count: 4),
  ];

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> pump(
  WidgetTester tester,
  Widget screen, {
  FakeProgressRepository? progress,
  FakeStudyRepository? study,
  FakeLibraryRepository? library,
}) async {
  tester.view.physicalSize =
      const Size(412, 1000) * tester.view.devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => screen),
      GoRoute(
        path: '/books/:id/study',
        builder: (_, state) =>
            Scaffold(body: Text('STUDY ${state.uri.queryParameters['tool']}')),
      ),
      GoRoute(path: '/review', builder: (_, _) => const Text('REVIEW')),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      retry: noAutomaticRetry,
      overrides: [
        envProvider.overrideWithValue(testEnv),
        sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
        progressRepositoryProvider.overrideWithValue(
          progress ?? FakeProgressRepository(),
        ),
        studyRepositoryProvider.overrideWithValue(
          study ?? FakeStudyRepository(studyJson()),
        ),
        libraryRepositoryProvider.overrideWithValue(
          library ?? FakeLibraryRepository(),
        ),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('ar'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        theme: buildNiroTheme(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  group('review', () {
    testWidgets('both sources, oldest first; مِرآة card has 3 ratings', (
      tester,
    ) async {
      final repo = FakeProgressRepository();
      await pump(tester, const ReviewScreen(), progress: repo);
      expect(find.text('Deck question d1'), findsOneWidget); // due earliest
      await tester.tap(find.text('اظهر الإجابة'));
      await tester.pumpAndSettle();
      expect(find.text('لم أتذكر'), findsNothing);
      expect(find.text('اشرحها ببساطة'), findsNothing); // book cards only
      await tester.tap(find.text('جيدة'));
      await tester.pumpAndSettle();
      expect(repo.calls, contains('rate:deck:d1:good'));
      expect(find.text('1 أتقنتها'), findsOneWidget);

      // Next: the book card — 4 ratings and «اشرحها ببساطة».
      expect(find.text('Book question k1'), findsOneWidget);
      await tester.tap(find.text('اظهر الإجابة'));
      await tester.pumpAndSettle();
      expect(find.text('لم أتذكر'), findsOneWidget);
      await tester.tap(find.text('اشرحها ببساطة'));
      await tester.pumpAndSettle();
      expect(find.text('شرح أبسط للبطاقة'), findsOneWidget);
      await tester.tap(find.text('لم أتذكر'));
      await tester.pumpAndSettle();
      expect(repo.calls, contains('rate:book:k1:again'));
      expect(find.text('ممتاز، ما في بطاقات مستحقة اليوم'), findsOneWidget);
    });

    testWidgets('a rating that fails puts the card back', (tester) async {
      final repo = FakeProgressRepository()
        ..dueCards = [dueBook('k1', 5)]
        ..failRate = true;
      await pump(tester, const ReviewScreen(), progress: repo);
      await tester.tap(find.text('اظهر الإجابة'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('سهلة'));
      await tester.pumpAndSettle();
      expect(find.text('Book question k1'), findsOneWidget);
      expect(find.text('0 أتقنتها'), findsOneWidget);
    });
  });

  testWidgets('stats: the four numbers', (tester) async {
    await pump(tester, const StatsScreen());
    await tester.pumpAndSettle();
    expect(find.text(isolateLtr('128')), findsOneWidget);
    expect(find.text(isolateLtr('76%')), findsOneWidget);
    expect(find.text(isolateLtr('3.5')), findsOneWidget);
    expect(find.text('نقاط الضعف'), findsOneWidget);
  });

  testWidgets('weak points: right answer shown, then removed', (tester) async {
    final study = FakeStudyRepository(studyJson());
    await pump(
      tester,
      const WeakPointsScreen(resolveDelay: Duration(milliseconds: 100)),
      study: study,
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Renal Physiology · Chapter 1'), findsWidgets);
    await tester.tap(find.text('Proximal tubule'));
    await tester.pump();
    await tester.pump();
    expect(study.calls, contains('submit:m1:0'));
    expect(find.text('إجابة صحيحة ✓'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 150));
    await tester.pumpAndSettle();
    expect(find.text('ما في نقاط ضعف حاليًا'), findsOneWidget);
  });

  testWidgets('today: due count, forecast, nearest exam', (tester) async {
    final library = FakeLibraryRepository()
      ..due = 7
      ..folders = [
        Subject(
          id: 's1',
          name: 'فسيولوجيا',
          type: 'medical',
          bookCount: 2,
          examDate: DateTime.now().add(const Duration(days: 10)),
        ),
      ];
    await pump(tester, const TodayScreen(), library: library);
    await tester.pumpAndSettle();
    expect(find.textContaining('7 بطاقة'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.textContaining('بعد 10 يوم'), findsOneWidget);
    await tester.tap(find.text('ابدأ المراجعة'));
    await tester.pumpAndSettle();
    expect(find.text('REVIEW'), findsOneWidget);
  });

  group('knowledge matrix + rebuild', () {
    Map<String, Object?> knowledge() => {
      'rows': [
        {
          'itemId': 'k1',
          'orderIndex': 1,
          'title': 'Loop diuretics block NKCC2',
          'sourcePages': [3, 4],
          'cardIds': ['a'],
          'questionIds': <String>[],
          'questionTypes': ['recall'],
        },
        {
          'itemId': 'k2',
          'orderIndex': 2,
          'title': 'Thiazides act on the DCT',
          'sourcePages': [5],
          'cardIds': <String>[],
          'questionIds': <String>[],
          'questionTypes': <String>[],
        },
      ],
      'chapters': [
        {
          'chapterId': 'c0',
          'cards': {'knowledge': 0, 'v1': 2},
          'mcqs': {'knowledge': 0, 'v1': 2},
        },
        {
          'chapterId': 'c1',
          'cards': {'knowledge': 2, 'v1': 0},
          'mcqs': {'knowledge': 0, 'v1': 0},
        },
      ],
    };

    testWidgets('matrix sheet; owner rebuilds V1 chapters after confirming', (
      tester,
    ) async {
      final study = FakeStudyRepository(studyJson())
        ..knowledgeJson = knowledge()
        ..decks = [deck('complete', done: 4)]
        ..jobRounds = [
          const [
            GenerationJob(
              chapterId: 'c0',
              kind: 'flashcards',
              status: 'completed',
            ),
          ],
        ];
      await pump(
        tester,
        const StudyScreen(bookId: 'b1', tool: StudyTool.cards),
        study: study,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('🧠 المعرفة: بطاقات تغطي 1/2 حقيقة'));
      await tester.pumpAndSettle();
      expect(find.text('#1 Loop diuretics block NKCC2'), findsOneWidget);
      await tester.tapAt(const Offset(10, 10)); // close the sheet
      await tester.pumpAndSettle();

      await tester.tap(find.text('✨ أعد بناء البطاقات من قاعدة المعرفة'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(NlButton, 'إعادة البناء'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
      // Only the V1 chapter, with rebuild.
      expect(study.calls.where((c) => c.startsWith('generate:')), [
        'generate:cards:c0:rebuild',
      ]);
    });

    testWidgets('shared book: matrix yes, rebuild no', (tester) async {
      final study = FakeStudyRepository(studyJson(role: 'shared'))
        ..knowledgeJson = knowledge();
      await pump(
        tester,
        const StudyScreen(bookId: 'b1', tool: StudyTool.cards),
        study: study,
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('🧠 المعرفة'), findsOneWidget);
      expect(find.textContaining('أعد بناء'), findsNothing);
    });
  });
}
