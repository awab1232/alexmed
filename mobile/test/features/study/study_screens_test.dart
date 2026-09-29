import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/study/data/study_models.dart';
import 'package:nirolearn/features/study/data/study_repository.dart';
import 'package:nirolearn/features/study/presentation/flashcards_view.dart';
import 'package:nirolearn/features/study/presentation/quiz_view.dart';
import 'package:nirolearn/features/study/presentation/study_screen.dart';
import 'package:nirolearn/l10n/app_localizations.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/fake_http.dart';
import 'study_fakes.dart';

Future<void> pump(
  WidgetTester tester,
  Widget child,
  FakeStudyRepository repo,
) async {
  tester.view.physicalSize =
      const Size(412, 900) * tester.view.devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    ProviderScope(
      retry: noAutomaticRetry,
      overrides: [
        envProvider.overrideWithValue(testEnv),
        sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
        studyRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp(
        locale: const Locale('ar'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        theme: buildNiroTheme(),
        home: child,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  group('flashcards', () {
    testWidgets('flip, rate through the server, counters, next card', (
      tester,
    ) async {
      final repo = FakeStudyRepository(studyJson());
      await pump(
        tester,
        const StudyScreen(bookId: 'b1', tool: StudyTool.cards),
        repo,
      );
      expect(find.text('البطاقة: 1/4'), findsOneWidget);
      expect(
        find.text('What does the loop of Henle do? (c0/0)'),
        findsOneWidget,
      );
      expect(find.text('السؤال · آلية'), findsOneWidget);

      await tester.tap(find.text('What does the loop of Henle do? (c0/0)'));
      await tester.pumpAndSettle();
      expect(find.text('Concentrates urine (c0/0)'), findsOneWidget);
      expect(find.textContaining('عروة هنلي'), findsOneWidget);

      await tester.tap(find.text('صعبة'));
      await tester.pumpAndSettle();
      expect(repo.calls, contains('rate:c0-card0:hard'));
      expect(find.text('البطاقة: 2/4'), findsOneWidget);
      // One still learning, three left.
      expect(find.text(isolateLtr('3')), findsWidgets);
    });

    testWidgets('EN ⇄ ع switches the card text and its direction', (
      tester,
    ) async {
      final repo = FakeStudyRepository(studyJson());
      await pump(
        tester,
        const StudyScreen(bookId: 'b1', tool: StudyTool.cards),
        repo,
      );
      await tester.tap(find.text('EN'));
      await tester.pumpAndSettle();
      final text = tester.widget<Text>(find.text('ما وظيفة عروة هنلي؟ (c0/0)'));
      expect(text.textDirection, TextDirection.rtl);
    });

    testWidgets('swipe and السابق / التالي move without rating', (
      tester,
    ) async {
      final repo = FakeStudyRepository(studyJson());
      await pump(
        tester,
        const StudyScreen(bookId: 'b1', tool: StudyTool.cards),
        repo,
      );
      await tester.tap(find.text('التالي'));
      await tester.pumpAndSettle();
      expect(find.text('البطاقة: 2/4'), findsOneWidget);
      // RTL: swiping right moves forward.
      await tester.fling(find.byType(PageView), const Offset(400, 0), 1500);
      await tester.pumpAndSettle();
      expect(find.text('البطاقة: 3/4'), findsOneWidget);
      await tester.tap(find.text('السابق'));
      await tester.pumpAndSettle();
      expect(find.text('البطاقة: 2/4'), findsOneWidget);
      expect(repo.calls.where((c) => c.startsWith('rate:')), isEmpty);
    });

    testWidgets('end of review → review only the hard cards', (tester) async {
      final repo = FakeStudyRepository(
        studyJson(chapterStatuses: const ['complete'], cardsPerChapter: 2),
      );
      await pump(
        tester,
        const StudyScreen(bookId: 'b1', tool: StudyTool.cards),
        repo,
      );
      for (final rating in ['لم أتذكر', 'سهلة']) {
        await tester.tap(find.byType(PageView));
        await tester.pumpAndSettle();
        await tester.tap(find.text(rating));
        await tester.pumpAndSettle();
      }
      expect(find.text('انتهت المراجعة 🎉'), findsOneWidget);
      await tester.tap(find.text('راجع البطاقات الصعبة'));
      await tester.pumpAndSettle();
      expect(find.text('البطاقة: 1/1'), findsOneWidget);
      expect(
        find.text('What does the loop of Henle do? (c0/0)'),
        findsOneWidget,
      );
    });

    testWidgets('cards arriving later are appended; the place is kept', (
      tester,
    ) async {
      final repo = FakeStudyRepository(studyJson());
      Widget view(Map<String, Object?> json) => FlashcardsView(
        content: StudyContent.fromJson(json),
        notice: const SizedBox(),
        title: 'بطاقات',
      );
      await pump(tester, view(studyJson(cardChapters: const ['c0'])), repo);
      await tester.tap(find.text('التالي'));
      await tester.pumpAndSettle();
      expect(find.text('البطاقة: 2/2'), findsOneWidget);
      // Generation finished for chapter 2: same screen, more cards.
      await pump(tester, view(studyJson()), repo);
      await tester.pumpAndSettle();
      expect(find.text('البطاقة: 2/4'), findsOneWidget);
      expect(
        find.text('What does the loop of Henle do? (c0/1)'),
        findsOneWidget,
      );
    });

    testWidgets('shared book with no cards: empty state, no generation', (
      tester,
    ) async {
      final repo = FakeStudyRepository(
        studyJson(role: 'shared', cardChapters: const []),
      );
      await pump(
        tester,
        const StudyScreen(bookId: 'b1', tool: StudyTool.cards),
        repo,
      );
      expect(find.text('لم يولّد صاحب الملف بطاقات بعد.'), findsOneWidget);
      expect(repo.calls.where((c) => c.startsWith('generate')), isEmpty);
    });
  });

  group('quiz', () {
    Future<FakeStudyRepository> openQuiz(WidgetTester tester) async {
      final repo = FakeStudyRepository(
        studyJson(chapterStatuses: const ['complete'], mcqsPerChapter: 2),
      );
      final content = StudyContent.fromJson(repo.contentJson);
      await pump(
        tester,
        QuizView(
          content: content,
          notice: const SizedBox(),
          title: 'اختبار',
          random: math.Random(1),
        ),
        repo,
      );
      return repo;
    }

    testWidgets('wrong answer: server result, red + green, explanation', (
      tester,
    ) async {
      final repo = await openQuiz(tester);
      expect(find.text('السؤال 1 من 2'), findsOneWidget);
      await tester.tap(find.text('Distal tubule'));
      await tester.pumpAndSettle();
      expect(repo.calls, contains('submit:c0-mcq0:2'));
      expect(find.text('إجابة خاطئة ✗'), findsOneWidget);
      expect(find.text('About 65% is reabsorbed proximally.'), findsOneWidget);
      expect(find.text('النتيجة: 0'), findsOneWidget);
      // Answered: the button says التالي and choices are locked.
      await tester.tap(find.text('Proximal tubule'));
      await tester.pump();
      expect(repo.calls.where((c) => c.startsWith('submit')), hasLength(1));
      expect(find.text('التالي'), findsOneWidget);
    });

    testWidgets('hint removes wrong choices down to two', (tester) async {
      await openQuiz(tester);
      await tester.tap(find.text('تلميح'));
      await tester.pump();
      await tester.tap(find.text('تلميح'));
      await tester.pump();
      final struck = tester
          .widgetList<Text>(find.byType(Text))
          .where((t) => t.style?.decoration == TextDecoration.lineThrough)
          .map((t) => t.data)
          .toList();
      expect(struck, hasLength(2));
      expect(struck, isNot(contains('Proximal tubule')));
      final hint = tester.widget<NlButton>(
        find.widgetWithText(NlButton, 'تلميح'),
      );
      expect(hint.onPressed, isNull);
    });

    testWidgets('flagged question shows its review note', (tester) async {
      await openQuiz(tester);
      await tester.tap(find.text('تخطي'));
      await tester.pumpAndSettle();
      expect(
        find.text('هذا السؤال يحتاج مراجعة: Check the percentage'),
        findsOneWidget,
      );
    });

    testWidgets('result → retry only the wrong ones', (tester) async {
      await openQuiz(tester);
      await tester.tap(find.text('Proximal tubule'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('التالي'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Collecting duct'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('التالي'));
      await tester.pumpAndSettle();
      expect(find.text('النتيجة: 1 / 2'), findsOneWidget);
      await tester.tap(find.text('أعد الأسئلة الغلط'));
      await tester.pumpAndSettle();
      expect(find.text('السؤال 2 من 2'), findsOneWidget);
      expect(find.text('إجابة خاطئة ✗'), findsNothing);
    });
  });

  group('summary', () {
    testWidgets('chapters, parts with pages, High-Yield; language toggle', (
      tester,
    ) async {
      final repo = FakeStudyRepository(studyJson());
      await pump(
        tester,
        const StudyScreen(bookId: 'b1', tool: StudyTool.summary),
        repo,
      );
      expect(find.text('Chapter 1'), findsOneWidget);
      expect(find.text('Part by part'), findsNWidgets(2));
      expect(find.text('English explanation 1.'), findsOneWidget);
      expect(find.text('⚡ High-Yield'), findsNWidgets(2));
      await tester.tap(find.byTooltip('عرض بالعربي'));
      await tester.pumpAndSettle();
      expect(find.text('ملخص كل جزء'), findsNWidgets(2));
      expect(find.text('شرح عربي 1.'), findsOneWidget);
    });

    testWidgets('owner composes a structured summary; reload when done', (
      tester,
    ) async {
      final repo =
          FakeStudyRepository(studyJson(chapterStatuses: const ['complete']))
            ..jobRounds = [
              const [
                GenerationJob(
                  chapterId: 'c0',
                  kind: 'medical_notes',
                  status: 'completed',
                ),
              ],
            ];
      await pump(
        tester,
        const StudyScreen(bookId: 'b1', tool: StudyTool.summary),
        repo,
      );
      await tester.tap(find.text('تجهيز ملخص منظم'));
      await tester.pump();
      expect(repo.calls, contains('compose:c0'));
      await tester.pump(const Duration(seconds: 3));
      await tester.pump();
      expect(repo.calls.where((c) => c == 'content'), hasLength(2));
    });
  });
}
