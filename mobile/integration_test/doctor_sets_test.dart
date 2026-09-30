// Doctor sets on a device with in-memory data (no server): the student's
// codes / sets / protected set (FLAG_SECURE, watermark) and the doctor's
// dashboard / set tabs. Pauses on each screen for `adb exec-out screencap`
// (a protected screen captures black — that is FLAG_SECURE working).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/app/router.dart';
import 'package:nirolearn/core/ui/secure_screen.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/auth/data/auth_repository.dart';
import 'package:nirolearn/features/doctor_sets/data/doctor_set_models.dart';
import 'package:nirolearn/features/doctor_sets/data/doctor_sets_repository.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';
import 'package:nirolearn/features/question_files/data/question_file_models.dart';

import '../test/features/doctor_sets/doctor_sets_test.dart'
    show FakeDoctorSetsRepository, doctorSet;
import '../test/features/question_files/question_file_screens_test.dart'
    show qAi, qStated;
import '../test/helpers/app_harness.dart';
import '../test/helpers/fake_http.dart';

Future<void> hold(WidgetTester tester, String label) async {
  debugPrint('SCREEN $label');
  for (var i = 0; i < 24; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('doctor sets screens', (tester) async {
    final repo = FakeDoctorSetsRepository()
      ..mineList = [
        const StudentSet(
          id: 's1',
          title: 'Anatomy Midterm 2026',
          doctorName: 'د. أحمد',
          subjectLabel: 'تشريح',
          questionCount: 40,
          availability: SetAvailability.available,
        ),
        StudentSet(
          id: 's2',
          title: 'Physiology Final',
          doctorName: 'د. ليلى',
          questionCount: 60,
          startsAt: DateTime(2026, 10, 12, 9),
          availability: SetAvailability.notStarted,
        ),
      ]
      ..catalogList = const [
        StudentSet(
          id: 's3',
          title: 'Pharmacology Quiz',
          doctorName: 'د. سامر',
          academicYear: 'السنة الثالثة',
          questionCount: 25,
          availability: SetAvailability.available,
        ),
      ]
      ..openResult = const ProtectedSet(
        title: 'Anatomy Midterm 2026',
        doctorName: 'د. أحمد',
        watermark: 'NiroLearn · @sara · 1A2B',
        questions: [qStated, qAi],
      )
      ..doctorStats = const DoctorStats(
        totalSets: 3,
        published: 1,
        disabled: 1,
        codesTotal: 150,
        activeStudents: 42,
      )
      ..setList = [
        doctorSet(),
        doctorSet(status: SetStatus.draft, processingDone: false),
        doctorSet(status: SetStatus.disabled),
      ]
      ..setAnswers = [doctorSet(status: SetStatus.draft)]
      ..setPreview = const SetPreview(
        questions: [qStated, qAi],
        checkImage: {'q2'},
        needsReview: [
          NeedsReviewItem(
            id: 'n1',
            orderIndex: 3,
            questionText: 'Which of the following is',
            sourcePage: 7,
            reasons: ['incomplete_stem', 'single_option'],
            options: ['A. Only one option'],
          ),
        ],
      )
      ..codeList = [
        AccessCode(
          id: 'c1',
          hint: 'X9Z1',
          status: CodeStatus.claimed,
          studentUsername: 'sara',
          claimedAt: DateTime(2026, 9, 29, 14, 5),
        ),
        AccessCode(
          id: 'c2',
          hint: 'K2M7',
          status: CodeStatus.unused,
          createdAt: DateTime(2026, 9, 28, 10),
        ),
      ];

    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(FakeLibraryRepository()),
          accountRepositoryProvider.overrideWithValue(
            FakeAccountRepository()..doctorSets = true,
          ),
          doctorSetsRepositoryProvider.overrideWithValue(repo),
        ],
        child: const NiroLearnApp(),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    final router = ProviderScope.containerOf(
      tester.element(find.byType(NlBottomNav)),
    ).read(routerProvider);

    unawaited(router.push(Routes.questionSets));
    await hold(tester, 'ds-student');
    unawaited(router.push(Routes.questionSet('s1')));
    await hold(tester, 'ds-protected-secure');
    router.pop();
    await tester.pump(const Duration(seconds: 1));
    // Capture the protected screens themselves (debug-only switch).
    SecureScreen.debugAllowCapture = true;
    unawaited(router.push(Routes.questionSet('s1')));
    await hold(tester, 'ds-protected-watermark');
    router.pop();
    await tester.pump(const Duration(seconds: 1));
    router.pop();
    await tester.pump(const Duration(seconds: 1));

    unawaited(router.push(Routes.doctor));
    await hold(tester, 'ds-dashboard');
    unawaited(router.push(Routes.doctorSet('s1')));
    await hold(tester, 'ds-set-questions');
    await tester.tap(find.text('أظهر كل الإجابات'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.drag(find.byType(Scrollable).last, const Offset(0, -2500));
    await hold(tester, 'ds-set-needs-review');
    await tester.tap(find.text('الأكواد'));
    await tester.pump(const Duration(milliseconds: 500));
    await hold(tester, 'ds-set-codes');
  });
}
