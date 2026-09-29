import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/core/upload/pdf_upload.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/library/data/library_models.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';
import 'package:nirolearn/features/mirror/data/mirror_models.dart';
import 'package:nirolearn/features/mirror/data/mirror_repository.dart';
import 'package:nirolearn/features/mirror/presentation/mirror_deck_screen.dart';
import 'package:nirolearn/features/mirror/presentation/mirror_job_screen.dart';
import 'package:nirolearn/features/mirror/presentation/mirror_start_screen.dart';
import 'package:nirolearn/l10n/app_localizations.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/fake_http.dart';

class FakeMirrorRepository implements MirrorRepository {
  final calls = <String>[];
  List<MirrorJob> jobs = [];
  List<MirrorDeck> decks = [];

  @override
  Future<({String jobId, String deckId})> startFromText({
    required String text,
    required MirrorDepth depth,
    String? subjectId,
    String? appendToDeckId,
    String? title,
  }) async {
    calls.add('text:${depth.wire}:$subjectId:$appendToDeckId:${text.length}');
    return (jobId: 'j1', deckId: 'd1');
  }

  @override
  Future<String> startFromPdf({
    required PickedPdf pdf,
    required MirrorDepth depth,
    required String subjectId,
    void Function(double progress)? onProgress,
    CancelToken? cancelToken,
  }) async => 'j1';

  @override
  Future<MirrorJob> job(String id) async {
    calls.add('job');
    return jobs.length > 1 ? jobs.removeAt(0) : jobs.single;
  }

  @override
  Future<MirrorDeck> deck(String id) async {
    calls.add('deck');
    return decks.length > 1 ? decks.removeAt(0) : decks.single;
  }

  @override
  Future<void> retryBatch(String batchId) async => calls.add('retry:$batchId');

  @override
  Future<void> retryExtraction(String jobId) async =>
      calls.add('retryExtraction:$jobId');

