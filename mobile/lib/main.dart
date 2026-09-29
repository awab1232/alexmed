import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/env.dart';
import 'app/providers.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final env = AppEnv.fromDefines();
  runApp(
    ProviderScope(
      retry: noAutomaticRetry,
      overrides: [envProvider.overrideWithValue(env)],
      child: const NiroLearnApp(),
    ),
  );
}
