import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/api/trpc_client.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/library/data/library_models.dart';
import 'package:nirolearn/features/sharing/data/sharing_repository.dart';
import 'package:nirolearn/features/sharing/presentation/blocked_screen.dart';
import 'package:nirolearn/features/sharing/presentation/share_sheet.dart';
import 'package:nirolearn/features/sharing/presentation/shared_screen.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/screen_harness.dart';

class FakeSharingRepository extends SharingRepository {
  FakeSharingRepository() : super(TrpcClient(Dio()));

  final calls = <String>[];
  List<IncomingRequest> requests = [];
  List<SharedWithMe> packs = [];
  List<SharingNotification> notes = [];
  List<StudentHit> hits = [];
  List<BookShare> shares = [];
  List<BlockedUser> blockedUsers = [];
  Object? sendError;

  @override
  Future<String?> username() async => null;
  @override
  Future<String> setUsername(String username) async {
    calls.add('setUsername:$username');
    return username.toLowerCase();
  }

  @override
  Future<({List<StudentHit> items, int? nextOffset})> search(
    String query, {
    int offset = 0,
  }) async {
    calls.add('search:$query:$offset');
    return (items: hits, nextOffset: null);
  }

  @override
  Future<void> sendRequest(String bookId, String recipientId) async {
    calls.add('send:$bookId:$recipientId');
    if (sendError != null) throw sendError!;
  }

  @override
  Future<List<BookShare>> sharesForBook(String bookId) async => shares;
  @override
  Future<void> revoke(String shareId) async => calls.add('revoke:$shareId');
  @override
  Future<List<IncomingRequest>> incoming() async => requests;
  @override
  Future<void> respond(
    String shareId, {
    required bool accept,
    bool block = false,
  }) async {
    calls.add('respond:$shareId:$accept:$block');
    requests = [];
  }

  @override
  Future<List<SharedWithMe>> sharedWithMe() async => packs;
  @override
  Future<List<SharingNotification>> notifications() async => notes;
  @override
  Future<void> markNotificationsRead() async => calls.add('markRead');
  @override
  Future<List<BlockedUser>> blocked() async => blockedUsers;
  @override
  Future<void> unblock(String userId) async {
    calls.add('unblock:$userId');
    blockedUsers = [];
  }
}

const request = IncomingRequest(
  shareId: 'sh1',
  bookTitle: 'Guyton_Physiology.pdf',
  ownerName: 'ليلى',
  pageCount: 320,
  contents: PackContents(chapters: 12, flashcards: 240, examFocus: 80),
);

void main() {
  testWidgets('requests first when there are any; accept', (tester) async {
    final repo = FakeSharingRepository()..requests = [request];
    await pumpOne(
      tester,
      const SharedScreen(),
      overrides: [sharingRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    expect(findLabel('Guyton Physiology'), findsOneWidget);
    expect(find.textContaining('240 بطاقة'), findsOneWidget);
    await tester.tap(find.widgetWithText(NlButton, 'قبول'));
    await pumpFrames(tester);
    expect(repo.calls, contains('respond:sh1:true:false'));
  });

  testWidgets('decline and block asks first', (tester) async {
    final repo = FakeSharingRepository()..requests = [request];
    await pumpOne(
      tester,
      const SharedScreen(),
      overrides: [sharingRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    await tester.tap(find.widgetWithText(NlButton, 'رفض وحظر'));
    await pumpFrames(tester);
    expect(find.textContaining('لن يتمكن من إيجادك'), findsOneWidget);
    await tester.tap(find.widgetWithText(NlButton, 'رفض وحظر').last);
    await pumpFrames(tester);
    expect(repo.calls, contains('respond:sh1:false:true'));
  });

  testWidgets('notifications tab marks them read', (tester) async {
    final library = FakeLibraryRepository()
      ..shared = const SharedSummary(unread: 2);
    final repo = FakeSharingRepository()
      ..notes = [
        SharingNotification(
          id: 'n1',
          type: 'share_accepted',
          bookTitle: 'Anatomy.pdf',
          actorUsername: 'omar',
          createdAt: DateTime.utc(2026, 9, 29),
        ),
      ];
    await pumpOne(
      tester,
      const SharedScreen(),
      library: library,
      overrides: [sharingRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    await tester.tap(find.text('الإشعارات · 2'));
    await pumpFrames(tester);
    expect(repo.calls, contains('markRead'));
    expect(find.textContaining('قبل ملفك'), findsOneWidget);
  });

  testWidgets('username card saves the handle', (tester) async {
    final repo = FakeSharingRepository();
    final account = FakeAccountRepository()..user = null;
    await pumpOne(
      tester,
      const SharedScreen(),
      account: account,
      overrides: [sharingRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    await tester.enterText(find.byType(TextField), 'Sara.K');
    await tester.pump();
    await tester.tap(find.widgetWithText(NlButton, 'اختيار'));
    await pumpFrames(tester);
    expect(repo.calls, contains('setUsername:Sara.K'));
  });

  testWidgets('share sheet: search → confirm → send; server refusal shown', (
    tester,
  ) async {
    final repo = FakeSharingRepository()
      ..hits = const [StudentHit(id: 'u2', username: 'omar', name: 'عمر')]
      ..shares = const [
        BookShare(shareId: 's9', status: 'accepted', recipientName: 'ليلى'),
      ];
    await pumpOne(
      tester,
      Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: TextButton(
              onPressed: () => showShareSheet(
                context,
                bookId: 'b1',
                bookTitle: 'Guyton.pdf',
              ),
              child: const Text('open'),
            ),
          ),
        ),
      ),
      overrides: [sharingRepositoryProvider.overrideWithValue(repo)],
    );
    await tester.tap(find.text('open'));
    await pumpFrames(tester);
    expect(find.text('لديه وصول'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'o');
    await pumpFrames(tester, 5);
    expect(repo.calls.where((c) => c.startsWith('search')), isEmpty);
    await tester.enterText(find.byType(TextField), 'om');
    await pumpFrames(tester, 5);
    expect(repo.calls, contains('search:om:0'));
    await tester.tap(findLabel('عمر'));
    await pumpFrames(tester);
    repo.sendError = const RejectedException(
      'أرسلت له طلبًا بالفعل.',
      code: 'CONFLICT',
    );
    await tester.tap(find.widgetWithText(NlButton, 'إرسال طلب المشاركة'));
    await pumpFrames(tester);
    expect(find.text('أرسلت له طلبًا بالفعل.'), findsOneWidget);
    repo.sendError = null;
    await tester.tap(find.widgetWithText(NlButton, 'إرسال طلب المشاركة'));
    await pumpFrames(tester);
    expect(repo.calls, contains('send:b1:u2'));
    expect(find.text('✓ تم إرسال الطلب'), findsOneWidget);
  });

  testWidgets('blocked people: unblock after confirming', (tester) async {
    final repo = FakeSharingRepository()
      ..blockedUsers = const [BlockedUser(id: 'u3', username: 'spam')];
    await pumpOne(
      tester,
      const BlockedScreen(),
      overrides: [sharingRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    await tester.tap(find.widgetWithText(NlButton, 'إلغاء الحظر'));
    await pumpFrames(tester);
    await tester.tap(find.widgetWithText(NlButton, 'إلغاء الحظر').last);
    await pumpFrames(tester);
    expect(repo.calls, contains('unblock:u3'));
    expect(find.text('لم تحظر أحدًا'), findsOneWidget);
  });
}
