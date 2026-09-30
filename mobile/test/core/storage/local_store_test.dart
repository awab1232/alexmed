import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/storage/local_store.dart';

void main() {
  late Directory temp;
  late FileLocalStore store;

  setUp(() {
    temp = Directory.systemTemp.createTempSync('nl_store');
    store = FileLocalStore(() async => temp);
  });
  tearDown(() {
    if (temp.existsSync()) temp.deleteSync(recursive: true);
  });

  test('write → read round trip; missing key is null', () async {
    expect(await store.read('niro-history'), isNull);
    await store.write('niro-history', [
      {'role': 'user', 'content': 'مرحبا'},
    ]);
    expect(await store.read('niro-history'), [
      {'role': 'user', 'content': 'مرحبا'},
    ]);
    // No temp file left behind.
    final files = Directory('${temp.path}/local_store').listSync();
    expect(files.map((f) => f.uri.pathSegments.last), ['niro-history.json']);
  });

  test('a corrupt file reads as absent and is removed', () async {
    await store.write('cache.books', {'a': 1});
    File('${temp.path}/local_store/cache.books.json').writeAsStringSync('{bro');
    expect(await store.read('cache.books'), isNull);
    expect(
      File('${temp.path}/local_store/cache.books.json').existsSync(),
      isFalse,
    );
  });

  test('keys by prefix, delete, clearAll', () async {
    await store.write('cache.books', 1);
    await store.write('cache.subjects', 2);
    await store.write('niro-history', 3);
    expect((await store.keys('cache.'))..sort(), [
      'cache.books',
      'cache.subjects',
    ]);
    await store.delete('cache.books');
    expect(await store.read('cache.books'), isNull);
    await store.clearAll();
    expect(await store.read('niro-history'), isNull);
    expect(await store.keys(''), isEmpty);
  });

  test('keys that could escape the folder are refused', () async {
    expect(() => store.write('../x', 1), throwsArgumentError);
    expect(() => store.read('a/b'), throwsArgumentError);
  });
}
