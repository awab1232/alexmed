import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/ui/secure_screen.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/core/upload/pdf_upload.dart';
import 'package:nirolearn/features/doctor_sets/data/doctor_set_models.dart';
import 'package:nirolearn/features/doctor_sets/data/doctor_sets_repository.dart';
import 'package:nirolearn/features/doctor_sets/presentation/doctor_screens.dart';
import 'package:nirolearn/features/doctor_sets/presentation/doctor_set_screen.dart';
import 'package:nirolearn/features/doctor_sets/presentation/protected_set_screen.dart';
import 'package:nirolearn/features/doctor_sets/presentation/question_sets_screen.dart';
import 'package:nirolearn/features/question_files/data/question_file_models.dart';
import 'package:nirolearn/features/question_files/presentation/question_deck_view.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/screen_harness.dart';

class FakeDoctorSetsRepository implements DoctorSetsRepository {
  final calls = <String>[];
  Object? redeemError;
  bool redeemAlready = false;
  List<StudentSet> mineList = [];
  List<StudentSet> catalogList = [];
  Object? openResult;
  DoctorApplicationState application = const DoctorApplicationState(
    approved: false,
  );
  DoctorStats doctorStats = const DoctorStats();
  List<DoctorSet> setList = [];
  List<DoctorSet> setAnswers = [];
  SetPreview setPreview = const SetPreview(
    questions: [],
    checkImage: {},
    needsReview: [],
  );
  List<AccessCode> codeList = [];
  List<SetStudent> studentList = [];

  @override
  Future<({bool already, String setId})> redeem(String code) async {
    calls.add('redeem:$code');
    if (redeemError != null) throw redeemError!;
    return (already: redeemAlready, setId: 's1');
  }

  @override
  Future<List<StudentSet>> mine() async => mineList;

  @override
  Future<List<StudentSet>> catalog() async => catalogList;

  @override
  Future<ProtectedSet> open(String setId) async {
    calls.add('open:$setId');
    final r = openResult;
    if (r is ProtectedSet) return r;
    throw r ?? const NotFoundException();
  }

  @override
  Future<DoctorApplicationState> status() async => application;

  @override
  Future<void> apply({
    required String fullName,
    required String university,
    required String faculty,
    required String department,
    String? universityEmail,
    String? note,
  }) async {
    calls.add('apply:$fullName:$universityEmail');
    application = const DoctorApplicationState(
      approved: false,
      profile: DoctorProfile(status: 'pending', fullName: 'د. سارة'),
    );
  }

  @override
  Future<DoctorStats> stats() async => doctorStats;

  @override
  Future<List<DoctorSet>> sets() async {
    calls.add('sets');
    return setList;
  }

  @override
  Future<DoctorSet> set(String setId) async {
    calls.add('set');
    return setAnswers.length > 1 ? setAnswers.removeAt(0) : setAnswers.single;
  }

  @override
  Future<SetPreview> preview(String setId) async => setPreview;

  @override
  Future<String> create({
    required PickedPdf pdf,
    required SetSettings settings,
    void Function(double progress)? onProgress,
    CancelToken? cancelToken,
  }) async => 's9';

  @override
  Future<void> publish(String setId) async => calls.add('publish');
  @override
  Future<void> retryProcessing(String setId) async => calls.add('retry');
  @override
  Future<void> disable(String setId) async => calls.add('disable');
  @override
  Future<void> enable(String setId) async => calls.add('enable');
  @override
  Future<void> archive(String setId) async => calls.add('archive');
  @override
  Future<void> update(String setId, SetSettings settings) async =>
      calls.add('update:${settings.title}');

  @override
  Future<({String batchId, List<String> codes})> generateCodes(
    String setId,
    int count,
  ) async {
    calls.add('generate:$count');
    return (
      batchId: 'abcdef123456',
      codes: ['NL-AAAA-BBBB-CCCC', 'NL-DDDD-EEEE-FFFF'],
    );
  }

  @override
  Future<List<AccessCode>> codes(
    String setId, {
    CodeStatus? status,
    String? search,
  }) async {
    calls.add('codes:${status?.name}:${search ?? ''}');
    return codeList;
  }

  @override
  Future<void> revokeCode(String codeId) async =>
      calls.add('revokeCode:$codeId');

