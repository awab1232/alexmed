import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/api/text_stream.dart';
import 'package:nirolearn/core/storage/local_store.dart';
import 'package:nirolearn/features/assistant/data/assistant_repository.dart';
import 'package:nirolearn/features/assistant/data/photo_prep.dart';
import 'package:nirolearn/features/assistant/domain/niro_turn.dart';
import 'package:nirolearn/features/assistant/presentation/assistant_screen.dart';

import '../../helpers/screen_harness.dart';

/// Streams replies from a controller per call; records what was sent.
class FakeAssistantRepository extends AssistantRepository {
  FakeAssistantRepository({this.saved = const []})
    : super(dio: Dio(), store: MemoryLocalStore());

  List<NiroTurn> saved;
  bool explained = false;
  final sent = <Map<String, Object?>>[];
  StreamController<String>? reply;
  Object? failWith;

  @override
  Stream<String> ask({
    required String message,
    String? imageDataUrl,
    required List<Map<String, Object?>> history,
    CancelToken? cancelToken,
  }) {
    sent.add({'message': message, 'image': imageDataUrl, 'history': history});
    if (failWith != null) return Stream.error(failWith!);
    reply = StreamController<String>();
    cancelToken?.whenCancel.then((_) => reply?.close());
    return reply!.stream;
  }

  @override
  Future<List<NiroTurn>> loadHistory() async => saved;

  @override
  Future<void> saveHistory(List<NiroTurn> turns) async => saved = turns;

  @override
  Future<bool> cameraExplained() async => explained;

  @override
  Future<void> setCameraExplained() async => explained = true;
}

final photo = PreparedPhoto(
  jpeg: Uint8List.fromList([1, 2, 3]),
  thumb: base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
);

Future<FakeAssistantRepository> pumpNiro(
  WidgetTester tester, {
  FakeAssistantRepository? repo,
  PhotoPicker? picker,
}) async {
  final r = repo ?? FakeAssistantRepository();
  await pumpOne(
    tester,
    const AssistantScreen(),
    overrides: [
      assistantRepositoryProvider.overrideWithValue(r),
      photoPickerProvider.overrideWithValue(picker ?? (_) async => photo),
    ],
  );
  await pumpFrames(tester);
  return r;
}

