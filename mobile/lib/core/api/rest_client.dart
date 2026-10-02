import 'package:dio/dio.dart';

import 'api_error.dart';
import 'trpc_client.dart' show apiExceptionFromDio;

/// The web's REST routes (upload URLs, pipelines, phone sign-up): JSON in,
/// JSON out, errors as `{error, code, details}` → [ApiException].
class RestClient {
  RestClient(this._dio);

  final Dio _dio;

  Future<Map<String, Object?>> postJson(
    String path,
    Map<String, Object?> body, {
    CancelToken? cancelToken,
  }) async {
    final Response<Object?> response;
    try {
      response = await _dio.post<Object?>(
        path,
        data: body,
        options: Options(contentType: 'application/json'),
        cancelToken: cancelToken,
      );
    } on DioException catch (error) {
      if (error.type == DioExceptionType.cancel) rethrow;
      throw apiExceptionFromDio(error);
    }
    final status = response.statusCode ?? 0;
    final data = response.data is Map
        ? (response.data! as Map).cast<String, Object?>()
        : null;
    if (status >= 200 && status < 300) return data ?? const {};
    throw apiExceptionFromRest(status, data);
  }
}
