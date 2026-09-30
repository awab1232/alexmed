import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';
import 'package:nirolearn/l10n/app_localizations.dart';

import 'app_harness.dart';
import 'fake_http.dart';

/// Pumps one screen in the real theme / localisation with in-memory data.
/// Any other route it navigates to renders as `ROUTE <location>`, so tests
/// can assert where a tap leads. Returns the provider container.
Future<ProviderContainer> pumpOne(
  WidgetTester tester,
  Widget screen, {
  List<Override> overrides = const [],
  FakeLibraryRepository? library,
  FakeAccountRepository? account,
  Size size = const Size(412, 1400),
  Locale locale = const Locale('ar'),
}) async {
  tester.view.physicalSize = size * tester.view.devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => screen),
      GoRoute(
        path: '/:rest(.*)',
        builder: (_, state) => Scaffold(body: Text('ROUTE ${state.uri}')),
      ),
    ],
  );
  final container = ProviderContainer(
    retry: noAutomaticRetry,
    overrides: [
      envProvider.overrideWithValue(testEnv),
      sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
      libraryRepositoryProvider.overrideWithValue(
        library ?? FakeLibraryRepository(),
      ),
      accountRepositoryProvider.overrideWithValue(
        account ?? FakeAccountRepository(),
      ),
      ...overrides,
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        routerConfig: router,
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        theme: buildNiroTheme(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  return container;
}

/// Lets pending futures and a few frames run without waiting for endless
/// animations (spinners) to settle.
Future<void> pumpFrames(WidgetTester tester, [int count = 5]) async {
  for (var i = 0; i < count; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}
