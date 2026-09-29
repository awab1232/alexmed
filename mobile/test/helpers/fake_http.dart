import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:nirolearn/app/env.dart';
import 'package:nirolearn/core/auth/session_store.dart';

typedef Reply = ({int status, String body});

/// Records requests and answers with canned JSON — no network.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.respond);

  Reply Function(RequestOptions options, String body) respond;
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
    var body = '';
    if (requestStream != null) {
      final chunks = await requestStream.toList();
      body = utf8.decode(chunks.expand((c) => c).toList());
    }
    bodies.add(body);
    if (failWithSocketError) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'offline',
      );
    }
    final reply = respond(options, body);
    return ResponseBody.fromString(
      reply.body,
      reply.status,
      headers: {
        Headers.contentTypeHeader: ['application/json; charset=utf-8'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class MemorySessionStore extends SessionStore {
  MemorySessionStore([this._session]);
  StoredSession? _session;

  @override
  StoredSession? get current => _session;

  @override
  Future<StoredSession?> read() async => _session;

  @override
  Future<void> write(StoredSession session) async => _session = session;

  @override
  Future<void> clear() async => _session = null;
}

const testEnv = AppEnv(
  flavor: AppFlavor.staging,
  apiBaseUrl: 'https://api.example.test',
  sessionCookieName: '__Secure-authjs.session-token',
);
