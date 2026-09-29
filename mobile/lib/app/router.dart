import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/auth/session_controller.dart';
import '../core/ui/ui.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/register_screen.dart';
import '../features/auth/presentation/welcome_screen.dart';
import '../l10n/app_localizations.dart';
import 'dev/component_gallery.dart';
import 'placeholder_screen.dart';
import 'routes.dart';

export 'routes.dart';

/// Where a session state may be, given where it is headed. Pure, so the
/// redirect rules are unit-tested without a widget tree.
String? sessionRedirect(SessionState session, String location) {
  // The gallery is a developer tool with no data: reachable in any state.
  if (kDebugMode && location == Routes.gallery) return null;
  switch (session.status) {
    case SessionStatus.restoring:
      return location == Routes.splash ? null : Routes.splash;
    case SessionStatus.signedOut:
      return Routes.authFlow.contains(location) ? null : Routes.welcome;
    case SessionStatus.signedIn:
      final leaving =
          location == Routes.splash || Routes.authFlow.contains(location);
      return leaving ? Routes.home : null;
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  // Re-run redirects whenever the session changes.
  final refresh = ValueNotifier<SessionState>(
    ref.read(sessionControllerProvider),
  );
  ref.listen(sessionControllerProvider, (_, next) => refresh.value = next);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect: (context, state) => sessionRedirect(
      ref.read(sessionControllerProvider),
      state.matchedLocation,
    ),
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.welcome, builder: (_, _) => const WelcomeScreen()),
      GoRoute(path: Routes.login, builder: (_, _) => const LoginScreen()),
      GoRoute(path: Routes.register, builder: (_, _) => const RegisterScreen()),
      if (kDebugMode)
        GoRoute(
          path: Routes.gallery,
          builder: (_, _) => const ComponentGalleryScreen(),
        ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => MainShell(shell: shell),
        branches: [
          _tab(Routes.home, (l) => l.tabHome, 'P5'),
          _tab(Routes.games, (l) => l.tabGames, 'P12'),
          _tab(Routes.assistant, (l) => l.tabNiro, 'P10'),
          _tab(Routes.account, (l) => l.tabAccount, 'P5'),
        ],
      ),
    ],
  );
});

StatefulShellBranch _tab(
  String path,
  String Function(AppLocalizations) title,
  String phase,
) {
  return StatefulShellBranch(
    routes: [
      GoRoute(
        path: path,
        builder: (_, _) => PlaceholderScreen(title: title, phase: phase),
      ),
    ],
  );
}

/// Native splash hands over to this while the session is restored from
/// secure storage (no network) — usually a single frame. Same paper and
/// Spark as the native splash (flutter_native_splash), so nothing jumps.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: NlColors.paper,
      body: Center(
        child: Image(
          image: AssetImage('assets/brand/splash-mark.png'),
          width: 160,
          height: 160,
        ),
      ),
    );
  }
}

/// الرئيسية · ألعاب · ＋ · Niro · حسابي — the ＋ opens the add sheet
/// (phase 5); it is an action, not a tab.
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: shell,
      bottomNavigationBar: NlBottomNav(
        selectedIndex: shell.currentIndex,
        items: [
          NlNavItem(icon: LucideIcons.house, label: l10n.tabHome),
          NlNavItem(icon: LucideIcons.gamepad2, label: l10n.tabGames),
          NlNavItem(icon: LucideIcons.sparkles, label: l10n.tabNiro),
          NlNavItem(icon: LucideIcons.user, label: l10n.tabAccount),
        ],
        onSelected: (index) =>
            shell.goBranch(index, initialLocation: index == shell.currentIndex),
        addLabel: l10n.tabAdd,
        addIcon: LucideIcons.plus,
        onAdd: () => showNlToast(context, l10n.underConstruction('P5')),
      ),
    );
  }
}
