import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/auth/session_controller.dart';
import '../core/ui/ui.dart';
import '../features/account/presentation/account_screen.dart';
import '../features/account/presentation/plan_screen.dart';
import '../features/assistant/presentation/assistant_screen.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/register_screen.dart';
import '../features/auth/presentation/welcome_screen.dart';
import '../features/books/presentation/book_screen.dart';
import '../features/books/presentation/book_upload_screen.dart';
import '../features/doctor_sets/presentation/doctor_screens.dart';
import '../features/doctor_sets/presentation/doctor_set_screen.dart';
import '../features/doctor_sets/presentation/protected_set_screen.dart';
import '../features/doctor_sets/presentation/question_sets_screen.dart';
import '../features/exam_focus/presentation/exam_focus_screen.dart';
import '../features/games/presentation/games_screen.dart';
import '../features/games/presentation/play_screen.dart';
import '../features/library/presentation/add_sheet.dart';
import '../features/library/presentation/folder_screen.dart';
import '../features/library/presentation/home_screen.dart';
import '../features/match/presentation/match_screen.dart';
import '../features/mindmap/presentation/mindmap_screen.dart';
import '../features/mirror/presentation/mirror_deck_screen.dart';
import '../features/mirror/presentation/mirror_job_screen.dart';
import '../features/mirror/presentation/mirror_library_screen.dart';
import '../features/mirror/presentation/mirror_start_screen.dart';
import '../features/progress/presentation/progress_screens.dart';
import '../features/progress/presentation/review_screen.dart';
import '../features/question_files/presentation/question_file_screen.dart';
import '../features/question_files/presentation/question_files_screen.dart';
import '../features/reader/presentation/reader_screen.dart';
import '../features/study/data/study_models.dart';
import '../features/study/presentation/study_screen.dart';
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
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.games,
                builder: (_, _) => const GamesScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (_, state) =>
                        GameScreen(gameId: state.pathParameters['id']!),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.assistant,
                builder: (_, _) => const AssistantScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.account,
                builder: (_, _) => const AccountScreen(),
                routes: [
                  GoRoute(path: 'plan', builder: (_, _) => const PlanScreen()),
                  GoRoute(
                    path: 'stats',
                    builder: (_, _) => const StatsScreen(),
                  ),
                  GoRoute(
                    path: 'doctor',
                    builder: (_, _) => const DoctorApplyScreen(),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      // Full-screen over the tabs. The fixed /books/question-files paths come
      // before /books/:id, which would otherwise take "question-files" as an id.
      GoRoute(
        path: Routes.questionBanks,
        builder: (_, _) => const QuestionFilesScreen(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (_, state) =>
                QuestionFileScreen(fileId: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(
        path: '/books/:id',
        builder: (_, state) => BookScreen(bookId: state.pathParameters['id']!),
        routes: [
          GoRoute(
            path: 'study',
            builder: (_, state) => StudyScreen(
              bookId: state.pathParameters['id']!,
              tool: StudyTool.parse(state.uri.queryParameters['tool']),
            ),
          ),
          GoRoute(
            path: 'mindmap',
            builder: (_, state) =>
                MindMapScreen(bookId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: 'match',
            builder: (_, state) =>
                MatchScreen(bookId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: 'exam-focus',
            builder: (_, state) =>
                ExamFocusScreen(bookId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: 'read',
            builder: (_, state) => ReaderScreen(
              bookId: state.pathParameters['id']!,
              initialPage: int.tryParse(
                state.uri.queryParameters['page'] ?? '',
              ),
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/decks/:id',
        builder: (_, state) =>
            MirrorDeckScreen(deckId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/mirror/jobs/:id',
        builder: (_, state) => MirrorJobScreen(
          jobId: state.pathParameters['id']!,
          detailsOnly: state.uri.queryParameters['details'] == '1',
        ),
      ),
      GoRoute(
        path: '/play/:id',
        builder: (_, state) => PlayScreen(
          gameId: state.pathParameters['id']!,
          stage: int.tryParse(state.uri.queryParameters['stage'] ?? '') ?? 1,
        ),
      ),
      GoRoute(path: Routes.review, builder: (_, _) => const ReviewScreen()),
      GoRoute(
        path: Routes.weakPoints,
        builder: (_, _) => const WeakPointsScreen(),
      ),
      GoRoute(path: Routes.today, builder: (_, _) => const TodayScreen()),
      GoRoute(
        path: Routes.questionFiles,
        builder: (_, _) => const MirrorLibraryScreen(),
      ),
      GoRoute(
        path: Routes.uploadBook,
        builder: (_, state) => BookUploadScreen(
          subjectId: state.uri.queryParameters['subjectId'],
          questionFile: state.uri.queryParameters['kind'] == 'questions',
        ),
      ),
      GoRoute(
        path: Routes.uploadQuestionFile,
        builder: (_, state) => MirrorStartScreen(
          appendToDeckId: state.uri.queryParameters['deck'],
        ),
      ),
      _placeholder(Routes.shared, (l) => l.sharedWithMe, 'P13'),
      // Fixed paths before the :id ones.
      GoRoute(
        path: Routes.questionSets,
        builder: (_, _) => const QuestionSetsScreen(),
        routes: [
          GoRoute(
            path: 'redeem',
            builder: (_, _) => const QuestionSetsScreen(focusCode: true),
          ),
          GoRoute(
            path: ':id',
            builder: (_, state) =>
                ProtectedSetScreen(setId: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(
        path: Routes.doctor,
        builder: (_, _) => const DoctorDashboardScreen(),
        routes: [
          GoRoute(
            path: 'sets/new',
            builder: (_, _) => const DoctorNewSetScreen(),
          ),
          GoRoute(
            path: 'sets/:id',
            builder: (_, state) =>
                DoctorSetScreen(setId: state.pathParameters['id']!),
          ),
        ],
      ),
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
