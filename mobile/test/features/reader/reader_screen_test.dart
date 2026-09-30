import 'dart:async';

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/reader/data/pdf_range_source.dart';
import 'package:nirolearn/features/reader/data/reader_repository.dart';
import 'package:nirolearn/features/reader/domain/pdf_marks.dart';
import 'package:nirolearn/features/reader/presentation/ai_sheets.dart';
import 'package:nirolearn/features/reader/presentation/reader_screen.dart';
import 'package:nirolearn/features/reader/presentation/reader_view.dart';
import 'package:nirolearn/l10n/app_localizations.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/bytes_range_adapter.dart';
import '../../helpers/fake_http.dart';
import 'reader_data_test.dart' show apiDio;

const _pageSize = Size(300, 420);

/// Lays pages out as plain boxes with the real marks layer on top.
class FakeReaderView extends StatefulWidget {
  const FakeReaderView({super.key, required this.config, required this.pages});

  final ReaderViewConfig config;
  final int pages;

  // ignore: library_private_types_in_public_api
  static _FakeReaderViewState? last;

  @override
  State<FakeReaderView> createState() => _FakeReaderViewState();
}

class _FakeReaderViewState extends State<FakeReaderView>
    implements ReaderViewController {
  final gone = <int>[];
  bool cleared = false;

  @override
  void initState() {
    super.initState();
    FakeReaderView.last = this;
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.config.onReady(this, widget.pages),
    );
  }

  void select(ReaderSelection? s) => widget.config.onSelection(s);

  @override
  Future<void> goToPage(int page) async {
    gone.add(page);
    widget.config.onPageChanged(page);
  }

  @override
  Future<void> clearSelection() async => cleared = true;

  @override
  Future<List<SearchMatch>> search(String query) async => [
    if (query == 'loop') (page: 7, snippet: '…the loop of Henle…'),
  ];

  @override
  Widget build(BuildContext context) => ListView(
    // Like the real viewer: no panning while drawing / erasing.
    physics: widget.config.gesturesEnabled
        ? null
        : const NeverScrollableScrollPhysics(),
    children: [
      for (var p = 1; p <= widget.pages; p++)
        Padding(
          padding: const EdgeInsets.all(8),
          // Centred so the page keeps its own size (a ListView stretches).
          child: Center(
            child: SizedBox.fromSize(
              key: ValueKey('page-$p'),
              size: _pageSize,
              child: Stack(
                children: [
                  const Positioned.fill(child: ColoredBox(color: Colors.white)),
                  Positioned.fill(
                    child: widget.config.pageOverlay(p, _pageSize),
                  ),
                ],
              ),
            ),
          ),
        ),
    ],
  );
}

class FakeReaderRepository implements ReaderRepository {
  FakeReaderRepository({this.hasFile = true, this.fail = false, Uint8List? pdf})
    : adapter = BytesRangeAdapter(pdf ?? buildTestPdf(3));

  bool hasFile;
  bool fail;
  final BytesRangeAdapter adapter;
  final saved = <int, PageMarks>{};
  Map<int, PageMarks> stored = {};
  final calls = <String>[];

  @override
  Future<ReaderBook?> book(String bookId) async {
    calls.add('book');
    if (fail) throw const NetworkException();
    return hasFile
        ? const ReaderBook(
            id: 'b1',
            fileName: 'Renal_Physiology.pdf',
            fileKey: 'books/u1/renal.pdf',
            pageCount: 3,
          )
        : null;
  }

  @override
  PdfRangeSource source(ReaderBook book) =>
      PdfRangeSource(dio: apiDio(adapter), fileKey: book.fileKey);

  @override
  Future<Map<int, PageMarks>> marks(String bookId) async => stored;

  @override
  Future<void> saveMarks(String bookId, int page, PageMarks marks) async {
    calls.add('save:$page');
    saved[page] = marks;
  }

  @override
  Stream<String> askSelection({
    required String bookId,
    required int pageNumber,
    required String selectedText,
    required AskAction action,
    String? question,
    String? fileName,
    List<ChatTurn> history = const [],
    CancelToken? cancelToken,
  }) async* {
    calls.add('ask:$pageNumber:${action.name}:$selectedText');
    yield 'The loop';
    yield 'The loop of Henle concentrates urine.';
  }

  List<ChatTurn> chat = const [
    ChatTurn(role: 'user', content: 'What is GFR?'),
    ChatTurn(
      role: 'assistant',
      content: 'Glomerular filtration rate.',
      citedPages: [4, 4, 9],
    ),
  ];

