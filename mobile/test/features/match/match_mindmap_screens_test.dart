import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/match/domain/match_game.dart';
import 'package:nirolearn/features/match/presentation/match_screen.dart';
import 'package:nirolearn/features/mindmap/data/mindmap_repository.dart';
import 'package:nirolearn/features/mindmap/presentation/mindmap_screen.dart';
import 'package:nirolearn/features/study/data/study_models.dart';
import 'package:nirolearn/features/study/data/study_repository.dart';
import 'package:nirolearn/l10n/app_localizations.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/fake_http.dart';
import '../study/study_fakes.dart';
import 'match_parity_test.dart' show mulberry32;

class FakeMindMapRepository implements MindMapRepository {
  FakeMindMapRepository(this.maps);

  /// Answers in order (last one repeats).
  List<MindMap> maps;
  int _map = 0;
  List<List<GenerationJob>> jobRounds = [const []];
  int _jobs = 0;
  final calls = <String>[];

  @override
  Future<MindMap> get(String bookId) async {
    calls.add('get');
    final m = maps[_map.clamp(0, maps.length - 1)];
    _map++;
    return m;
  }

  @override
  Future<void> generate(String chapterId) async =>
      calls.add('generate:$chapterId');

  @override
  Future<List<GenerationJob>> jobs(String bookId) async {
    calls.add('jobs');
    final r = jobRounds[_jobs.clamp(0, jobRounds.length - 1)];
    _jobs++;
    return r;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

const _section = MindMapSection(
  title: 'Sodium handling',
  summaryEn: 'The proximal tubule reabsorbs most sodium.',
  explanationAr: 'يعيد الأنبوب القريب امتصاص معظم الصوديوم.',
  sourcePages: [3, 4],
  concepts: [
    MindMapConcept(
      termEn: 'Proximal tubule',
      termAr: 'الأنبوب القريب',
      explanationEn: 'First segment after the glomerulus.',
    ),
  ],
  examPoints: ['About 65% of sodium'],
  cardPrompts: ['Where is most sodium reabsorbed?'],
);

MindMap map({bool built = true, bool owner = true}) => MindMap(
  fileName: 'Renal_Physiology.pdf',
  isOwner: owner,
  chapters: [
    MindMapChapter(
      id: 'c0',
      title: 'Chapter 1',
      keyPoints: const ['Point A1'],
      sections: built ? const [_section] : const [],
      visuals: const [
        MindMapVisual(
          pageNumber: 4,
          assetType: 'diagram',
          descriptionEn: 'Nephron',
        ),
      ],
    ),
  ],
);

Future<void> pump(
  WidgetTester tester,
  Widget screen, {
  FakeStudyRepository? study,
  FakeMindMapRepository? mindmap,
}) async {
  tester.view.physicalSize =
      const Size(412, 900) * tester.view.devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => screen),
      GoRoute(
        path: '/books/:id/study',
        builder: (_, state) =>
            Scaffold(body: Text('STUDY ${state.uri.queryParameters['tool']}')),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      retry: noAutomaticRetry,
      overrides: [
        envProvider.overrideWithValue(testEnv),
        sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
        studyRepositoryProvider.overrideWithValue(
          study ?? FakeStudyRepository(studyJson()),
        ),
        mindMapRepositoryProvider.overrideWithValue(
          mindmap ?? FakeMindMapRepository([map()]),
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
  group('match', () {
    // Four short cards → four pairs (8 tiles).
    Map<String, Object?> content() =>
        studyJson(chapterStatuses: const ['complete', 'complete'])
          ..['terms'] = <Object>[];

    testWidgets('a right pair disappears; a wrong one costs a second', (
      tester,
    ) async {
      final study = FakeStudyRepository(content());
      await pump(
        tester,
        MatchScreen(bookId: 'b1', random: mulberry32(5)),
        study: study,
      );
      final c = StudyContent.fromJson(study.contentJson);
      final pairs = buildMatchPairs(
        [
          for (final card in c.cards)
            (id: card.id, questionEn: card.questionEn, answerEn: card.answerEn),
        ],
        c.terms,
        random: mulberry32(5),
      );
      expect(pairs, hasLength(4));
      // Wrong: a question with another pair's answer.
      await tester.tap(find.text(pairs[0].prompt));
      await tester.tap(find.text(pairs[1].answer));
      await tester.pump();
      expect(find.textContaining('1.'), findsWidgets); // penalty shows 1.x s
      await tester.pump(const Duration(milliseconds: 600));
      // Right: each pair in turn.
      for (final pair in pairs) {
        await tester.tap(find.text(pair.prompt));
        await tester.tap(find.text(pair.answer));
        await tester.pump();
      }
      await tester.pumpAndSettle();
      expect(
        find.text('رقم قياسي جديد! 🏆 أداء رائع 💪\nأخطاء: 1 (+ثانية لكل خطأ)'),
        findsOneWidget,
      );
      expect(find.text('العب مرة ثانية'), findsOneWidget);
    });

    testWidgets('fewer than three pairs → make cards first', (tester) async {
      await pump(
        tester,
        MatchScreen(bookId: 'b1', random: mulberry32(1)),
        study: FakeStudyRepository(
          studyJson(cardChapters: const [])..['terms'] = <Object>[],
        ),
      );
      expect(find.text('نحتاج بطاقات أولاً 🃏'), findsOneWidget);
      await tester.tap(find.text('توليد البطاقات'));
      await tester.pumpAndSettle();
      expect(find.text('STUDY cards'), findsOneWidget);
    });
  });

  group('mind map', () {
    testWidgets('a chapter opens into its branches; links to the study tools', (
      tester,
    ) async {
      await pump(tester, const MindMapScreen(bookId: 'b1'));
      expect(find.text('Chapter 1'), findsOneWidget);
      await tester.tap(find.text('Chapter 1'));
      await tester.pumpAndSettle();
      expect(find.text('Sodium handling'), findsOneWidget);
      expect(
        find.text('The proximal tubule reabsorbs most sodium.'),
        findsOneWidget,
      );
      expect(find.text('About 65% of sodium'), findsOneWidget);
      expect(find.textContaining('مخطط · صفحة 4'), findsOneWidget);
      await tester.ensureVisible(find.text('فتح البطاقات'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('فتح البطاقات'));
      await tester.pumpAndSettle();
      expect(find.text('STUDY cards'), findsOneWidget);
    });

    testWidgets('owner builds a chapter map: job followed, map reloaded', (
      tester,
    ) async {
      final repo = FakeMindMapRepository([map(built: false), map()])
        ..jobRounds = [
          const [],
          const [
            GenerationJob(
              chapterId: 'c0',
              kind: 'mindmap',
              status: 'processing',
            ),
          ],
          const [
            GenerationJob(
              chapterId: 'c0',
              kind: 'mindmap',
              status: 'completed',
            ),
          ],
        ];
      await pump(
        tester,
        const MindMapScreen(bookId: 'b1', pollInterval: Duration(seconds: 1)),
        mindmap: repo,
      );
      await tester.tap(find.text('بناء الخريطة'));
      await tester.pump();
      await tester.pump();
      expect(repo.calls, contains('generate:c0'));
      expect(find.text('جاري البناء…'), findsOneWidget);
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      await tester.pump();
      expect(repo.calls.where((c) => c == 'get'), hasLength(2));
      expect(find.text('1 أقسام · 1 نقاط مهمة'), findsOneWidget);
    });

    testWidgets('failed job shows its reason; shared map has no build button', (
      tester,
    ) async {
      final repo = FakeMindMapRepository([map(built: false)])
        ..jobRounds = [
          const [
            GenerationJob(
              chapterId: 'c0',
              kind: 'mindmap',
              status: 'failed',
              errorMessage: 'الفصل قصير جدًا لبناء خريطة.',
            ),
          ],
        ];
      await pump(tester, const MindMapScreen(bookId: 'b1'), mindmap: repo);
      expect(find.text('الفصل قصير جدًا لبناء خريطة.'), findsOneWidget);
      expect(find.text('أعد المحاولة'), findsOneWidget);

      await pump(
        tester,
        const MindMapScreen(bookId: 'b1'),
        mindmap: FakeMindMapRepository([map(built: false, owner: false)]),
      );
      expect(find.text('بناء الخريطة'), findsNothing);
      expect(
        find.text('لم يبنِ صاحب الملف خريطة هذا الفصل بعد.'),
        findsOneWidget,
      );
    });
  });
}