  @override
  Future<List<SetStudent>> students(String setId) async => studentList;

  @override
  Future<void> revokeStudent(String entitlementId) async =>
      calls.add('revokeStudent:$entitlementId');

  @override
  Future<List<AuditEvent>> audit(String setId) async => const [];

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

DoctorSet doctorSet({
  SetStatus status = SetStatus.published,
  String? bookStatus = 'complete',
  bool processingDone = true,
  bool windowOpen = true,
  DateTime? endsAt,
}) => DoctorSet(
  id: 's1',
  title: 'Anatomy Midterm',
  status: status,
  bookStatus: bookStatus,
  processingDone: processingDone,
  windowOpen: windowOpen,
  questionCount: 40,
  extractedQuestions: 40,
  codesTotal: 50,
  codesClaimed: 12,
  activeStudents: 12,
  settings: SetSettings(title: 'Anatomy Midterm', endsAt: endsAt),
);

const q = QuestionItem(
  id: 'q1',
  questionText: 'Which nerve supplies the deltoid?',
  options: ['Radial', 'Axillary'],
  extractedAnswerIndex: 1,
);

Future<FakeDoctorSetsRepository> pump(
  WidgetTester tester,
  Widget screen,
  FakeDoctorSetsRepository repo, {
  List<Object> extra = const [],
}) async {
  await pumpOne(
    tester,
    screen,
    overrides: [doctorSetsRepositoryProvider.overrideWithValue(repo)],
  );
  await pumpFrames(tester);
  return repo;
}

void main() {
  group('rules', () {
    test('setStatusLabel follows the web order', () {
      final now = DateTime.utc(2026, 9, 30);
      String label(DoctorSet s) => setStatusLabel(s, now: now).label;
      expect(label(doctorSet(status: SetStatus.archived)), 'مؤرشفة');
      expect(label(doctorSet(status: SetStatus.disabled)), 'معطّلة');
      expect(
        label(doctorSet(status: SetStatus.draft, bookStatus: 'failed')),
        'فشلت المعالجة',
      );
      expect(
        label(doctorSet(status: SetStatus.draft, processingDone: false)),
        'جاري المعالجة',
      );
      expect(label(doctorSet(status: SetStatus.draft)), 'جاهزة للنشر');
      expect(
        label(doctorSet(windowOpen: false, endsAt: DateTime.utc(2026, 9, 1))),
        'منتهية',
      );
      expect(label(doctorSet(windowOpen: false)), 'لم تبدأ بعد');
      expect(label(doctorSet()), 'منشورة');
    });

    test('settings payload: empty text → null, dates UTC, visibility', () {
      final payload = SetSettings(
        title: '  Anatomy ',
        subjectLabel: ' ',
        listed: true,
        startsAt: DateTime.utc(2026, 10, 1, 8),
      ).toPayload();
      expect(payload['title'], 'Anatomy');
      expect(payload['subjectLabel'], isNull);
      expect(payload['visibility'], 'listed');
      expect(payload['startsAt'], DateTime.utc(2026, 10, 1, 8));
      expect(payload['endsAt'], isNull);
    });

    test('codes CSV is the web format', () {
      expect(codesCsv(['A', 'B']), 'code\nA\nB\n');
    });

    test('preview keeps image checks; needs-review parsed with reasons', () {
      final preview = SetPreview.fromJson({
        'questions': [
          {'id': 'q1', 'questionText': 'x', 'reviewStatus': 'check_image'},
          {'id': 'q2', 'questionText': 'y', 'reviewStatus': null},
        ],
        'needsReview': [
          {
            'id': 'n1',
            'orderIndex': 3,
            'questionText': 'z',
            'sourcePage': 4,
            'reasons': ['single_option'],
          },
        ],
        'coverage': {'done': true},
      });
      expect(preview.checkImage, {'q1'});
      expect(preview.needsReview.single.reasons, ['single_option']);
    });
  });

  group('student', () {
    testWidgets('redeem → opens the set; server message on failure', (
      tester,
    ) async {
      final repo = FakeDoctorSetsRepository()
        ..redeemError = const RejectedException(
          'هذا الكود غير صالح أو غير متاح.',
          code: 'BAD_REQUEST',
        );
      await pump(tester, const QuestionSetsScreen(), repo);
      final add = find.widgetWithText(NlButton, 'أضف المجموعة');
      expect(tester.widget<NlButton>(add).onPressed, isNull);
      await tester.enterText(find.byType(TextField), 'NL-ABCD-EFGH-JKLM');
      await tester.pump();
      await tester.tap(add);
      await pumpFrames(tester);
      expect(find.text('هذا الكود غير صالح أو غير متاح.'), findsOneWidget);

      repo.redeemError = null;
      await tester.tap(add);
      await pumpFrames(tester);
      expect(repo.calls.last, 'redeem:NL-ABCD-EFGH-JKLM');
      expect(find.text('ROUTE /question-sets/s1'), findsOneWidget);
    });

    testWidgets('my sets: only available ones open; catalog hides mine', (
      tester,
    ) async {
      final repo = FakeDoctorSetsRepository()
        ..mineList = const [
          StudentSet(
            id: 'a',
            title: 'Open set',
            availability: SetAvailability.available,
            questionCount: 10,
          ),
          StudentSet(
            id: 'b',
            title: 'Closed set',
            availability: SetAvailability.unavailable,
          ),
        ]
        ..catalogList = const [
          StudentSet(
            id: 'a',
            title: 'Open set',
            availability: SetAvailability.available,
            inMyAccount: true,
          ),
          StudentSet(
            id: 'c',
            title: 'Listed set',
            availability: SetAvailability.available,
          ),
        ];
      await pump(tester, const QuestionSetsScreen(), repo);
      expect(find.text('غير متاحة حاليًا'), findsOneWidget);
      expect(find.text('Listed set'), findsOneWidget);
      expect(find.text('Open set'), findsOneWidget);
      await tester.tap(find.text('Closed set'));
      await pumpFrames(tester);
      expect(find.textContaining('ROUTE'), findsNothing);
      await tester.tap(find.text('Open set'));
      await pumpFrames(tester);
      expect(find.text('ROUTE /question-sets/a'), findsOneWidget);
    });

    testWidgets('protected set: watermark, secure, uncached images', (
      tester,
    ) async {
      final repo = FakeDoctorSetsRepository()
        ..openResult = const ProtectedSet(
          title: 'Anatomy Midterm',
          doctorName: 'د. أحمد',
          watermark: 'NiroLearn · @sara · 1A2B',
          questions: [q],
        );
      await pump(tester, const ProtectedSetScreen(setId: 's1'), repo);
      expect(find.byKey(const ValueKey('question-watermark')), findsOneWidget);
      expect(SecureScreen.holders, 1);
      final deck = tester.widget<QuestionDeckView>(
        find.byType(QuestionDeckView),
      );
      expect(deck.imagesCached, isFalse);
      expect(deck.watermark, 'NiroLearn · @sara · 1A2B');

      // Access re-checked when the app comes back; revoked → closed.
      repo.openResult = const NotFoundException();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await pumpFrames(tester);
      expect(find.text('هذه المجموعة غير متاحة حاليًا'), findsOneWidget);
      expect(find.byType(QuestionDeckView), findsNothing);

      await tester.pumpWidget(const SizedBox());
      expect(SecureScreen.holders, 0);
    });
  });

  group('doctor', () {
    testWidgets('application: form → pending state', (tester) async {
      final repo = FakeDoctorSetsRepository();
      final account = FakeAccountRepository()..doctorSets = true;
      await pumpOne(
        tester,
        const DoctorApplyScreen(),
        account: account,
        overrides: [doctorSetsRepositoryProvider.overrideWithValue(repo)],
      );
      await pumpFrames(tester);
      final send = find.widgetWithText(NlButton, 'أرسل الطلب');
      expect(tester.widget<NlButton>(send).onPressed, isNull);
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'د. سارة');
      await tester.enterText(fields.at(1), 'الجامعة الأردنية');
      await tester.enterText(fields.at(2), 'الطب');
      await tester.enterText(fields.at(3), 'التشريح');
      await tester.pump();
      await tester.tap(send);
      await pumpFrames(tester);
      expect(repo.calls, contains('apply:د. سارة:'));
      expect(find.text('قيد المراجعة'), findsOneWidget);
    });

    testWidgets(
      'dashboard: numbers, sets with status, polls while processing',
      (tester) async {
        final repo = FakeDoctorSetsRepository()
          ..doctorStats = const DoctorStats(totalSets: 2, published: 1)
          ..setList = [
            doctorSet(),
            doctorSet(status: SetStatus.draft, processingDone: false),
          ];
        await pumpOne(
          tester,
          const DoctorDashboardScreen(poll: Duration(milliseconds: 50)),
          overrides: [doctorSetsRepositoryProvider.overrideWithValue(repo)],
        );
        await pumpFrames(tester, 6);
        expect(find.text('منشورة'), findsWidgets);
        expect(find.text('جاري المعالجة'), findsOneWidget);
        expect(repo.calls.where((c) => c == 'sets').length, greaterThan(1));
      },
    );

    testWidgets('set: ready draft → publish; needs review with reasons', (
      tester,
    ) async {
      final repo = FakeDoctorSetsRepository()
        ..setAnswers = [doctorSet(status: SetStatus.draft)]
        ..setPreview = const SetPreview(
          questions: [q],
          checkImage: {'q1'},
          needsReview: [
            NeedsReviewItem(
              id: 'n1',
              orderIndex: 2,
              questionText: 'Which of',
              sourcePage: 7,
              reasons: ['single_option'],
            ),
          ],
        );
      await pump(tester, const DoctorSetScreen(setId: 's1'), repo);
      expect(find.text('جاهزة للنشر'), findsOneWidget);
      await tester.tap(find.text('أظهر كل الإجابات'));
      await pumpFrames(tester);
      expect(find.text('صور تحتاج مراجعة'), findsOneWidget);
      expect(
        find.textContaining('خيار واحد فقط (single_option)'),
        findsOneWidget,
      );
      await tester.tap(find.text('انشر المجموعة'));
      await pumpFrames(tester);
      expect(repo.calls, contains('publish'));
    });

    testWidgets('codes: generate → shown once, CSV shared, revoke', (
      tester,
    ) async {
      String? sharedCsv;
      final repo = FakeDoctorSetsRepository()
        ..setAnswers = [doctorSet()]
        ..codeList = const [
          AccessCode(id: 'c1', hint: 'X9Z1', status: CodeStatus.unused),
        ];
      await pumpOne(
        tester,
        const DoctorSetScreen(setId: 's1'),
        overrides: [
          doctorSetsRepositoryProvider.overrideWithValue(repo),
          codesSharerProvider.overrideWithValue((csv, _) async {
            sharedCsv = csv;
          }),
        ],
      );
      await pumpFrames(tester);
      await tester.tap(find.text('الأكواد'));
      await pumpFrames(tester);
      await tester.tap(find.text('100'));
      await tester.pump();
      await tester.tap(find.text('ولّد 100 كود'));
      await pumpFrames(tester);
      expect(repo.calls, contains('generate:100'));
      expect(find.text('NL-AAAA-BBBB-CCCC'), findsOneWidget);
      await tester.tap(find.text('مشاركة ملف CSV'));
      await pumpFrames(tester);
      expect(sharedCsv, 'code\nNL-AAAA-BBBB-CCCC\nNL-DDDD-EEEE-FFFF\n');
      await tester.tap(find.text('حفظتها، أخفِها'));
      await pumpFrames(tester);
      expect(find.text('NL-AAAA-BBBB-CCCC'), findsNothing);
      await tester.drag(find.byType(ListView).last, const Offset(0, -600));
      await pumpFrames(tester);
      await tester.tap(find.widgetWithText(NlButton, 'إلغاء'));
      await pumpFrames(tester);
      expect(repo.calls, contains('revokeCode:c1'));
    });

    testWidgets('students: withdraw asks first', (tester) async {
      final repo = FakeDoctorSetsRepository()
        ..setAnswers = [doctorSet()]
        ..studentList = const [
          SetStudent(entitlementId: 'e1', active: true, name: 'سارة'),
        ];
      await pump(tester, const DoctorSetScreen(setId: 's1'), repo);
      await tester.tap(find.text('الطلاب'));
      await pumpFrames(tester);
      await tester.tap(find.widgetWithText(NlButton, 'اسحب الوصول'));
      await pumpFrames(tester);
      await tester.tap(find.widgetWithText(NlButton, 'تأكيد السحب'));
      await pumpFrames(tester);
      expect(repo.calls, contains('revokeStudent:e1'));
    });
  });
}
