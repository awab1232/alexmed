import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/exam_focus/data/exam_focus_models.dart';
import 'package:nirolearn/features/exam_focus/data/exam_focus_repository.dart';
import 'package:nirolearn/features/exam_focus/presentation/exam_focus_screen.dart';
import 'package:nirolearn/l10n/app_localizations.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/fake_http.dart';

ExamFocusCard efCard(int i, {String category = 'high_yield'}) => ExamFocusCard(
  id: 'card$i',
  category: category,
  title: 'Fact number $i',
  topic: 'Burns',
  points: ['Irrigate for 15–30 minutes', '• Remove clothing'],
  highlightLabel: 'KEY POINT',
  highlightText: 'pH 7.4 target',
  sourcePages: [i + 1],
);

ExamFocusDeck readyDeck({
  int total = 3,
  bool owner = true,
  int bookmarked = 0,
  String status = 'complete',
}) => ExamFocusDeck(
  status: status,
  totalCards: total,
  units: [
    const ExamFocusUnit(
      id: 'u1',
      pageStart: 1,
      pageEnd: 10,
      status: 'complete',
    ),
    if (status == 'partial_failed')
      const ExamFocusUnit(
        id: 'u2',
        pageStart: 11,
        pageEnd: 20,
        status: 'failed',
      ),
  ],
  categoryCounts: {'high_yield': total - 1, 'emergency': 1},
  bookmarkedCount: bookmarked,
  isOwner: owner,
);

class FakeExamFocusRepository implements ExamFocusRepository {
  List<ExamFocusDeck?> decks = [readyDeck()];
  int _deck = 0;
  Object? getError;
  List<ExamFocusCard> all = [for (var i = 0; i < 3; i++) efCard(i)];
  bool failBookmark = false;
  final calls = <String>[];

  @override
  Future<ExamFocusDeck?> get(String bookId) async {
    calls.add('get');
    if (getError != null) throw getError!;
    final d = decks[_deck.clamp(0, decks.length - 1)];
    _deck++;
    return d;
  }

  @override
  Future<void> start(String bookId) async => calls.add('start');

  @override
  Future<void> regenerate(String bookId) async => calls.add('regenerate');

  @override
  Future<void> retryFailed(String bookId) async => calls.add('retryFailed');

  @override
  Future<void> resume(String bookId) async => calls.add('resume');

  @override
  Future<ExamFocusPage> cards(
    String bookId, {
    String? category,
    bool bookmarkedOnly = false,
    String? search,
    int cursor = 0,
    int limit = 40,
  }) async {
    calls.add(
      'cards:${category ?? '-'}:$bookmarkedOnly:${search ?? ''}:$cursor',
    );
    final matching = all
        .where((c) => category == null || c.category == category)
        .where(
          (c) => search == null || search.isEmpty || c.title.contains(search),
        )
        .toList();
    final page = matching.skip(cursor).take(limit).toList();
    final next = cursor + page.length;
    return (
      items: page,
      total: matching.length,
      next: next < matching.length ? next : null,
    );
  }

