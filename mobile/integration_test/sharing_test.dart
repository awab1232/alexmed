// Sharing on a device with in-memory data (no server): مشترك معي (requests,
// packs, notifications), the share sheet, blocked people. Pauses on each
// screen for `adb exec-out screencap`.

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
import 'package:nirolearn/features/sharing/data/sharing_repository.dart';
import 'package:nirolearn/features/sharing/presentation/share_sheet.dart';

import '../test/features/sharing/sharing_test.dart'
    show FakeSharingRepository, request;
import '../test/helpers/app_harness.dart';
import '../test/helpers/fake_http.dart';

Future<void> hold(WidgetTester tester, String label) async {
  debugPrint('SCREEN $label');
  for (var i = 0; i < 20; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('sharing screens', (tester) async {
    final repo = FakeSharingRepository()
      ..requests = [request]
      ..packs = [
        SharedWithMe(
          shareId: 'x1',
          bookId: 'b7',
          bookTitle: 'Pharmacology_Notes.pdf',
          ownerUsername: 'omar.k',
          sharedAt: DateTime(2026, 9, 20),
          contents: const PackContents(
            chapters: 8,
            flashcards: 120,
            questions: 60,
          ),
        ),
      ]
      ..hits = const [
        StudentHit(id: 'u2', username: 'omar.k', name: 'عمر خالد'),
        StudentHit(id: 'u3', username: 'omnia', name: 'Omnia Saleh'),
      ]
      ..shares = const [
        BookShare(shareId: 's1', status: 'accepted', recipientName: 'ليلى'),
        BookShare(shareId: 's2', status: 'pending', recipientUsername: 'sami'),
      ]
      ..blockedUsers = const [BlockedUser(id: 'u9', username: 'spam.acc')];
    final library = FakeLibraryRepository()
      ..shared = const SharedSummary(pending: 1, unread: 3);

    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(library),
          accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
          sharingRepositoryProvider.overrideWithValue(repo),
        ],
        child: const NiroLearnApp(),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    final router = ProviderScope.containerOf(
      tester.element(find.byType(NlBottomNav)),
    ).read(routerProvider);

    unawaited(router.push(Routes.shared));
    await hold(tester, 'sh-requests');
    await tester.tap(find.byType(ChoiceChip).at(1));
    await hold(tester, 'sh-library');
    router.pop();
    await tester.pump(const Duration(seconds: 1));

    final context = tester.element(find.byType(NlBottomNav));
    unawaited(
      showShareSheet(context, bookId: 'b1', bookTitle: 'Guyton_Physiology.pdf'),
    );
    await tester.pump(const Duration(seconds: 1));
    await tester.enterText(find.byType(TextField), 'om');
    FocusManager.instance.primaryFocus?.unfocus();
    await hold(tester, 'sh-sheet-search');
    await tester.tap(findLabel('عمر خالد'));
    await hold(tester, 'sh-sheet-confirm');
    Navigator.of(context).pop();
    await tester.pump(const Duration(seconds: 1));

    unawaited(router.push(Routes.blocked));
    await hold(tester, 'sh-blocked');
  });
}
