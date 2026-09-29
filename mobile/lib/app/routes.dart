/// Route paths (blueprint §5). Tab roots mirror components/BottomNav.tsx.
/// Kept apart from the router so screens can navigate without importing it.
abstract final class Routes {
  static const splash = '/splash';
  static const welcome = '/welcome';
  static const login = '/login';
  static const register = '/register';
  static const home = '/home';
  static const games = '/games';
  static const assistant = '/assistant';
  static const account = '/account';

  /// Debug builds only — the design-system gallery.
  static const gallery = '/dev/gallery';

  static const authFlow = {welcome, login, register};
}
