import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/env.dart';
import 'app/providers.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // P16.3: bound the decoded-image cache below Flutter's 1000-image / 100 MB
  // defaults, so a long study session on a low-end device doesn't let page and
  // question images grow unbounded. PDF bytes already have their own bounded
  // in-memory LRU (PdfRangeSource).
  PaintingBinding.instance.imageCache.maximumSize = 200;
  PaintingBinding.instance.imageCache.maximumSizeBytes = 64 * 1024 * 1024;
  final env = AppEnv.fromDefines();
  runApp(
    ProviderScope(
      retry: noAutomaticRetry,
      overrides: [envProvider.overrideWithValue(env)],
      child: const NiroLearnApp(),
    ),
  );
}
