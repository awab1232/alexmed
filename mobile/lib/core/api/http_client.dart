import 'package:dio/dio.dart';

import '../../app/env.dart';
import '../auth/session_store.dart';

/// Called when the server answers 401 to an authenticated request — the
/// session expired, or the account was suspended or deleted.
typedef OnSessionRejected = void Function();

/// One Dio instance for the NiroLearn API. The session travels as the
/// Auth.js cookie, so every existing route and tRPC procedure authorises the
/// app exactly like the web (no server change). Presigned R2 URLs must NOT
/// use this client — they are absolute URLs to another host and must never
/// carry the session (see [isApiUrl]).
Dio createApiDio({
  required AppEnv env,
  required SessionStore sessions,
  required OnSessionRejected onSessionRejected,
  HttpClientAdapter? adapter,
}) {
  final dio = Dio(
    BaseOptions(
      baseUrl: env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 60),
      // Error bodies carry the server's structured error; parse them
      // instead of throwing on status alone.
      validateStatus: (_) => true,
      headers: {'accept': 'application/json'},
    ),
  );
  if (adapter != null) dio.httpClientAdapter = adapter;
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final session = sessions.current;
        if (session != null && isApiUrl(env, options.uri)) {
          final name = session.cookieName ?? env.sessionCookieName;
          options.headers['cookie'] = '$name=${session.token}';
        }
        handler.next(options);
      },
      onResponse: (response, handler) {
        final sentSession = response.requestOptions.headers.containsKey(
          'cookie',
        );
        if (response.statusCode == 401 && sentSession) onSessionRejected();
        handler.next(response);
      },
    ),
  );
  return dio;
}

/// Only requests to the NiroLearn origin itself may carry the session.
bool isApiUrl(AppEnv env, Uri uri) {
  final api = Uri.parse(env.apiBaseUrl);
  return uri.scheme == api.scheme &&
      uri.host == api.host &&
      uri.port == api.port;
}