  @override
  Future<String> chatSession(String bookId) async => 'chat-1';

  @override
  Future<List<ChatTurn>> chatMessages(String sessionId) async => chat;

  @override
  Stream<String> chatAsk({
    required String sessionId,
    required String question,
    CancelToken? cancelToken,
  }) async* {
    calls.add('chat:$question');
    yield 'Filtration';
    yield 'Filtration happens in the glomerulus.';
    chat = [
      ...chat,
      ChatTurn(role: 'user', content: question),
      const ChatTurn(
        role: 'assistant',
        content: 'Filtration happens in the glomerulus.',
        citedPages: [2],
      ),
    ];
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<FakeReaderRepository> pumpReader(
  WidgetTester tester, {
  FakeReaderRepository? repo,
  int? initialPage,
  int pages = 12,
}) async {
  tester.view.physicalSize =
      const Size(412, 900) * tester.view.devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  final r = repo ?? FakeReaderRepository();
  await tester.pumpWidget(
    ProviderScope(
      retry: noAutomaticRetry,
      overrides: [
        envProvider.overrideWithValue(testEnv),
        sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
        readerRepositoryProvider.overrideWithValue(r),
        readerViewBuilderProvider.overrideWithValue(
          (config) => FakeReaderView(config: config, pages: pages),
        ),
      ],
      child: MaterialApp(
        locale: const Locale('ar'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        theme: buildNiroTheme(),
        home: ReaderScreen(bookId: 'b1', initialPage: initialPage),
      ),
    ),
  );
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 20));
  }
  return r;
}

