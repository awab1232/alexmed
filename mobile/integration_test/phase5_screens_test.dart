// Visual check of Phase 5 screens on a device, with in-memory data (no
// server): pauses on each screen so screenshots can be taken with
// `adb exec-out screencap`. Not a substitute for live testing (staging, D1).
//   flutter test integration_test/phase5_screens_test.dart \
//     --dart-define-from-file=env/prod.json -d <device>

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/auth/data/auth_repository.dart';
import 'package:nirolearn/features/library/data/library_models.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';

import '../test/helpers/app_harness.dart';
import '../test/helpers/fake_http.dart';

Future<void> hold(WidgetTester tester, String label) async {
  debugPrint('SCREEN $label');
  for (var i = 0; i < 40; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('phase 5 screens', (tester) async {
    final library = FakeLibraryRepository()
      ..due = 12
      ..folders = [
        Subject(
          id: 's1',
          name: 'تشريح',
          type: 'medical',
          bookCount: 2,
          deckCount: 1,
          lastUpdatedAt: DateTime.now().subtract(const Duration(days: 2)),
          examDate: DateTime.now().add(const Duration(days: 6)),
        ),
        const Subject(
          id: 's2',
          name: 'Pharmacology',
          type: 'medical',
          bookCount: 1,
        ),
      ]
      ..bookList = const [
        BookSummary(
          id: 'b1',
          fileName: 'Cardiology_Lecture_3.pdf',
          subjectId: 's1',
          pageCount: 42,
          chapterCount: 5,
          completeChapterCount: 3,
        ),
        BookSummary(
          id: 'b2',
          fileName: 'الجهاز العصبي.pdf',
          subjectId: 's1',
          pageCount: 18,
          chapterCount: 0,
        ),
      ]
      ..deckList = const [
        DeckSummary(
          id: 'd1',
          fileName: 'Anatomy MCQs 2025.pdf',
          subjectId: 's1',
          pageCount: 12,
          cardCount: 60,
        ),
      ]
      ..shared = const SharedSummary(pending: 1);
    final account = FakeAccountRepository();

    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(library),
          accountRepositoryProvider.overrideWithValue(account),
        ],
        child: const NiroLearnApp(),
      ),
    );
    await hold(tester, 'home');

    await tester.drag(find.byType(Scrollable).first, const Offset(0, -700));
    await hold(tester, 'home-scrolled');

    await tester.tap(findLabel('تشريح'));
    await hold(tester, 'folder');

    await tester.tap(find.text('حسابي'));
    await hold(tester, 'account');

    await tester.tap(find.text('الباقة والاستخدام'));
    await hold(tester, 'plan');
    await tester.binding.handlePopRoute();
    await hold(tester, 'account-again');

    await tester.tap(find.byTooltip('إضافة'));
    await hold(tester, 'add-sheet');
  });
}
