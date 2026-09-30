import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/api/api_image.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);
  final ResponseBody Function(RequestOptions) respond;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _bytes(List<int> data, {int status = 200}) =>
    ResponseBody.fromBytes(data, status);

void main() {
  late _Adapter api;
  late _Adapter storage;
  late ApiImageLoader loader;

  setUp(() {
    api = _Adapter((o) {
      if (o.path.startsWith('/api/files/')) {
        return ResponseBody.fromString(
          '',
          307,
          headers: {
            'location': ['https://storage.example.test/signed?sig=1'],
          },
        );
      }
      if (o.path.startsWith('/api/question-sets/')) return _bytes([9, 9]);
      return _bytes(const [], status: 404);
    });
    storage = _Adapter((_) => _bytes([1, 2, 3]));
    final apiDio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
      ..httpClientAdapter = api
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            o.headers['cookie'] = 'session=secret';
            h.next(o);
          },
        ),
      );
    loader = ApiImageLoader(
      api: apiDio,
      storage: Dio()..httpClientAdapter = storage,
    );
  });

  test(
    'reads the files redirect and fetches storage without the session',
    () async {
      final bytes = await loader.load('/api/files/users/u1/img.png');
      expect(bytes, [1, 2, 3]);
      expect(api.requests.single.followRedirects, isFalse);
      expect(storage.requests.single.uri.host, 'storage.example.test');
      expect(storage.requests.single.headers.containsKey('cookie'), isFalse);
    },
  );

  test('caches in memory; protected images are not cached', () async {
    await loader.load('/api/files/a.png');
    await loader.load('/api/files/a.png');
    expect(api.requests, hasLength(1));
    expect(loader.cachedBytes, 3);

    await loader.load('/api/question-sets/s1/images/i1', cache: false);
    await loader.load('/api/question-sets/s1/images/i1', cache: false);
    expect(api.requests, hasLength(3));
    expect(loader.cachedBytes, 3);

    loader.clear();
    expect(loader.cachedBytes, 0);
  });

  test('refuses anything that is not an API path', () async {
    await expectLater(
      loader.load('https://evil.example/x.png'),
      throwsA(isA<NotFoundException>()),
    );
    await expectLater(
      loader.load('//evil.example/x.png'),
      throwsA(isA<NotFoundException>()),
    );
    expect(api.requests, isEmpty);
  });

  test('a non-https redirect is refused', () async {
    api = _Adapter(
      (_) => ResponseBody.fromString(
        '',
        302,
        headers: {
          'location': ['http://storage.example.test/x'],
        },
      ),
    );
    loader = ApiImageLoader(
      api: Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..httpClientAdapter = api,
      storage: Dio()..httpClientAdapter = storage,
    );
    await expectLater(
      loader.load('/api/files/x.png'),
      throwsA(isA<ServerException>()),
    );
    expect(storage.requests, isEmpty);
  });

  test('404 → not found', () async {
    await expectLater(
      loader.load('/api/other/x.png'),
      throwsA(isA<NotFoundException>()),
    );
  });
}
