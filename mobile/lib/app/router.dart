import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/auth/session_controller.dart';
import '../core/ui/ui.dart';
import '../features/account/presentation/account_screen.dart';
import '../features/account/presentation/plan_screen.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/register_screen.dart';
import '../features/auth/presentation/welcome_screen.dart';
import '../features/library/presentation/add_sheet.dart';
import '../features/library/presentation/folder_screen.dart';
import '../features/library/presentation/home_screen.dart';
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
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.home,
                builder: (_, _) => const HomeScreen(),
                routes: [
                  GoRoute(
                    path: 'folders/:id',
                    builder: (_, state) =>
                        FolderScreen(subjectId: state.pathParameters['id']!),
                  ),
                ],
              ),
            ],
          ),
          _placeholderTab(Routes.games, (l) => l.tabGames, 'P12'),
          _placeholderTab(Routes.assistant, (l) => l.tabNiro, 'P10'),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.account,
                builder: (_, _) => const AccountScreen(),
                routes: [
                  GoRoute(path: 'plan', builder: (_, _) => const PlanScreen()),
                  _placeholder('stats', (l) => l.statsRow, 'P7'),
                  _placeholder('doctor', (l) => l.doctorApply, 'P11'),
                ],
              ),
            ],
          ),
        ],
      ),
      // Screens of later phases — full-screen over the tabs.
      _placeholder('/books/:id', (l) => l.yourBooks, 'P7'),
      _placeholder('/decks/:id', (l) => l.questionFileBadge, 'P9'),
      _placeholder(Routes.review, (l) => l.nextDueAction, 'P7'),
      _placeholder(Routes.questionFiles, (l) => l.questionFilesRow, 'P9'),
      _placeholder(Routes.uploadBook, (l) => l.addBook, 'P6'),
      _placeholder(Routes.uploadQuestionFile, (l) => l.addQuestionFile, 'P9'),
      _placeholder(Routes.shared, (l) => l.sharedWithMe, 'P13'),
      _placeholder(Routes.redeemCode, (l) => l.addDoctorCode, 'P11'),
      _placeholder(Routes.doctor, (l) => l.doctorDashboard, 'P11'),
    ],
  );
});

GoRoute _placeholder(
  String path,
  String Function(AppLocalizations) title,
  String phase,
) => GoRoute(
  path: path,
  builder: (_, _) => PlaceholderScreen(title: title, phase: phase),
);

StatefulShellBranch _placeholderTab(
  String path,
  String Function(AppLocalizations) title,
  String phase,
) => StatefulShellBranch(routes: [_placeholder(path, title, phase)]);

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

/// الرئيسية · ألعاب · ＋ · Niro · حسابي — the ＋ opens the add sheet; it is
/// an action, not a tab.
///
/// System back (blueprint §5): pages inside a tab pop first (go_router);
/// at another tab's root, back returns to الرئيسية; at الرئيسية's root it
/// leaves the app.
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final atOtherTabRoot =
        shell.currentIndex != 0 && !GoRouter.of(context).canPop();
    return PopScope(
      canPop: !atOtherTabRoot,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && atOtherTabRoot) shell.goBranch(0);
      },
      child: _shellScaffold(context, l10n),
    );
  }

  Widget _shellScaffold(BuildContext context, AppLocalizations l10n) {
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
        onAdd: () => showAddSheet(context),
      ),
    );
  }
}
