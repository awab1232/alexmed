// Offline, end to end on a device: the real app, the real Dio client and
// the real on-device store, talking to a small tRPC stand-in served by
// this test on localhost. The server is stopped to go offline and started
// again to come back:
//   1. online  — Home loads; its answers are cached on the device
//   2. offline — refresh fails for lack of network → the offline banner,
//                the cached folders still shown; a rating is queued
//   3. back    — the probe reaches the server, the banner goes, the queued
//                rating is sent.
// Pauses for `adb exec-out screencap` on each state.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/app/env.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/offline/offline.dart';
import 'package:nirolearn/core/storage/local_store.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';

import '../test/helpers/app_harness.dart';
import '../test/helpers/fake_http.dart';

Future<void> hold(
  WidgetTester tester,
  String label, {
  int quarterSeconds = 16,
}) async {
  debugPrint('SCREEN $label');
  for (var i = 0; i < quarterSeconds; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

final received = <String>[];

Object? answer(String path) => switch (path) {
  'subjects.list' => [
    {'id': 's1', 'name': 'أدوية', 'type': 'medical', 'bookCount': 2},
    {'id': 's2', 'name': 'Anatomy', 'type': 'medical', 'bookCount': 1},
  ],
  'books.list' => [
    {
      'id': 'b1',
      'fileName': 'Guyton_Physiology.pdf',
      'subjectId': 's1',
      'pageCount': 320,
    },
  ],
  'decks.list' || 'books.dueCards' || 'decks.dueCards' => <Object>[],
  'sharing.homeSummary' => {'pending': 0, 'unread': 0, 'recent': <Object>[]},
  'auth.me' => {'name': 'سارة أحمد'},
  'questionSets.enabled' => false,
  _ => null,
};

Future<HttpServer> serve(int port) async {
  final server = await HttpServer.bind(
    InternetAddress.loopbackIPv4,
    port,
    shared: true,
  );
  server.listen((request) async {
    final path = request.uri.path.replaceFirst('/api/trpc/', '');
    received.add('${request.method} $path');
    await request.drain<void>();
    request.response
      ..headers.contentType = ContentType.json
      ..write(
        jsonEncode({
          'result': {
            'data': {'json': answer(path)},
          },
        }),
      );
    await request.response.close();
  });
  return server;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('offline: banner, cached data, queued rating sent later', (
    tester,
  ) async {
    var server = (await tester.runAsync(() => serve(0)))!;
    final port = server.port;
    final env = AppEnv(
      flavor: AppFlavor.dev,
      apiBaseUrl: 'http://localhost:$port',
      sessionCookieName: 'authjs.session-token',
    );
    final store = FileLocalStore(() async => Directory.systemTemp);
    await tester.runAsync(store.clearAll);

    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(env),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          localStoreProvider.overrideWithValue(store),
        ],
        child: const NiroLearnApp(),
      ),
    );
    // Real HTTP: let the requests happen outside the fake clock.
    for (var i = 0; i < 12; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 250)),
      );
      await tester.pump();
    }
    await hold(tester, 'offline-1-online');
    expect(findLabel('أدوية'), findsWidgets);
    final container = ProviderScope.containerOf(
      tester.element(find.byType(NlBottomNav)),
    );
    expect(container.read(onlineProvider), isTrue);

    // Offline.
    await tester.runAsync(() => server.close(force: true));
    container
      ..invalidate(subjectsProvider)
      ..invalidate(booksProvider);
    for (var i = 0; i < 12; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 250)),
      );
      await tester.pump();
    }
    await hold(tester, 'offline-2-banner');
    expect(container.read(onlineProvider), isFalse);
    expect(
      find.text('أنت غير متصل — يظهر آخر ما حُفظ على جهازك.'),
      findsOneWidget,
    );
    expect(findLabel('أدوية'), findsWidgets, reason: 'cached folders shown');

    await tester.runAsync(
      () => container
          .read(trpcProvider)
          .mutation<void>(
            'books.rateCard',
            input: {'cardId': 'c1', 'rating': 'good'},
            parse: (_) {},
            queueOffline: true,
          ),
    );
    final pending = await tester.runAsync(
      () => container.read(syncQueueProvider).pending(),
    );
    expect(pending, hasLength(1));
    debugPrint('QUEUED ${pending!.length}');

    // Back online: the probe (every 20 s) finds the server again.
    received.clear();
    server = (await tester.runAsync(() => serve(port)))!;
    for (var i = 0; i < 100 && container.read(onlineProvider) == false; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 300)),
      );
      await tester.pump(const Duration(milliseconds: 300));
    }
    for (var i = 0; i < 8; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 250)),
      );
      await tester.pump();
    }
    await hold(tester, 'offline-3-back');
    expect(container.read(onlineProvider), isTrue);
    expect(received, contains('POST books.rateCard'));
    final left = await tester.runAsync(
      () => container.read(syncQueueProvider).pending(),
    );
    expect(left, isEmpty);
    debugPrint('SENT ${received.where((r) => r.contains('rateCard')).length}');
    await tester.runAsync(() => server.close(force: true));
  });
}
