import 'dart:convert';

import 'package:dio/dio.dart';

import 'api_error.dart';
import 'trpc_client.dart' show apiExceptionFromDio;

/// POSTs JSON to a streaming AI route (`/api/assistant/chat`,
/// `/api/chat/stream`, `/api/books/ask-selection` — `text/plain`, chunked)
/// and yields the answer accumulated so far, chunk by chunk. Error bodies
/// (`{error, code, details}`) become an [ApiException] with the server's
/// Arabic message. Cancelling [cancelToken] stops the request.
Stream<String> streamTextAnswer(
  Dio dio,
  String path,
  Map<String, Object?> body, {
  CancelToken? cancelToken,
}) async* {
  final Response<ResponseBody> response;
  try {
    response = await dio.post<ResponseBody>(
      path,
      data: body,
      cancelToken: cancelToken,
      options: Options(
        responseType: ResponseType.stream,
        validateStatus: (_) => true,
        // An AI answer can take a while to start (vision model, queue).
        receiveTimeout: const Duration(seconds: 120),
      ),
    );
  } on DioException catch (error) {
    if (error.type == DioExceptionType.cancel) rethrow;
    throw apiExceptionFromDio(error);
  }
  final status = response.statusCode ?? 0;
  final stream = response.data?.stream;
  if (stream == null) throw const ServerException();
  if (status < 200 || status >= 300) {
    final text = await utf8.decodeStream(stream).catchError((_) => '');
    Object? json;
    try {
      json = jsonDecode(text);
    } catch (_) {}
    throw apiExceptionFromRest(status, json);
  }
  const decoder = Utf8Decoder(allowMalformed: true);
  var answer = '';
  await for (final chunk in stream.cast<List<int>>().transform(decoder)) {
    answer += chunk;
    yield answer;
  }
}
