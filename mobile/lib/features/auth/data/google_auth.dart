import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../app/providers.dart';

/// Why Google Sign-In gave no token.
enum GoogleAuthFailure {
  /// The student closed the account picker — not an error to show.
  canceled,

  /// Anything else: no Google account on the device, the OAuth clients
  /// misconfigured, Play services missing, no network.
  failed,
}

class GoogleAuthException implements Exception {
  const GoogleAuthException(this.failure, [this.detail]);

  final GoogleAuthFailure failure;
  final String? detail;

  @override
  String toString() => 'GoogleAuthException($failure, $detail)';
}

/// Gets a Google ID token for the NiroLearn server (POST
/// /api/mobile/auth/google). On Android the token is meant for the web
/// client named as serverClientId, and the Android client that asks for it
/// is picked by package + signing SHA-1 — no Firebase involved.
abstract interface class GoogleAuth {
  /// Whether this platform can offer the button at all.
  bool get available;

  Future<String> idToken();
}

class PluginGoogleAuth implements GoogleAuth {
  PluginGoogleAuth(this._serverClientId);

  final String? _serverClientId;
  Future<void>? _initialized;

  // Only Android has its OAuth client so far (iOS needs its own).
  @override
  bool get available =>
      _serverClientId != null &&
      !kIsWeb &&
      defaultTargetPlatform == TargetPlatform.android;

  @override
  Future<String> idToken() async {
    if (!available) {
      throw const GoogleAuthException(GoogleAuthFailure.failed, 'unavailable');
    }
    final google = GoogleSignIn.instance;
    try {
      await (_initialized ??= google.initialize(
        serverClientId: _serverClientId,
      ));
      // Forget the last pick so the student can choose another account.
      await google.signOut();
      final account = await google.authenticate();
      final token = account.authentication.idToken;
      if (token == null || token.isEmpty) {
        throw const GoogleAuthException(GoogleAuthFailure.failed, 'no token');
      }
      return token;
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled ||
          error.code == GoogleSignInExceptionCode.interrupted) {
        throw GoogleAuthException(GoogleAuthFailure.canceled, error.code.name);
      }
      debugPrint(
        'Google Sign-In failed: ${error.code.name} ${error.description}',
      );
      throw GoogleAuthException(
        GoogleAuthFailure.failed,
        '${error.code.name}: ${error.description}',
      );
    }
  }
}

final googleAuthProvider = Provider<GoogleAuth>(
  (ref) => PluginGoogleAuth(ref.watch(envProvider).googleServerClientId),
);
