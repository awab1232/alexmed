import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/offline/offline_shell.dart';
import '../core/storage/local_store.dart';
import '../core/ui/theme.dart';
import '../features/auth/application/session_refresh.dart';
import '../l10n/app_localizations.dart';
import 'router.dart';

class NiroLearnApp extends ConsumerWidget {
  const NiroLearnApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Keeps the session fresh for as long as the app runs.
    ref.watch(sessionRefreshProvider);
    // Registers the on-device store's sign-out wipe from the first frame, so
    // it runs even when no screen has used the store in this launch.
    ref.watch(localStoreProvider);
    return MaterialApp.router(
      title: 'NiroLearn',
      debugShowCheckedModeBanner: false,
      routerConfig: ref.watch(routerProvider),
      // Arabic first (RTL), like the web app's <html lang="ar" dir="rtl">.
      locale: const Locale('ar'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      theme: buildNiroTheme(),
      // Offline banner + sending queued ratings (blueprint §14).
      builder: (context, child) =>
          OfflineShell(child: child ?? const SizedBox.shrink()),
    );
  }
}
