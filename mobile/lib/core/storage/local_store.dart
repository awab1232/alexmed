import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../app/providers.dart';

/// Small JSON documents kept on this device for the signed-in account —
/// Niro's conversation (as the web keeps it in localStorage), cached lists
/// and study content for offline reading, the offline answer queue.
///
/// Plain files in the app's private support directory (excluded from
/// backups by the manifest; never visible to other apps), written
/// atomically (temp file + rename). Everything is deleted on sign-out.
/// **Never** used for protected doctor-set content (blueprint §14).
///
/// Why not drift (listed in blueprint §3.3): every use here is "read or
/// replace one document by key" — no relational queries — so a key-value
/// file store covers it without a code generator, a native SQLite build
/// or migrations. Recorded in the roadmap (P10).
abstract class LocalStore {
  Future<Object?> read(String key);
  Future<void> write(String key, Object? json);
  Future<void> delete(String key);

  /// Keys starting with [prefix].
  Future<List<String>> keys(String prefix);
  Future<void> clearAll();
}

final _safeKey = RegExp(r'^[a-z0-9._-]{1,120}$');

class FileLocalStore implements LocalStore {
  FileLocalStore(this._dir);

  /// Resolved lazily — path_provider needs the engine.
  final Future<Directory> Function() _dir;
  Directory? _resolved;

  Future<Directory> get _root async {
    if (_resolved != null) return _resolved!;
    final base = await _dir();
    final dir = Directory('${base.path}${Platform.pathSeparator}local_store');
    await dir.create(recursive: true);
    return _resolved = dir;
  }

  Future<File> _file(String key) async {
    if (!_safeKey.hasMatch(key)) throw ArgumentError.value(key, 'key');
    final root = await _root;
    return File('${root.path}${Platform.pathSeparator}$key.json');
  }

  @override
  Future<Object?> read(String key) async {
    final file = await _file(key);
    try {
      return jsonDecode(await file.readAsString());
    } on PathNotFoundException {
      return null;
    } on FormatException {
      // A torn or corrupt file is treated as absent, never a crash.
      await delete(key);
      return null;
    }
  }

  @override
  Future<void> write(String key, Object? json) async {
    final file = await _file(key);
    final temp = File('${file.path}.tmp');
    await temp.writeAsString(jsonEncode(json), flush: true);
    await temp.rename(file.path);
  }

  @override
  Future<void> delete(String key) async {
    final file = await _file(key);
    try {
      await file.delete();
    } on PathNotFoundException {
      // already gone
    }
  }

  @override
  Future<List<String>> keys(String prefix) async {
    final root = await _root;
    final names = <String>[];
    await for (final entity in root.list()) {
      final name = entity.uri.pathSegments.last;
      if (name.endsWith('.json') && name.startsWith(prefix)) {
        names.add(name.substring(0, name.length - 5));
      }
    }
    return names;
  }

  @override
  Future<void> clearAll() async {
    final root = await _root;
    if (await root.exists()) await root.delete(recursive: true);
    _resolved = null;
  }
}

/// For tests and as a fallback.
class MemoryLocalStore implements LocalStore {
  final data = <String, String>{};

  @override
  Future<Object?> read(String key) async =>
      data[key] == null ? null : jsonDecode(data[key]!);

  @override
  Future<void> write(String key, Object? json) async =>
      data[key] = jsonEncode(json);

  @override
  Future<void> delete(String key) async => data.remove(key);

  @override
  Future<List<String>> keys(String prefix) async =>
      data.keys.where((k) => k.startsWith(prefix)).toList();

  @override
  Future<void> clearAll() async => data.clear();
}

final localStoreProvider = Provider<LocalStore>((ref) {
  final store = FileLocalStore(getApplicationSupportDirectory);
  ref.read(sessionControllerProvider.notifier).addSignOutHook(store.clearAll);
  return store;
});