void main() {
  group('buildHistory (the web send())', () {
    test('text only; photo-only turn from storage gets placeholder text', () {
      final history = buildHistory([
        const NiroTurn(role: 'user', content: 'hi'),
        const NiroTurn(role: 'assistant', content: 'hello'),
        NiroTurn(role: 'user', content: '', thumb: Uint8List(1)),
        const NiroTurn(role: 'assistant', content: ''),
      ], newPhoto: false);
      expect(history, [
        {'role': 'user', 'content': 'hi'},
        {'role': 'assistant', 'content': 'hello'},
        {'role': 'user', 'content': '[أرسلت صورة]'},
      ]);
    });

    test(
      're-sends only the latest in-memory photo, unless a new one is attached',
      () {
        final turns = [
          NiroTurn(role: 'user', content: 'q1', image: Uint8List.fromList([1])),
          const NiroTurn(role: 'assistant', content: 'a1'),
          NiroTurn(role: 'user', content: 'q2', image: Uint8List.fromList([2])),
          const NiroTurn(role: 'assistant', content: 'a2'),
        ];
        final history = buildHistory(turns, newPhoto: false);
        expect(history[0].containsKey('image'), isFalse);
        expect(history[2]['image'], 'data:image/jpeg;base64,Ag==');
        expect(
          buildHistory(
            turns,
            newPhoto: true,
          ).any((t) => t.containsKey('image')),
          isFalse,
        );
      },
    );

    test('keeps the last 16 turns and caps content at 8000 chars', () {
      final turns = [
        for (var i = 0; i < 30; i++)
          NiroTurn(role: i.isEven ? 'user' : 'assistant', content: 'x' * 9000),
      ];
      final history = buildHistory(turns, newPhoto: false);
      expect(history, hasLength(16));
      expect((history.first['content']! as String).length, 8000);
    });

    test('saved form never contains the full photo', () {
      final json = NiroTurn(
        role: 'user',
        content: 'q',
        image: Uint8List.fromList([9, 9]),
        thumb: Uint8List.fromList([1]),
      ).toJson();
      expect(json.keys, containsAll(['role', 'content', 'thumb']));
      expect(json.containsKey('image'), isFalse);
    });
  });

  group('streamTextAnswer', () {
    Dio dioAnswering(int status, String body) {
      final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'));
      dio.httpClientAdapter = _StaticAdapter(status, body);
      return dio;
    }

    test('yields the text accumulated so far', () async {
      final got = await streamTextAnswer(
        dioAnswering(200, 'مرحبا بك'),
        '/api/assistant/chat',
        {},
      ).toList();
      expect(got.last, 'مرحبا بك');
    });

    test(
      'server errors carry the Arabic message; plan limits their details',
      () async {
        await expectLater(
          streamTextAnswer(
            dioAnswering(
              429,
              jsonEncode({'error': 'أسئلة كثيرة خلال وقت قصير'}),
            ),
            '/x',
            {},
          ).toList(),
          throwsA(
            isA<RateLimitedException>().having(
              (e) => e.message,
              'message',
              'أسئلة كثيرة خلال وقت قصير',
            ),
          ),
        );
        await expectLater(
          streamTextAnswer(
            dioAnswering(
              402,
              jsonEncode({
                'error': 'استخدمت كل رسائل اليوم.',
                'code': 'PLAN_LIMIT_REACHED',
                'details': {'code': 'PLAN_LIMIT_REACHED', 'planName': 'Free'},
              }),
            ),
            '/x',
            {},
          ).toList(),
          throwsA(isA<PlanLimitException>()),
        );
      },
    );
  });

  group('screen', () {
    testWidgets('welcome → starter → streamed answer rendered, saved, copy', (
      tester,
    ) async {
      final repo = await pumpNiro(tester);
      expect(find.text('اختبرني 📝'), findsOneWidget);
      await tester.tap(find.text('اختبرني 📝'));
      await pumpFrames(tester, 2);
      expect(repo.sent.single['message'], 'اختبرني 📝');
      expect(find.text('Niro يكتب…'), findsOneWidget);
      repo.reply!.add('**سؤال 1:** ما هو');
      await pumpFrames(tester, 2);
      repo.reply!.add('**سؤال 1:** ما هو دور الكلية؟');
      await repo.reply!.close();
      await pumpFrames(tester, 3);
      // Markdown bold rendered as a span, not asterisks.
      expect(find.textContaining('**'), findsNothing);
      expect(
        find.textContaining('ما هو دور الكلية؟', findRichText: true),
        findsOneWidget,
      );
      expect(repo.saved.map((t) => t.role), ['user', 'assistant']);
      expect(find.text('نسخ'), findsOneWidget);
    });

    testWidgets('stop keeps what was written', (tester) async {
      final repo = await pumpNiro(tester);
      await tester.enterText(find.byType(TextField), 'اشرح الـ ECG');
      await tester.pump();
      await tester.tap(find.byTooltip('إرسال'));
      await pumpFrames(tester, 2);
      repo.reply!.add('الـ ECG هو');
      await pumpFrames(tester, 2);
      await tester.tap(find.byTooltip('إيقاف'));
      await pumpFrames(tester, 2);
      expect(
        find.textContaining('الـ ECG هو', findRichText: true),
        findsOneWidget,
      );
      expect(find.byTooltip('إرسال'), findsOneWidget);
    });

    testWidgets('failure gives the question back; plan limit is explained', (
      tester,
    ) async {
      final repo = FakeAssistantRepository()
        ..failWith = PlanLimitException(
          'استخدمت كل رسائل Niro لليوم.',
          PlanLimitDetails.fromJson({'code': 'PLAN_LIMIT_REACHED'}),
        );
      await pumpNiro(tester, repo: repo);
      await tester.enterText(find.byType(TextField), 'سؤال');
      await tester.pump();
      await tester.tap(find.byTooltip('إرسال'));
      await pumpFrames(tester, 3);
      expect(find.text('وصلت للحد اليومي'), findsOneWidget);
      expect(find.text('استخدمت كل رسائل Niro لليوم.'), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'سؤال',
      );
      // Nothing that sells a plan.
      expect(find.textContaining('احصل على'), findsNothing);
    });

    testWidgets('restores saved history; new chat clears it', (tester) async {
      final repo = FakeAssistantRepository(
        saved: const [
          NiroTurn(role: 'user', content: 'سؤال قديم'),
          NiroTurn(role: 'assistant', content: 'جواب قديم'),
        ],
      );
      await pumpNiro(tester, repo: repo);
      expect(find.text('سؤال قديم'), findsOneWidget);
      await tester.tap(find.text('جديدة'));
      await pumpFrames(tester);
      expect(find.text('سؤال قديم'), findsNothing);
      expect(repo.saved, isEmpty);
    });

    testWidgets('camera: explained once, then the photo is attached and sent', (
      tester,
    ) async {
      final repo = await pumpNiro(tester);
      await tester.tap(find.byTooltip('تصوير بالكاميرا'));
      await pumpFrames(tester);
      expect(find.text('نحتاج الكاميرا لتصوير سؤالك 📷'), findsOneWidget);
      await tester.tap(find.text('متابعة'));
      await pumpFrames(tester);
      expect(repo.explained, isTrue);
      expect(find.bySemanticsLabel('الصورة المرفقة'), findsOneWidget);
      await tester.tap(find.byTooltip('إرسال'));
      await pumpFrames(tester, 2);
      expect(repo.sent.single['image'], 'data:image/jpeg;base64,AQID');
      expect(repo.sent.single['message'], '');
      expect(find.text('Niro يقرأ الصورة… 🔍'), findsOneWidget);
    });

    testWidgets('denied camera → explained, gallery still offered', (
      tester,
    ) async {
      await pumpNiro(
        tester,
        repo: FakeAssistantRepository()..explained = true,
        picker: (_) async => throw const PhotoException(PhotoFailure.denied),
      );
      await tester.tap(find.byTooltip('تصوير بالكاميرا'));
      await pumpFrames(tester);
      expect(find.text('الكاميرا غير مسموحة'), findsOneWidget);
      expect(find.textContaining('اختيار صورة من المعرض'), findsWidgets);
    });

    testWidgets('narrow phone + large text: no overflow', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await pumpOne(
        tester,
        const AssistantScreen(),
        size: const Size(360, 640),
        overrides: [
          assistantRepositoryProvider.overrideWithValue(
            FakeAssistantRepository(),
          ),
        ],
      );
      await pumpFrames(tester);
      expect(tester.takeException(), isNull);
    });
  });
}

class _StaticAdapter implements HttpClientAdapter {
  _StaticAdapter(this.status, this.body);
  final int status;
  final String body;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString(body, status);

  @override
  void close({bool force = false}) {}
}
