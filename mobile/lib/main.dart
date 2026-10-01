import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/env.dart';
import 'app/providers.dart';
import 'core/ui/tokens.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // P16.3: bound the decoded-image cache below Flutter's 1000-image / 100 MB
  // defaults, so a long study session on a low-end device doesn't let page and
  // question images grow unbounded. PDF bytes already have their own bounded
  // in-memory LRU (PdfRangeSource).
  PaintingBinding.instance.imageCache.maximumSize = 200;
  PaintingBinding.instance.imageCache.maximumSizeBytes = 64 * 1024 * 1024;

  // P17.2: edge-to-edge — content flows behind the system bars. Already the
  // rule on Android 15+ (targetSdk 36); opting in keeps API 34 consistent and
  // lets Scaffold/SafeArea own the insets everywhere.
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

  // P17.1: theme the system bars to the light "paper" surface (dark icons),
  // matching the web's light theme. The bars are transparent in edge-to-edge,
  // so the icon brightness and divider are what actually show.
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.dark,
      systemNavigationBarDividerColor: NlColors.rule,
    ),
  );

  final env = AppEnv.fromDefines();
  runApp(
    ProviderScope(
      retry: noAutomaticRetry,
      overrides: [envProvider.overrideWithValue(env)],
      child: const NiroLearnApp(),
    ),
  );
}
