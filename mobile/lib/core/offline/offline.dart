import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/local_store.dart';

// Honest offline support (blueprint §14). What was last seen stays
// readable; server actions still need the network; flashcard ratings made
// offline are queued and sent later. Everything lives in the per-account
// LocalStore (wiped on sign-out) — never protected doctor-set content,
// which never opts in to caching.

/// Online as far as the app can tell: flipped off by a request that failed
/// for lack of network, back on by any request that reaches the server.
/// (No connectivity plugin — the requests themselves are the signal.)
final onlineProvider = NotifierProvider<OnlineStatus, bool>(OnlineStatus.new);

class OnlineStatus extends Notifier<bool> {
  @override
  bool build() => true;

  void set(bool online) {
    if (state != online) state = online;
  }
}

/// 64-bit FNV-1a, hex — a stable, file-name-safe key for a query + input.
String stableHash(String text) {
  var hash = BigInt.parse('cbf29ce484222325', radix: 16);
  final prime = BigInt.parse('100000001b3', radix: 16);
  final mask = (BigInt.one << 64) - BigInt.one;
  for (final unit in utf8.encode(text)) {
    hash = ((hash ^ BigInt.from(unit)) * prime) & mask;
  }
  return hash.toRadixString(16).padLeft(16, '0');
}

/// The last successful answer of selected tRPC queries, as the raw
/// `{json, meta}` envelope (decoded again on use, so superjson Dates
/// survive). Least recently written entries beyond [maxEntries] are
/// dropped; an answer larger than [maxEntryBytes] is not kept.
class QueryCache {
  QueryCache(
    this._store, {
    this.maxEntries = 250,
    this.maxEntryBytes = 3 << 20,
  });

  final LocalStore _store;
  final int maxEntries;
  final int maxEntryBytes;

  static const _indexKey = 'q-index';
  Future<void> _lock = Future.value();

  static String keyFor(String path, String? input) =>
      'q.${stableHash('$path\n${input ?? ''}')}';

  Future<Map<String, Object?>?> read(String key) async {
    try {
      final value = await _store.read(key);
      return value is Map ? value.cast<String, Object?>() : null;
    } catch (_) {
      return null;
    }
  }

  Future<void> write(String key, Map<String, Object?> envelope) {
    // Serialised: the index is read-modify-write.
    return _lock = _lock.then((_) async {
      try {
        final encoded = jsonEncode(envelope);
        if (encoded.length > maxEntryBytes) return;
        await _store.write(key, envelope);
        final raw = await _store.read(_indexKey);
        final index = raw is List ? [for (final k in raw) '$k'] : <String>[];
        index
          ..remove(key)
          ..add(key);
        while (index.length > maxEntries) {
          await _store.delete(index.removeAt(0));
        }
        await _store.write(_indexKey, index);
      } catch (_) {
        // A cache that can't be written is only a missed optimisation.
      }
    });
  }
}

final queryCacheProvider = Provider<QueryCache>(
  (ref) => QueryCache(ref.watch(localStoreProvider)),
);

/// A mutation kept for later: tRPC path + its (plain JSON) input.
final class QueuedCall {
  const QueuedCall({required this.path, required this.input, required this.at});

  factory QueuedCall.fromJson(Map<String, Object?> json) => QueuedCall(
    path: json['path']! as String,
    input: json['input'],
    at: DateTime.tryParse('${json['at']}') ?? DateTime.now(),
  );

  final String path;
  final Object? input;
  final DateTime at;

  Map<String, Object?> toJson() => {
    'path': path,
    'input': input,
    'at': at.toIso8601String(),
  };
}

/// Mutations made offline that can safely wait (flashcard / review
/// ratings), sent in order once the server is reachable. The server has no
/// "reviewed at" field (G8, optional): a queued rating is scheduled from
/// when it arrives, not when it was made.
class SyncQueue {
  SyncQueue(this._store);

  final LocalStore _store;
  static const _key = 'sync-queue';
  Future<void> _lock = Future.value();

  Future<List<QueuedCall>> pending() async {
    try {
      final raw = await _store.read(_key);
      if (raw is! List) return const [];
      return [
        for (final item in raw)
          if (item is Map) QueuedCall.fromJson(item.cast()),
      ];
    } catch (_) {
      return const [];
    }
  }

  Future<void> add(QueuedCall call) => _lock = _lock.then((_) async {
    final items = [...await pending(), call];
    await _store.write(_key, [for (final c in items) c.toJson()]);
  });

  /// Sends queued calls in order with [send]. Stops (keeping the rest) at
  /// the first call that fails for lack of network — [isNetworkError] —
  /// and drops a call the server rejects, so one bad entry can't block the
  /// queue forever. Returns how many were sent.
  Future<int> flush(
    Future<void> Function(QueuedCall call) send,
    bool Function(Object error) isNetworkError,
  ) {
    final done = Completer<int>();
    _lock = _lock.then((_) async {
      var sent = 0;
      final items = [...await pending()];
      while (items.isNotEmpty) {
        try {
          await send(items.first);
          sent++;
        } catch (error) {
          if (isNetworkError(error)) break;
        }
        items.removeAt(0);
        await _store.write(_key, [for (final c in items) c.toJson()]);
      }
      done.complete(sent);
    });
    return done.future;
  }
}

final syncQueueProvider = Provider<SyncQueue>(
  (ref) => SyncQueue(ref.watch(localStoreProvider)),
);
