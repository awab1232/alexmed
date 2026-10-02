import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import 'local_store.dart';

/// A small per-account map kept on the device (the web keeps these in
/// localStorage): positions, best times, answers. Starts empty, fills from
/// the store in the background — values set meanwhile win — and writes
/// every change. Reset when the account changes; wiped on sign-out with
/// the rest of the store. At most [maxEntries] keys are kept (the most
/// recently set).
abstract class PersistedMapNotifier<V> extends Notifier<Map<String, V>> {
  String get storeKey;
  int get maxEntries => 200;
  Object? encode(V value);
  V? decode(Object? json);

  final _order = <String>[];
  Future<void> _loaded = Future.value();

  @override
  Map<String, V> build() {
    ref.watch(sessionControllerProvider.select((s) => s.status));
    _order.clear();
    _loaded = _load();
    return {};
  }

  LocalStore get _store => ref.read(localStoreProvider);

  Future<void> _load() async {
    try {
      final raw = await _store.read(storeKey);
      if (raw is! Map) return;
      final loaded = <String, V>{};
      for (final MapEntry(:key, :value) in raw.entries) {
        final v = decode(value);
        if (v != null) loaded['$key'] = v;
      }
      if (loaded.isEmpty) return;
      _order.insertAll(0, loaded.keys.where((k) => !state.containsKey(k)));
      state = {...loaded, ...state};
    } catch (_) {
      // Unreadable → start empty.
    }
  }

  void put(String key, V value) {
    _order
      ..remove(key)
      ..add(key);
    final next = {...state, key: value};
    while (_order.length > maxEntries) {
      next.remove(_order.removeAt(0));
    }
    state = next;
    unawaited(_save());
  }

  Future<void> _save() async {
    // A value set before the stored map arrived must not overwrite it:
    // the load merges first, then everything is written.
    await _loaded;
    try {
      await _store.write(storeKey, {
        for (final MapEntry(:key, :value) in state.entries) key: encode(value),
      });
    } catch (_) {
      // Kept in memory for this session regardless.
    }
  }
}

/// String → int (positions, pages).
abstract class PersistedIntMap extends PersistedMapNotifier<int> {
  @override
  Object? encode(int value) => value;
  @override
  int? decode(Object? json) => json is num ? json.toInt() : null;

  void set(String key, int value) => put(key, value);
}
