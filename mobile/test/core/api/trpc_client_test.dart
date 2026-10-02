import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/app/env.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/api/http_client.dart';
import 'package:nirolearn/core/api/trpc_client.dart';
import 'package:nirolearn/core/auth/session_store.dart';

/// Records requests and answers with canned responses — no network.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.respond);

  final ({int status, String body}) Function(RequestOptions) respond;
  final requests = <RequestOptions>[];
  final bodies = <String>[];
  bool failWithSocketError = false;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (requestStream != null) {
      final chunks = await requestStream.toList();
      bodies.add(utf8.decode(chunks.expand((c) => c).toList()));
    }
    if (failWithSocketError) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'offline',
      );
    }
    final reply = respond(options);
    return ResponseBody.fromString(
      reply.body,
      reply.status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class MemorySessionStore extends SessionStore {
  MemorySessionStore(this._session);
  final StoredSession? _session;
  @override
  StoredSession? get current => _session;
}

const env = AppEnv(
  flavor: AppFlavor.staging,
  apiBaseUrl: 'https://api.example.test',
  sessionCookieName: '__Secure-authjs.session-token',
);

// Real production envelopes, captured 2026-09-29 (read-only, signed out).
const unauthorizedBody =
    '{"error":{"json":{"message":"Please login (10001)","code":-32001,'
    '"data":{"code":"UNAUTHORIZED","httpStatus":401,"path":"subjects.list",'
    '"stack":null,"billing":null}},"meta":{"values":{"data.stack":["undefined"]}}}}';

void main() {
  late FakeAdapter adapter;
  var rejected = 0;

  TrpcClient client({StoredSession? session}) {
    rejected = 0;
    final dio = createApiDio(
      env: env,
      sessions: MemorySessionStore(session),
      onSessionRejected: () => rejected++,
      adapter: adapter,
    );
    return TrpcClient(dio);
  }

  final session = StoredSession(
    token: 'jwe-token',
    expiresAt: DateTime.utc(2030),
  );

  test(
    'query: GET with superjson input, decodes Dates in the result',
    () async {
      adapter = FakeAdapter(
        (_) => (
          status: 200,
          body:
              '{"result":{"data":{"json":[{"id":"s1","createdAt":"2026-09-01T00:00:00.000Z"}],'
              '"meta":{"values":{"0.createdAt":["Date"]}}}}}',
        ),
      );
      final result = await client(session: session).query(
        'subjects.list',
        input: {'q': 'x'},
        parse: (data) => data! as List,
      );
      final request = adapter.requests.single;
      expect(request.method, 'GET');
      expect(request.uri.path, '/api/trpc/subjects.list');
      expect(jsonDecode(request.uri.queryParameters['input']!), {
        'json': {'q': 'x'},
      });
      expect((result.single as Map)['createdAt'], DateTime.utc(2026, 9, 1));
    },
  );

  test('query without input sends no input parameter', () async {
    adapter = FakeAdapter(
      (_) => (status: 200, body: '{"result":{"data":{"json":null}}}'),
    );
    final result = await client().query('auth.me', parse: (d) => d);
    expect(result, isNull);
    expect(adapter.requests.single.uri.queryParameters, isEmpty);
  });

  test('mutation: POST with {"json": input}', () async {
    adapter = FakeAdapter(
      (_) => (status: 200, body: '{"result":{"data":{"json":{"id":"new"}}}}'),
    );
    final result = await client(session: session).mutation(
      'subjects.create',
      input: {'name': 'تشريح'},
      parse: (d) => (d! as Map)['id'],
    );
    expect(adapter.requests.single.method, 'POST');
    expect(jsonDecode(adapter.bodies.single), {
      'json': {'name': 'تشريح'},
    });
    expect(result, 'new');
  });

  test(
    'session is sent as the Auth.js cookie, only to the API origin',
    () async {
      adapter = FakeAdapter(
        (_) => (status: 200, body: '{"result":{"data":{"json":null}}}'),
      );
      final dio = createApiDio(
        env: env,
        sessions: MemorySessionStore(session),
        onSessionRejected: () {},
        adapter: adapter,
      );
      await TrpcClient(dio).query('auth.me', parse: (d) => d);
      expect(
        adapter.requests.last.headers['cookie'],
        '__Secure-authjs.session-token=jwe-token',
      );
      // A presigned storage URL (another host) never gets the session.
      await dio.get<Object?>('https://bucket.r2.example/upload?sig=1');
      expect(adapter.requests.last.headers.containsKey('cookie'), isFalse);
    },
  );

  test(
    '401 with a session → UnauthorizedException + session rejected',
    () async {
      adapter = FakeAdapter((_) => (status: 401, body: unauthorizedBody));
      final trpc = client(session: session);
      await expectLater(
        trpc.query('subjects.list', parse: (d) => d),
        throwsA(isA<UnauthorizedException>()),
      );
      expect(rejected, 1);
    },
  );

  test('401 while signed out does not fire "session rejected"', () async {
    adapter = FakeAdapter((_) => (status: 401, body: unauthorizedBody));
    await expectLater(
      client().query('subjects.list', parse: (d) => d),
      throwsA(isA<UnauthorizedException>()),
    );
    expect(rejected, 0);
  });

  test('billing error → PlanLimitException with details', () async {
    adapter = FakeAdapter(
      (_) => (
        status: 429,
        body:
            '{"error":{"json":{"message":"وصلت للحد اليومي","code":-32029,'
            '"data":{"code":"TOO_MANY_REQUESTS","httpStatus":429,'
            '"billing":{"code":"PLAN_LIMIT_REACHED","planId":"free","planName":"Free",'
            '"resource":"ai_requests","limit":20,"used":20}}}}}',
      ),
    );
    final error = await client(session: session)
        .mutation('books.explainCard', input: {'id': 'c'}, parse: (d) => d)
        .then<Object?>((_) => null, onError: (Object e) => e);
    expect(error, isA<PlanLimitException>());
    final details = (error! as PlanLimitException).details;
    expect(details.code, 'PLAN_LIMIT_REACHED');
    expect(details.limit, 20);
    expect(details.title, 'وصلت للحد اليومي');
  });

  test(
    'Arabic server message is kept; English dev message is not shown',
    () async {
      adapter = FakeAdapter(
        (_) => (
          status: 400,
          body:
              '{"error":{"json":{"message":"للتأكيد اكتب كلمة «حذف».","code":-32600,'
              '"data":{"code":"BAD_REQUEST","httpStatus":400}}}}',
        ),
      );
      await expectLater(
        client(session: session)
            .mutation('auth.deleteAccount', parse: (d) => d),
        throwsA(
          isA<RejectedException>().having(
            (e) => e.message,
            'message',
            'للتأكيد اكتب كلمة «حذف».',
          ),
        ),
      );

      adapter = FakeAdapter(
        (_) => (
          status: 400,
          body:
              '{"error":{"json":{"message":"Expected string, received number","code":-32600,'
              '"data":{"code":"BAD_REQUEST","httpStatus":400}}}}',
        ),
      );
      await expectLater(
        client(session: session).mutation('x.y', parse: (d) => d),
        throwsA(
          isA<RejectedException>().having(
            (e) => e.message,
            'message',
            'تعذّر تنفيذ الطلب.',
          ),
        ),
      );
    },
  );

  test('connection failure → NetworkException', () async {
    adapter = FakeAdapter((_) => (status: 200, body: '{}'))
      ..failWithSocketError = true;
    await expectLater(
      client().query('auth.me', parse: (d) => d),
      throwsA(isA<NetworkException>()),
    );
  });

  test('unexpected shape → ServerException, never a crash', () async {
    adapter = FakeAdapter(
      (_) => (status: 502, body: '<html>Bad gateway</html>'),
    );
    await expectLater(
      client().query('auth.me', parse: (d) => d),
      throwsA(isA<ServerException>()),
    );

    adapter = FakeAdapter(
      (_) => (status: 200, body: '{"result":{"data":{"json":{"a":1}}}}'),
    );
    await expectLater(
      client().query('auth.me', parse: (d) => (d! as List).length),
      throwsA(isA<ServerException>()),
    );
  });

  test('REST error bodies map the same way', () {
    expect(
      apiExceptionFromRest(413, {
        'error': 'الملف أكبر من حد باقتك',
        'code': 'FILE_SIZE_LIMIT',
        'details': {
          'code': 'FILE_SIZE_LIMIT',
          'planName': 'Free',
          'maxFileSizeMb': 20,
          'actualFileSizeMb': 55,
        },
      }),
      isA<PlanLimitException>(),
    );
    expect(apiExceptionFromRest(401, null), isA<UnauthorizedException>());
    expect(
      apiExceptionFromRest(400, {'error': 'اختَر ملف PDF فقط.'}).message,
      'اختَر ملف PDF فقط.',
    );
    expect(apiExceptionFromRest(500, null), isA<ServerException>());
  });

  test('transport failures: network vs server', () {
    final options = RequestOptions(path: '/x');
    DioException dio(DioExceptionType type, [Object? cause]) =>
        DioException(requestOptions: options, type: type, error: cause);
    expect(
      apiExceptionFromDio(dio(DioExceptionType.connectionTimeout)),
      isA<NetworkException>(),
    );
    expect(
      apiExceptionFromDio(
        dio(
          DioExceptionType.unknown,
          const SocketException('Failed host lookup'),
        ),
      ),
      isA<NetworkException>(),
    );
    expect(
      apiExceptionFromDio(dio(DioExceptionType.badCertificate)),
      isA<NetworkException>(),
    );
    expect(
      apiExceptionFromDio(
        dio(DioExceptionType.unknown, const FormatException('bad json')),
      ),
      isA<ServerException>(),
    );
  });
}