  @override
  Future<void> setBookmark(String cardId, bool bookmarked) async {
    calls.add('bookmark:$cardId:$bookmarked');
    if (failBookmark) throw const NetworkException();
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<FakeExamFocusRepository> pumpEf(
  WidgetTester tester,
  FakeExamFocusRepository repo,
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
        examFocusRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp(
        locale: const Locale('ar'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        theme: buildNiroTheme(),
        home: const ExamFocusScreen(
          bookId: 'b1',
          pollInterval: Duration(seconds: 1),
          searchDelay: Duration(milliseconds: 10),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return repo;
}

void main() {
  testWidgets('ready deck: card with highlighted numbers, swipe left = next', (
    tester,
  ) async {
    final repo = await pumpEf(tester, FakeExamFocusRepository());
    expect(find.text('Fact number 0'), findsOneWidget);
    expect(find.text('1 / 3'), findsNWidgets(2)); // card + nav
    expect(find.textContaining('HIGH YIELD'), findsOneWidget);
    // The number is its own highlighted span.
    final rich = tester
        .widgetList<RichText>(find.byType(RichText))
        .where((r) => r.text.toPlainText().contains('Irrigate'));
    final spans = (rich.first.text as TextSpan).children!.first as TextSpan;
    final highlighted = spans.children!.whereType<TextSpan>().firstWhere(
      (s) => s.style?.backgroundColor == NlColors.marker,
    );
    expect(highlighted.text, '15–30 minutes');

    await tester.fling(find.byType(PageView), const Offset(-400, 0), 1500);
    await tester.pumpAndSettle();
    expect(find.text('2 / 3'), findsNWidgets(2));
    expect(repo.calls.where((c) => c == 'start'), isEmpty);
  });

  testWidgets('first open with no deck: starts it, shows real progress, '
      'loads cards when ready', (tester) async {
    final repo = FakeExamFocusRepository()
      ..decks = [
        null,
        ExamFocusDeck(
          status: 'processing',
          units: const [
            ExamFocusUnit(
              id: 'u1',
              pageStart: 1,
              pageEnd: 10,
              status: 'complete',
              factCount: 12,
            ),
            ExamFocusUnit(
              id: 'u2',
              pageStart: 11,
              pageEnd: 20,
              status: 'processing',
            ),
          ],
        ),
        readyDeck(),
      ];
    tester.view.physicalSize =
        const Size(412, 900) * tester.view.devicePixelRatio;
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          examFocusRepositoryProvider.overrideWithValue(repo),
        ],
        child: MaterialApp(
          locale: const Locale('ar'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          theme: buildNiroTheme(),
          home: const ExamFocusScreen(
            bookId: 'b1',
            pollInterval: Duration(seconds: 1),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();
    expect(repo.calls.take(3), ['get', 'start', 'get']);
    expect(find.text('⏳ نحلل ملفك كاملًا…'), findsOneWidget);
    expect(find.text('1/2 جزء'), findsOneWidget);
    expect(find.text('12 معلومة'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('Fact number 0'), findsOneWidget);
  });

  testWidgets('category chip and search go to the server', (tester) async {
    final repo = FakeExamFocusRepository()
      ..all = [efCard(0), efCard(1), efCard(2, category: 'emergency')];
    await pumpEf(tester, repo);
    await tester.tap(find.textContaining('Emergency · 1'));
    await tester.pumpAndSettle();
    expect(repo.calls.last, 'cards:emergency:false::0');
    expect(find.text('Fact number 2'), findsOneWidget);
    expect(find.text('1 / 1'), findsNWidgets(2));

    await tester.tap(find.textContaining('الكل'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('بحث في البطاقات'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'nothing like this');
    await tester.pump(const Duration(milliseconds: 20));
    await tester.pumpAndSettle();
    expect(repo.calls.last, 'cards:-:false:nothing like this:0');
    expect(find.text('ما في بطاقات تطابق 🔎'), findsOneWidget);
  });

  testWidgets('bookmark is optimistic and rolls back when refused', (
    tester,
  ) async {
    final repo = FakeExamFocusRepository()..failBookmark = true;
    await pumpEf(tester, repo);
    await tester.tap(find.byTooltip('احفظ للمراجعة لاحقًا'));
    await tester.pump();
    expect(repo.calls, contains('bookmark:card0:true'));
    await tester.pumpAndSettle();
    // Refused → back to not saved.
    expect(find.byTooltip('احفظ للمراجعة لاحقًا'), findsOneWidget);
  });

  testWidgets('pages load ahead of the student (40 at a time)', (tester) async {
    final repo = FakeExamFocusRepository()
      ..decks = [readyDeck(total: 90)]
      ..all = [for (var i = 0; i < 90; i++) efCard(i)];
    await pumpEf(tester, repo);
    expect(repo.calls.where((c) => c.startsWith('cards:')), [
      'cards:-:false::0',
    ]);
    for (var i = 0; i < 36; i++) {
      await tester.tap(find.text('التالي'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
    }
    await tester.pumpAndSettle();
    expect(repo.calls, contains('cards:-:false::40'));
    expect(find.text('37 / 90'), findsNWidgets(2));
  });

  testWidgets('owner regenerates only after confirming', (tester) async {
    final repo = await pumpEf(tester, FakeExamFocusRepository());
    await tester.tap(find.byTooltip('إعادة التوليد'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('إلغاء'));
    await tester.pumpAndSettle();
    expect(repo.calls, isNot(contains('regenerate')));
    await tester.tap(find.byTooltip('إعادة التوليد'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(NlButton, 'إعادة التوليد').last);
    await tester.pumpAndSettle();
    expect(repo.calls, contains('regenerate'));
  });

  testWidgets('partly failed: failed page ranges with retry', (tester) async {
    final repo = await pumpEf(
      tester,
      FakeExamFocusRepository()..decks = [readyDeck(status: 'partial_failed')],
    );
    expect(find.text('⚠️ تعذر تحليل ص ${pageRange(11, 20)}.'), findsOneWidget);
    await tester.tap(find.text('أعد المحاولة'));
    await tester.pumpAndSettle();
    expect(repo.calls, contains('retryFailed'));
  });

  testWidgets('shared file without a deck: the server\'s message, no start', (
    tester,
  ) async {
    final repo = await pumpEf(
      tester,
      FakeExamFocusRepository()
        ..getError = const RejectedException(
          'لم يُنشئ صاحب الملف بطاقات Exam Focus لهذا الملف بعد.',
          code: 'PRECONDITION_FAILED',
        ),
    );
    expect(find.text('Exam Focus غير متاح'), findsOneWidget);
    expect(
      find.text('لم يُنشئ صاحب الملف بطاقات Exam Focus لهذا الملف بعد.'),
      findsOneWidget,
    );
    expect(repo.calls, isNot(contains('start')));
  });

  testWidgets('shared deck: no regenerate button', (tester) async {
    await pumpEf(
      tester,
      FakeExamFocusRepository()..decks = [readyDeck(owner: false)],
    );
    expect(find.byTooltip('إعادة التوليد'), findsNothing);
  });
}
