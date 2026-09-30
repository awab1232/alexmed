// Visual check of the كتبي question-file screens on a device with in-memory
// data (no server). Pauses on each screen so `adb exec-out screencap` can
// capture it.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/app/router.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/auth/data/auth_repository.dart';
import 'package:nirolearn/features/library/data/library_models.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';
import 'package:nirolearn/features/question_files/data/question_file_models.dart';
import 'package:nirolearn/features/question_files/data/question_file_repository.dart';

import '../test/features/question_files/question_file_screens_test.dart'
    show FakeQuestionFileRepository, qAi, qNone, qStated;
import '../test/helpers/app_harness.dart';
import '../test/helpers/fake_http.dart';

Future<void> hold(WidgetTester tester, String label) async {
  debugPrint('SCREEN $label');
  for (var i = 0; i < 24; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

QuestionFileDetail file(
  QuestionFileStatus status, {
  List<QuestionItem> questions = const [],
  String? error,
}) => QuestionFileDetail(
  id: 'qf1',
  fileName: 'Pharmacology MCQs 2026.pdf',
  status: status,
  extractionError: error,
  content: QuestionContent(questions: questions),
);

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('question file screens', (tester) async {
    final library = FakeLibraryRepository()
      ..folders = [const Subject(id: 's1', name: 'أدوية', type: 'medical')];
    final repo = FakeQuestionFileRepository()
      ..files = const [
        QuestionFileSummary(
          id: 'qf1',
          fileName: 'Pharmacology MCQs 2026.pdf',
          status: QuestionFileStatus.complete,
          questionCount: 3,
        ),
        QuestionFileSummary(
          id: 'qf2',
          fileName: 'بنك أسئلة التشريح.pdf',
          status: QuestionFileStatus.extracting,
        ),
        QuestionFileSummary(
          id: 'qf3',
          fileName: 'Scanned forensic bank.pdf',
          status: QuestionFileStatus.failed,
        ),
      ];

    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(library),
          accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
          questionFileRepositoryProvider.overrideWithValue(repo),
        ],
        child: const NiroLearnApp(),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    final router = ProviderScope.containerOf(
      tester.element(find.byType(NlBottomNav)),
    ).read(routerProvider);

    unawaited(router.push('${Routes.uploadBookIn('s1')}&kind=questions'));
    await hold(tester, 'qf-upload');
    router.pop();
    await tester.pump(const Duration(seconds: 1));

    unawaited(router.push(Routes.questionBanks));
    await hold(tester, 'qf-list');

    repo.details = [file(QuestionFileStatus.extracting)];
    unawaited(router.push(Routes.questionBank('qf2')));
    await hold(tester, 'qf-extracting');
    router.pop();
    await tester.pump(const Duration(seconds: 1));

    repo.details = [
      file(
        QuestionFileStatus.failed,
        error: 'لم نستطع قراءة النص من هذا الملف الممسوح.',
      ),
    ];
    unawaited(router.push(Routes.questionBank('qf3')));
    await hold(tester, 'qf-failed');
    router.pop();
    await tester.pump(const Duration(seconds: 1));

    repo.details = [
      file(QuestionFileStatus.complete, questions: const [qStated, qAi, qNone]),
    ];
    unawaited(router.push(Routes.questionBank('qf1')));
    await hold(tester, 'qf-card');
    await tester.tap(find.text('Mannitol'));
    await hold(tester, 'qf-answered-wrong');
    await tester.tap(find.text('عرض الترجمة'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.drag(find.byType(Scrollable).last, const Offset(0, -500));
    await hold(tester, 'qf-translation');
    await tester.tap(find.byKey(const ValueKey('question-picker')));
    await hold(tester, 'qf-picker');
    await tester.tap(find.text('2'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('SA node'));
    await hold(tester, 'qf-ai-answer');
  });
}
