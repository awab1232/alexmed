import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// The signed-in session: the same encrypted Auth.js session token the web
// keeps in its cookie (docs/mobile/MOBILE_ARCHITECTURE_BLUEPRINT.md §9).
// Kept in the Keychain (this device only, never in backups) / Android
// Keystore-backed storage — never in plain preferences, never logged.

final class StoredSession {
  const StoredSession({
    required this.token,
    required this.expiresAt,
    this.cookieName,
  });

  final String token;
  final DateTime expiresAt;

  /// The cookie name the server issued the token for (it is also the
  /// token's encryption salt). Null for sessions stored before the server
  /// said — the build's default name is used then.
  final String? cookieName;

  bool isExpiredAt(DateTime now) => !now.isBefore(expiresAt);

  /// Worth refreshing (G4) once fewer than 7 days remain.
  bool needsRefreshAt(DateTime now) =>
      expiresAt.difference(now) < const Duration(days: 7);
}

class SessionStore {
  SessionStore([FlutterSecureStorage? storage])
    : _storage =
          storage ??
          const FlutterSecureStorage(
            iOptions: IOSOptions(
              accessibility: KeychainAccessibility.first_unlock_this_device,
            ),
          );

  static const _tokenKey = 'nl.session.token';
  static const _expiresKey = 'nl.session.expiresAt';
  static const _cookieKey = 'nl.session.cookieName';

  final FlutterSecureStorage _storage;
  StoredSession? _cached;
  bool _loaded = false;

  /// The current session, read from secure storage once per launch.
  Future<StoredSession?> read() async {
    if (_loaded) return _cached;
    final token = await _storage.read(key: _tokenKey);
    final expires = await _storage.read(key: _expiresKey);
    final cookieName = await _storage.read(key: _cookieKey);
    final expiresAt = expires == null ? null : DateTime.tryParse(expires);
    _cached = token != null && token.isNotEmpty && expiresAt != null
        ? StoredSession(
            token: token,
            expiresAt: expiresAt.toUtc(),
            cookieName: cookieName,
          )
        : null;
    _loaded = true;
    return _cached;
  }

  /// Synchronous access for request interceptors (after [read]).
  StoredSession? get current => _cached;

  Future<void> write(StoredSession session) async {
    await _storage.write(key: _tokenKey, value: session.token);
    await _storage.write(
      key: _expiresKey,
      value: session.expiresAt.toUtc().toIso8601String(),
    );
    if (session.cookieName != null) {
      await _storage.write(key: _cookieKey, value: session.cookieName);
    } else {
      await _storage.delete(key: _cookieKey);
    }
    _cached = session;
    _loaded = true;
  }

  Future<void> clear() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _expiresKey);
    await _storage.delete(key: _cookieKey);
    _cached = null;
    _loaded = true;
  }
}
