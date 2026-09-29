import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';

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
class TrpcClient {
  TrpcClient(this._dio);

  final Dio _dio;

  Future<T> query<T>(
    String path, {
    Object? input,
    required T Function(Object? data) parse,
    CancelToken? cancelToken,
  }) async {
    final query = input == null
        ? null
        : {'input': jsonEncode(superjsonEncode(input))};
    return _send(
      () => _dio.get<Object?>(
        '/api/trpc/$path',
        queryParameters: query,
        cancelToken: cancelToken,
      ),
      parse,
    );
  }

  Future<T> mutation<T>(
    String path, {
    Object? input,
    required T Function(Object? data) parse,
    CancelToken? cancelToken,
  }) {
    return _send(
      () => _dio.post<Object?>(
        '/api/trpc/$path',
        data: jsonEncode(superjsonEncode(input)),
        options: Options(contentType: 'application/json'),
        cancelToken: cancelToken,
      ),
      parse,
    );
  }

  Future<T> _send<T>(
    Future<Response<Object?>> Function() request,
    T Function(Object? data) parse,
  ) async {
    final Response<Object?> response;
    try {
      response = await request();
    } on DioException catch (error) {
      if (error.type == DioExceptionType.cancel) rethrow;
      throw apiExceptionFromDio(error);
    }
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
