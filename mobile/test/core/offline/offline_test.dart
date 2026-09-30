import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/api/trpc_client.dart';
import 'package:nirolearn/core/offline/offline.dart';
import 'package:nirolearn/core/storage/local_store.dart';
import 'package:nirolearn/core/storage/persisted_map.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/fake_http.dart';

void main() {
  late FakeAdapter adapter;
  late MemoryLocalStore store;
  late TrpcClient client;
  final reach = <bool>[];

  setUp(() {
    reach.clear();
    store = MemoryLocalStore();
    adapter = FakeAdapter((o, body) {
      if (o.path.endsWith('subjects.list')) {
        return (
          status: 200,
          body: '{"result":{"data":{"json":[{"id":"s1"}]}}}',
        );
      }
      return (status: 200, body: '{"result":{"data":{"json":null}}}');
    });
    final dio = Dio(BaseOptions(baseUrl: testEnv.apiBaseUrl))
      ..httpClientAdapter = adapter;
    client = TrpcClient(
      dio,
      cache: QueryCache(store),
      queue: SyncQueue(store),
      onReachability: reach.add,
    );
  });

  test(
    'offline query falls back to the last answer; others still fail',
    () async {
      List<Object?> parse(Object? d) => d! as List<Object?>;
      final fresh = await client.query(
        'subjects.list',
        parse: parse,
        offline: true,
      );
      expect(fresh, hasLength(1));
      await Future<void>.delayed(Duration.zero); // cache write
      adapter.failWithSocketError = true;
      final cached = await client.query(
        'subjects.list',
        parse: parse,
        offline: true,
      );
      expect(cached, fresh);
      expect(reach, [true, false]);
      await expectLater(
        client.query('books.list', parse: parse, offline: true),
        throwsA(isA<NetworkException>()),
      );
      await expectLater(
        client.query('questionSets.get', parse: parse),
        throwsA(isA<NetworkException>()),
      );
    },
  );

  test('queued mutation kept offline, sent in order when back', () async {
    adapter.failWithSocketError = true;
    await client.mutation(
      'books.rateCard',
      input: {'cardId': 'c1', 'rating': 'good'},
      parse: (_) {},
      queueOffline: true,
    );
    await client.mutation(
      'decks.rateCard',
      input: {'cardId': 'c2', 'rating': 'hard'},
      parse: (_) {},
      queueOffline: true,
    );
    // Not queued without the flag.
    await expectLater(
      client.mutation('books.generateChapterMcqs', parse: (_) {}),
      throwsA(isA<NetworkException>()),
    );
    expect(await SyncQueue(store).pending(), hasLength(2));

    // Still offline: nothing is lost.
    expect(await client.flushQueue(), 0);
    expect(await SyncQueue(store).pending(), hasLength(2));

    adapter.failWithSocketError = false;
    adapter.requests.clear();
    expect(await client.flushQueue(), 2);
    expect(adapter.requests.map((r) => r.path), [
      '/api/trpc/books.rateCard',
      '/api/trpc/decks.rateCard',
    ]);
    expect(await SyncQueue(store).pending(), isEmpty);
  });

  test('a call the server rejects is dropped, the rest still go', () async {
    final queue = SyncQueue(store);
    for (final id in ['a', 'bad', 'c']) {
      await queue.add(QueuedCall(path: 'x', input: id, at: DateTime.now()));
    }
    final sent = <Object?>[];
    final n = await queue.flush((call) async {
      if (call.input == 'bad') throw const ServerException();
      sent.add(call.input);
    }, (e) => e is NetworkException);
    expect(n, 2);
    expect(sent, ['a', 'c']);
    expect(await queue.pending(), isEmpty);
  });

  test('query cache keeps the most recent entries only', () async {
    final cache = QueryCache(store, maxEntries: 3);
    for (var i = 0; i < 5; i++) {
      await cache.write('q.$i', {'json': i});
    }
    expect(await cache.read('q.0'), isNull);
    expect(await cache.read('q.1'), isNull);
    expect(await cache.read('q.4'), {'json': 4});
  });

  test('stable hash is deterministic and file-name safe', () {
    expect(stableHash('abc'), stableHash('abc'));
    expect(stableHash('abc'), isNot(stableHash('abd')));
    expect(RegExp(r'^[0-9a-f]{16}$').hasMatch(stableHash('x')), isTrue);
  });

  test(
    'persisted map: loads from the device, values set meanwhile win',
    () async {
      final store = MemoryLocalStore();
      await store.write('pos-test', {'b1': 7, 'b2': 3});
      final container = ProviderContainer(
        overrides: [
          localStoreProvider.overrideWithValue(store),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          envProvider.overrideWithValue(testEnv),
        ],
      );
      addTearDown(container.dispose);
      final provider = NotifierProvider<_TestMap, Map<String, int>>(
        _TestMap.new,
      );
      // Signed in first (screens only exist then).
      container.read(sessionControllerProvider);
      await Future<void>.delayed(const Duration(milliseconds: 10));
      container.listen(provider, (_, _) {});
      container.read(provider.notifier).set('b2', 9);
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(container.read(provider), {'b1': 7, 'b2': 9});
      expect(await store.read('pos-test'), {'b1': 7, 'b2': 9});
    },
  );

  test(
    'persisted map: a value set while the store is slow keeps the rest',
    () async {
      final store = _SlowStore();
      await store.write('pos-test', {'b1': 7});
      final container = ProviderContainer(
        overrides: [
          localStoreProvider.overrideWithValue(store),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          envProvider.overrideWithValue(testEnv),
        ],
      );
      addTearDown(container.dispose);
      final provider = NotifierProvider<_TestMap, Map<String, int>>(
        _TestMap.new,
      );
      container.read(sessionControllerProvider);
      await Future<void>.delayed(const Duration(milliseconds: 10));
      container.listen(provider, (_, _) {});
      // Set before the 50 ms read comes back.
      container.read(provider.notifier).set('b2', 9);
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(await store.read('pos-test'), {'b1': 7, 'b2': 9});
    },
  );

  testWidgets('offline banner above the app while the server is unreachable', (
    tester,
  ) async {
    await pumpNiroLearn(tester, session: signedIn);
    const banner = 'أنت غير متصل — يظهر آخر ما حُفظ على جهازك.';
    expect(find.text(banner), findsNothing);
    final container = ProviderScope.containerOf(
      tester.element(find.byType(Scaffold).first),
    );
    container.read(onlineProvider.notifier).set(false);
    await tester.pump();
    expect(find.text(banner), findsOneWidget);
    container.read(onlineProvider.notifier).set(true);
    await tester.pump();
    expect(find.text(banner), findsNothing);
  });
}

class _TestMap extends PersistedIntMap {
  @override
  String get storeKey => 'pos-test';
}

class _SlowStore extends MemoryLocalStore {
  @override
  Future<Object?> read(String key) async {
    await Future<void>.delayed(const Duration(milliseconds: 50));
    return super.read(key);
  }
}
