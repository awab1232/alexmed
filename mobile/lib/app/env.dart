// Build-time configuration, passed with
//   flutter run --dart-define-from-file=env/<flavor>.json
// Only public values belong here (API base URL, public client IDs, DSNs).
// Secrets — database, R2, AI keys, AUTH_SECRET — never reach the app.

enum AppFlavor { dev, staging, prod }

final class AppEnv {
  const AppEnv({
    required this.flavor,
    required this.apiBaseUrl,
    required this.sessionCookieName,
  });

  factory AppEnv.fromDefines() {
    const flavorName = String.fromEnvironment('APP_ENV', defaultValue: 'dev');
    const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
    const cookieName = String.fromEnvironment(
      'SESSION_COOKIE_NAME',
      // Auth.js' name on HTTPS deployments (production and staging).
      defaultValue: '__Secure-authjs.session-token',
    );
    final flavor = AppFlavor.values.firstWhere(
      (f) => f.name == flavorName,
      orElse: () => AppFlavor.dev,
    );
    if (apiBaseUrl.isEmpty) {
      throw StateError(
        'API_BASE_URL is not set. Run with '
        '--dart-define-from-file=env/${flavor.name}.json',
      );
    }
    final uri = Uri.parse(apiBaseUrl);
    // Tokens travel only over HTTPS (a local dev server is the exception).
    final isLocal = uri.host == 'localhost' || uri.host == '10.0.2.2';
    if (uri.scheme != 'https' && !isLocal) {
      throw StateError('API_BASE_URL must be https: $apiBaseUrl');
    }
    return AppEnv(
      flavor: flavor,
      apiBaseUrl: apiBaseUrl.replaceAll(RegExp(r'/+$'), ''),
      sessionCookieName: cookieName,
    );
  }

  final AppFlavor flavor;

  /// Origin of the NiroLearn web app, e.g. https://nirolearn.com (no slash).
  final String apiBaseUrl;

  /// The Auth.js session cookie the server reads (lib/auth.ts).
  final String sessionCookieName;
}