  @override
  Future<void> deleteDeck(String id) async => calls.add('delete:$id');

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

const q1 = MirrorCard(
  id: 'c1',
  question: 'Which drug is a loop diuretic? A. Furosemide B. Spironolactone C. Amiloride D. Mannitol',
  questionArabic:
      'أي دواء مدر عروي؟ أ) فوروسيميد ب) سبيرونولاكتون ج) أميلوريد د) مانيتول',
  answer: 'A. Furosemide',
  answerArabic: 'فوروسيميد',
  explanation: 'Furosemide acts on the loop of Henle.',
  explanationArabic: 'يعمل على عروة هنلي.',
  keyIdea: 'Loop diuretics block NKCC2.',
  keyword: 'loop',
  sourcePage: 3,
);
const q2 = MirrorCard(
  id: 'c2',
  question: 'Define homeostasis.',
  answer: 'A stable internal environment.',
  sourcePage: 4,
  needsReview: true,
);
const q3 = MirrorCard(
  id: 'c3',
  question: 'Name the pacemaker of the heart.',
  answer: 'SA node',
  sourcePage: 5,
);

MirrorDeck deckWith(List<MirrorCard> cards, {MirrorJobStatus? status}) =>
    MirrorDeck(
      id: 'd1',
      fileName: 'Pharma_Qs.pdf',
      pageCount: 10,
      cards: cards,
      jobId: status == null ? null : 'j1',
      jobStatus: status,
    );

Future<FakeMirrorRepository> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  FakeMirrorRepository? mirror,
  FakeLibraryRepository? library,
}) async {
  tester.view.physicalSize =
      const Size(412, 1400) * tester.view.devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  final repo = mirror ?? FakeMirrorRepository();
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => screen),
      GoRoute(
        path: '/decks/:id',
        builder: (_, state) =>
            Scaffold(body: Text('DECK ${state.pathParameters['id']}')),
      ),
      GoRoute(
        path: '/mirror/jobs/:id',
        builder: (_, state) =>
            Scaffold(body: Text('JOB ${state.pathParameters['id']}')),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      retry: noAutomaticRetry,
      overrides: [
        envProvider.overrideWithValue(testEnv),
        sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
        mirrorRepositoryProvider.overrideWithValue(repo),
        libraryRepositoryProvider.overrideWithValue(
          library ?? FakeLibraryRepository(),
        ),
        accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
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
  return repo;
}

void main() {
  group('start screen', () {
    testWidgets('submit stays disabled until file/text AND folder are set', (
      tester,
    ) async {
      final library = FakeLibraryRepository()
        ..folders = [const Subject(id: 's1', name: 'أدوية', type: 'medical')];
      final repo = await pumpScreen(
        tester,
        const MirrorStartScreen(),
        library: library,
      );
      await tester.pumpAndSettle();
      NlButton submit() => tester.widget<NlButton>(
        find.widgetWithText(NlButton, 'حوّل إلى بطاقات'),
      );
      expect(submit().onPressed, isNull);

      // Paste text mode.
      await tester.tap(find.text('نص أسئلة'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'short');
      await tester.pump();
      expect(
        find.text('الصق نص الأسئلة أولًا (نص قصير جدًا).'),
        findsOneWidget,
      );
      expect(submit().onPressed, isNull);

      await tester.enterText(
        find.byType(TextField).first,
        '1. Which drug is a loop diuretic? A. Furosemide B. Mannitol',
      );
      await tester.pump();
      expect(submit().onPressed, isNull); // no folder yet

      await tester.tap(find.text('اختر مجلدًا'));
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('أدوية').last);
      await tester.pumpAndSettle();
      expect(submit().onPressed, isNotNull);

      // Depth: pick "مفصّل".
      await tester.tap(find.text('مفصّل'));
      await tester.pump();
      await tester.tap(find.widgetWithText(NlButton, 'حوّل إلى بطاقات'));
      await tester.pumpAndSettle();
      expect(repo.calls.single, startsWith('text:detailed:s1:null:'));
      expect(find.text('JOB j1'), findsOneWidget);
    });
  });

  group('job screen', () {
    testWidgets(
      'polls while generating, then opens the deck once a part is ready',
      (tester) async {
        final repo = FakeMirrorRepository()
          ..jobs = [
            const MirrorJob(
              id: 'j1',
              fileName: 'Q.pdf',
              status: MirrorJobStatus.extracting,
              batches: [],
            ),
            const MirrorJob(
              id: 'j1',
              fileName: 'Q.pdf',
              status: MirrorJobStatus.pending,
              deckId: 'd1',
              pageCount: 20,
              batches: [
                MirrorBatch(
                  id: 'b1',
                  startPage: 1,
                  endPage: 10,
                  status: 'generating',
                ),
                MirrorBatch(
                  id: 'b2',
                  startPage: 11,
                  endPage: 20,
                  status: 'pending',
                ),
              ],
            ),
            const MirrorJob(
              id: 'j1',
              fileName: 'Q.pdf',
              status: MirrorJobStatus.pending,
              deckId: 'd1',
              batches: [
                MirrorBatch(
                  id: 'b1',
                  startPage: 1,
                  endPage: 10,
                  status: 'complete',
                ),
                MirrorBatch(
                  id: 'b2',
                  startPage: 11,
                  endPage: 20,
                  status: 'pending',
                ),
              ],
            ),
          ];
        await pumpScreen(
          tester,
          const MirrorJobScreen(
            jobId: 'j1',
            pollInterval: Duration(milliseconds: 100),
          ),
          mirror: repo,
        );
        expect(find.text('نقرأ الملف ونجهّزه…'), findsOneWidget);
        await tester.pump(const Duration(milliseconds: 120));
        await tester.pump();
        expect(find.text('نجهّز بطاقاتك'), findsOneWidget);
        expect(find.text('تم 0 من 2 جزءًا'), findsOneWidget);
        await tester.pump(const Duration(milliseconds: 120));
        await tester.pumpAndSettle();
        expect(find.text('DECK d1'), findsOneWidget);
      },
    );

    testWidgets('failed extraction: message + retry the failed pages', (
      tester,
    ) async {
      final repo = FakeMirrorRepository()
        ..jobs = [
          const MirrorJob(
            id: 'j1',
            fileName: 'Q.pdf',
            status: MirrorJobStatus.failed,
            batches: [],
          ),
        ];
      await pumpScreen(
        tester,
        const MirrorJobScreen(jobId: 'j1'),
        mirror: repo,
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('تعذّرت قراءة هذا الملف'), findsOneWidget);
      await tester.tap(find.text('إعادة محاولة الصفحات الفاشلة'));
      await tester.pumpAndSettle();
      expect(repo.calls, contains('retryExtraction:j1'));
    });

    testWidgets('failed parts are listed with a retry each', (tester) async {
      final repo = FakeMirrorRepository()
        ..jobs = [
          const MirrorJob(
            id: 'j1',
            fileName: 'Q.pdf',
            status: MirrorJobStatus.partialFailed,
            deckId: 'd1',
            batches: [
              MirrorBatch(
                id: 'b1',
                startPage: 1,
                endPage: 10,
                status: 'complete',
              ),
              MirrorBatch(
                id: 'b2',
                startPage: 11,
                endPage: 20,
                status: 'failed',
                errorMessage: 'انتهت المهلة',
              ),
            ],
          ),
        ];
      await pumpScreen(
        tester,
        const MirrorJobScreen(jobId: 'j1', detailsOnly: true),
        mirror: repo,
      );
      await tester.pumpAndSettle();
      expect(find.text('صفحة 11–20'), findsOneWidget);
      expect(find.text('انتهت المهلة'), findsOneWidget);
      await tester.tap(find.byTooltip('أعد المحاولة'));
      await tester.pumpAndSettle();
      expect(repo.calls, contains('retry:b2'));
    });
  });

  group('deck screen', () {
    testWidgets('tap the right option → green + "إجابة صحيحة" + explanation', (
      tester,
    ) async {
      final repo = FakeMirrorRepository()
        ..decks = [
          deckWith([q1, q2]),
        ];
      await pumpScreen(
        tester,
        const MirrorDeckScreen(deckId: 'd1'),
        mirror: repo,
      );
      await tester.pumpAndSettle();
      expect(find.text('بطاقة 1 من 2'), findsOneWidget);
      expect(find.text('Furosemide'), findsOneWidget);
      await tester.tap(find.text('Furosemide'));
      await tester.pumpAndSettle();
      expect(find.text('إجابة صحيحة'), findsOneWidget);
      expect(
        find.text('Furosemide acts on the loop of Henle.'),
        findsOneWidget,
      );
      expect(find.text('الفكرة الأساسية'), findsOneWidget);
    });

    testWidgets(
      'a wrong option → "إجابة خاطئة"; translation toggle shows Arabic',
      (tester) async {
        final repo = FakeMirrorRepository()
          ..decks = [
            deckWith([q1]),
          ];
        await pumpScreen(
          tester,
          const MirrorDeckScreen(deckId: 'd1'),
          mirror: repo,
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('Mannitol'));
        await tester.pumpAndSettle();
        expect(find.text('إجابة خاطئة'), findsOneWidget);
        await tester.tap(find.text('عرض الترجمة'));
        await tester.pumpAndSettle();
        expect(find.textContaining('فوروسيميد'), findsWidgets);
      },
    );

    testWidgets('"needs review" filter and next/previous', (tester) async {
      final repo = FakeMirrorRepository()
        ..decks = [
          deckWith([q1, q2, q3]),
        ];
      await pumpScreen(
        tester,
        const MirrorDeckScreen(deckId: 'd1'),
        mirror: repo,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(NlButton, 'التالية'));
      await tester.pumpAndSettle();
      expect(find.text('بطاقة 2 من 3'), findsOneWidget);
      await tester.tap(find.textContaining('تحتاج مراجعة · 1'));
      await tester.pumpAndSettle();
      expect(find.text('بطاقة 1 من 1'), findsOneWidget);
      expect(find.text('Define homeostasis.'), findsOneWidget);
    });

    testWidgets('while generating: polls and appends new cards, place kept', (
      tester,
    ) async {
      final repo = FakeMirrorRepository()
        ..decks = [
          deckWith([q1], status: MirrorJobStatus.pending),
          deckWith([q1, q2], status: MirrorJobStatus.complete),
        ];
      await pumpScreen(
        tester,
        const MirrorDeckScreen(
          deckId: 'd1',
          pollInterval: Duration(seconds: 2),
        ),
        mirror: repo,
      );
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.textContaining('جاري تجهيز المزيد'), findsOneWidget);
      expect(find.text('بطاقة 1 من 1'), findsOneWidget);
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(find.text('بطاقة 1 من 2'), findsOneWidget);
      expect(find.textContaining('جاري تجهيز المزيد'), findsNothing);
      expect(repo.calls.where((c) => c == 'deck'), hasLength(2));
    });
  });
}
