import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/http_client.dart';
import '../core/api/trpc_client.dart';
import '../core/auth/session_controller.dart';
import 'env.dart';

export '../core/auth/session_controller.dart'
    show sessionControllerProvider, sessionStoreProvider;

/// Riverpod 3 retries failed providers automatically (up to 10 times with
/// backoff). The app doesn't want that: a failure shows its reason and a
/// retry button (NlErrorView), a 401 must end the session once — not ten
/// times — and silent retries multiply server load exactly when it is
/// struggling. Used by the root ProviderScope (and the tests' harness).
Duration? noAutomaticRetry(int retryCount, Object error) => null;

/// Overridden in main() with the build's configuration.
final envProvider = Provider<AppEnv>(
  (ref) => throw UnimplementedError('envProvider must be overridden'),
);

final dioProvider = Provider<Dio>((ref) {
  return createApiDio(
    env: ref.watch(envProvider),
    sessions: ref.watch(sessionStoreProvider),
    onSessionRejected: () =>
        ref.read(sessionControllerProvider.notifier).onServerRejected(),
  );
});

final trpcProvider = Provider<TrpcClient>(
  (ref) => TrpcClient(ref.watch(dioProvider)),
);
