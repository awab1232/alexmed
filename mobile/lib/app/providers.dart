import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/http_client.dart';
import '../core/api/trpc_client.dart';
import '../core/auth/session_controller.dart';
import 'env.dart';

export '../core/auth/session_controller.dart'
    show sessionControllerProvider, sessionStoreProvider;

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
