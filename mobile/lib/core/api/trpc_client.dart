import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';

import '../offline/offline.dart';
import 'api_error.dart';
import 'superjson.dart';

/// tRPC 11 over plain HTTP (the server's `/api/trpc` fetch adapter, with the
/// superjson transformer) — docs/mobile/MOBILE_ARCHITECTURE_BLUEPRINT.md §3.4.
///
/// ```text
/// query     GET  /api/trpc/PATH?input=urlencoded({"json": …})
/// mutation  POST /api/trpc/PATH   body {"json": …}
/// success   {"result": {"data": {"json": …, "meta": …}}}
/// error     {"error":  {"json": {message, code, data}, "meta": …}}
/// ```
///
/// Calls are never batched, so each failure stays attached to its call.
///
/// Offline (blueprint §14): a query marked [query]'s `offline` keeps its
/// last answer in [cache] and falls back to it when the network is
/// unreachable; a mutation marked `queueOffline` is kept in [queue] and
/// sent later. [onReachability] learns from every request whether the
/// server could be reached. Protected content never opts in.
class TrpcClient {
  TrpcClient(this._dio, {this.cache, this.queue, this.onReachability});

  final Dio _dio;
  final QueryCache? cache;
  final SyncQueue? queue;
  final void Function(bool reachable)? onReachability;

  Future<T> query<T>(
    String path, {
    Object? input,
    required T Function(Object? data) parse,
    CancelToken? cancelToken,
    bool offline = false,
  }) async {
    final encoded = input == null ? null : jsonEncode(superjsonEncode(input));
    final query = encoded == null ? null : {'input': encoded};
    final key = offline && cache != null
        ? QueryCache.keyFor(path, encoded)
        : null;
    try {
      return await _send(
        () => _dio.get<Object?>(
          '/api/trpc/$path',
          queryParameters: query,
          cancelToken: cancelToken,
        ),
        parse,
        cacheKey: key,
      );
    } on NetworkException {
      if (key == null) rethrow;
      final cached = await cache!.read(key);
      if (cached == null) rethrow;
      try {
        return parse(superjsonDecode(cached['json'], cached['meta']));
      } catch (_) {
        throw const NetworkException();
      }
    }
  }

  Future<T> mutation<T>(
    String path, {
    Object? input,
    required T Function(Object? data) parse,
    CancelToken? cancelToken,
    bool queueOffline = false,
  }) async {
    try {
      return await _send(
        () => _dio.post<Object?>(
          '/api/trpc/$path',
          data: jsonEncode(superjsonEncode(input)),
          options: Options(contentType: 'application/json'),
          cancelToken: cancelToken,
        ),
        parse,
      );
    } on NetworkException {
      if (!queueOffline || queue == null) rethrow;
      await queue!.add(
        QueuedCall(path: path, input: input, at: DateTime.now().toUtc()),
      );
      return parse(null);
    }
  }

  /// Sends what [queue] holds (see [SyncQueue.flush]).
  Future<int> flushQueue() async {
    final q = queue;
    if (q == null) return 0;
    return q.flush(
      (call) => mutation<void>(call.path, input: call.input, parse: (_) {}),
      (error) => error is NetworkException,
    );
  }

  Future<T> _send<T>(
    Future<Response<Object?>> Function() request,
    T Function(Object? data) parse, {
    String? cacheKey,
  }) async {
    final Response<Object?> response;
    try {
      response = await request();
    } on DioException catch (error) {
      if (error.type == DioExceptionType.cancel) rethrow;
      final mapped = apiExceptionFromDio(error);
      if (mapped is NetworkException) onReachability?.call(false);
      throw mapped;
    }
    onReachability?.call(true);
    final body = _asMap(response.data);
    if (body == null) throw const ServerException();

    final error = _asMap(body['error']);
    if (error != null) {
      final decoded = superjsonDecode(error['json'], error['meta']);
      throw apiExceptionFromTrpc(
        _asMap(decoded) ?? const {},
        response.statusCode,
      );
    }
    final data = _asMap(_asMap(body['result'])?['data']);
    if (data == null) throw const ServerException();
    if (cacheKey != null) unawaited(cache!.write(cacheKey, data));
    try {
      return parse(superjsonDecode(data['json'], data['meta']));
    } on ApiException {
      rethrow;
    } catch (_) {
      // The response did not match what this app build expects (a server
      // contract change) — surfaced as a server error, never a crash.
      throw const ServerException();
    }
  }
}

/// A transport failure is "no connection" only when the network is the
/// cause; a response that arrived but could not be read (a proxy's HTML
/// error page, broken JSON) is a server problem — telling the student to
/// check their internet would be wrong.
ApiException apiExceptionFromDio(DioException error) {
  switch (error.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.connectionError:
    // Captive Wi-Fi portals and interception show up as a bad certificate.
    case DioExceptionType.badCertificate:
      return const NetworkException();
    case DioExceptionType.unknown:
      final cause = error.error;
      return cause is SocketException ||
              cause is HttpException ||
              cause is HandshakeException
          ? const NetworkException()
          : const ServerException();
    case DioExceptionType.badResponse:
    case DioExceptionType.transformTimeout:
    case DioExceptionType.cancel:
      return const ServerException();
  }
}

Map<String, Object?>? _asMap(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) return value.cast<String, Object?>();
  if (value is String && value.isNotEmpty) {
    try {
      final decoded = jsonDecode(value);
      return decoded is Map ? decoded.cast<String, Object?>() : null;
    } on FormatException {
      return null;
    }
  }
  return null;
}