void main() {
  testWidgets('opens at the source page; indicator; go to page', (
    tester,
  ) async {
    final repo = await pumpReader(tester, initialPage: 7);
    expect(find.text(isolate('Renal Physiology')), findsOneWidget);
    expect(find.text(isolateLtr('7 / 12')), findsOneWidget);
    // Only the size probe so far — the PDF is read by range as needed.
    expect(repo.adapter.ranges, ['0-0']);

    await tester.tap(find.text(isolateLtr('7 / 12')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '99');
    await tester.pump();
    expect(find.text('من 1 إلى 12'), findsWidgets); // out of range
    await tester.enterText(find.byType(TextField), '3');
    await tester.pump();
    await tester.tap(find.text('انتقال'));
    await tester.pumpAndSettle();
    expect(FakeReaderView.last!.gone, [3]);
    expect(find.text(isolateLtr('3 / 12')), findsOneWidget);
  });

  testWidgets('pen stroke is saved for that page, the web\'s shape', (
    tester,
  ) async {
    final repo = await pumpReader(tester);
    await tester.tap(find.byTooltip('قلم'));
    await tester.pump();
    final page = find.byKey(const ValueKey('page-1'));
    final origin = tester.getTopLeft(page);
    await tester.dragFrom(origin + const Offset(30, 60), const Offset(150, 40));
    await tester.pump();
    expect(find.text('جاري الحفظ…'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 800));
    await tester.pump();
    final marks = repo.saved[1]!;
    expect(marks.strokes, hasLength(1));
    final s = marks.strokes.single;
    expect(s.color, penColors.first.value);
    expect(s.width, penWidth);
    // Page-width units: x = 30/300 at the start.
    expect(s.points.first.$1, closeTo(0.1, 0.02));
    expect(find.text('محفوظ'), findsOneWidget);
  });

  testWidgets('eraser removes a saved stroke and highlight under it', (
    tester,
  ) async {
    final repo = FakeReaderRepository()
      ..stored = {
        1: const PageMarks(
          strokes: [
            Stroke(
              id: 's1',
              color: '#e11d48',
              width: penWidth,
              points: [(0.1, 0.2), (0.6, 0.2)],
            ),
          ],
          highlights: [
            PdfHighlight(
              id: 'h1',
              color: '#fde68a',
              rects: [MarkRect(x: 0.1, y: 0.5, width: 0.5, height: 0.05)],
            ),
          ],
        ),
      };
    await pumpReader(tester, repo: repo);
    await tester.tap(find.byTooltip('ممحاة'));
    await tester.pump();
    final origin = tester.getTopLeft(find.byKey(const ValueKey('page-1')));
    // Across the stroke (y = 0.2 × 300 = 60) and the highlight (y ≈ 157),
    // in small steps like a finger.
    final gesture = await tester.startGesture(origin + const Offset(90, 50));
    for (var y = 0; y < 120; y += 5) {
      await gesture.moveBy(const Offset(0, 5));
    }
    await gesture.up();
    await tester.pump(const Duration(milliseconds: 800));
    await tester.pump();
    expect(repo.saved[1]!.isEmpty, isTrue);
  });

  testWidgets('selection → «ظلّل» saves a highlight; «اسأل Niro» streams', (
    tester,
  ) async {
    final repo = await pumpReader(tester);
    FakeReaderView.last!.select(
      const ReaderSelection(
        pageNumber: 2,
        text: 'loop of Henle',
        rects: [MarkRect(x: 0.1, y: 0.2, width: 0.3, height: 0.02)],
      ),
    );
    await tester.pump();
    await tester.tap(find.byTooltip('تظليل'));
    await tester.pump();
    await tester.tap(find.widgetWithText(NlButton, 'ظلّل'));
    await tester.pump(const Duration(milliseconds: 800));
    await tester.pump();
    final h = repo.saved[2]!.highlights.single;
    expect(h.color, highlightColors.first.value);
    expect(h.rects.single.width, 0.3);
    expect(FakeReaderView.last!.cleared, isTrue);

    FakeReaderView.last!.select(
      const ReaderSelection(pageNumber: 2, text: 'loop of Henle', rects: []),
    );
    await tester.pump();
    await tester.tap(find.widgetWithText(NlButton, 'اسأل Niro'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('اشرح ببساطة'));
    await tester.pumpAndSettle();
    expect(repo.calls, contains('ask:2:explain:loop of Henle'));
    expect(find.text('The loop of Henle concentrates urine.'), findsOneWidget);
  });

  testWidgets('search results open the page', (tester) async {
    await pumpReader(tester);
    await tester.tap(find.byTooltip('بحث في الملف'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'loop');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    await tester.tap(find.text('صفحة 7'));
    await tester.pumpAndSettle();
    expect(FakeReaderView.last!.gone, [7]);
  });

  testWidgets('no file → message', (tester) async {
    await pumpReader(tester, repo: FakeReaderRepository(hasFile: false));
    expect(find.text('تعذر العثور على هذا الملف'), findsOneWidget);
  });

  testWidgets('failure → retry', (tester) async {
    final failing = FakeReaderRepository(fail: true);
    await pumpReader(tester, repo: failing);
    expect(find.textContaining('تعذّر الاتصال'), findsOneWidget);
    failing.fail = false;
    await tester.tap(find.text('أعد المحاولة'));
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 20));
    }
    expect(find.text(isolateLtr('1 / 12')), findsOneWidget);
  });

  testWidgets('leaving flushes marks not yet saved', (tester) async {
    final repo = await pumpReader(tester);
    await tester.tap(find.byTooltip('قلم'));
    await tester.pump();
    final origin = tester.getTopLeft(find.byKey(const ValueKey('page-1')));
    await tester.dragFrom(origin + const Offset(30, 60), const Offset(100, 0));
    await tester.pump(const Duration(milliseconds: 100)); // before the delay
    await tester.pumpWidget(const SizedBox()); // screen disposed
    await tester.pump();
    unawaited(Future<void>.value());
    expect(repo.calls, contains('save:1'));
  });

  testWidgets('book chat: saved conversation, streamed answer, page chips', (
    tester,
  ) async {
    final repo = FakeReaderRepository();
    tester.view.physicalSize =
        const Size(412, 900) * tester.view.devicePixelRatio;
    addTearDown(tester.view.resetPhysicalSize);
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, _) => Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () => showBookChatSheet(
                  context,
                  bookId: 'b1',
                  initialQuestion: 'Where does filtration happen?',
                ),
                child: const Text('OPEN'),
              ),
            ),
          ),
        ),
        GoRoute(
          path: '/books/:id/read',
          builder: (_, state) =>
              Text('READ ${state.uri.queryParameters['page']}'),
        ),
      ],
    );
    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          readerRepositoryProvider.overrideWithValue(repo),
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
    await tester.tap(find.text('OPEN'));
    await tester.pumpAndSettle();
    expect(find.text('Glomerular filtration rate.'), findsOneWidget);
    expect(repo.calls, contains('chat:Where does filtration happen?'));
    expect(find.text('Filtration happens in the glomerulus.'), findsOneWidget);
    // Duplicate cited pages collapse to one chip each.
    expect(find.text('صفحة 4'), findsOneWidget);
    await tester.tap(find.text('صفحة 9'));
    await tester.pumpAndSettle();
    expect(find.text('READ 9'), findsOneWidget);
  });
}
