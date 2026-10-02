import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/trpc_client.dart' show apiExceptionFromDio;
import '../../../core/auth/session_store.dart';

/// A signed-in account as the login endpoint returns it.
final class AuthUser {
  const AuthUser({required this.id, required this.role, this.name, this.email});

  factory AuthUser.fromJson(Map<String, Object?> json) => AuthUser(
    id: json['id']! as String,
    role: json['role'] as String? ?? 'user',
    name: json['name'] as String?,
    email: json['email'] as String?,
  );

  final String id;
  final String role;
  final String? name;
  final String? email;
}

/// Step 1 of phone sign-up.
final class PhoneVerificationStarted {
  const PhoneVerificationStarted({
    required this.verificationId,
    required this.phone,
    required this.resendAfter,
  });

  final String verificationId;

  /// E.164, as the server normalised it.
  final String phone;
  final Duration resendAfter;
}

/// Sign-in, refresh and phone sign-up against the existing NiroLearn
/// endpoints (blueprint §9): `/api/mobile/auth/*` for sessions, and the
/// web's own `/api/phone-verification/*` + `/api/register` for sign-up.
/// Every failure is an [ApiException] whose message the server wrote in
/// Arabic for the student.
class AuthRepository {
  AuthRepository(this._dio);

  final Dio _dio;

  Future<({StoredSession session, AuthUser user})> login({
    required String identifier,
    required String password,
  }) async {
    final body = await _post(
      '/api/mobile/auth/login',
      {'identifier': identifier.trim(), 'password': password},
      // Here a 401 means "wrong phone/email or password", not an expired
      // session.
      unauthorized: (
        message: 'رقم الهاتف (أو البريد) أو كلمة المرور غير صحيحة.',
        code: 'invalid_credentials',
      ),
    );
    return (
      session: _sessionFrom(body),
      user: AuthUser.fromJson((body['user']! as Map).cast<String, Object?>()),
    );
  }

  /// Signs in (or signs up) with a Google ID token from [GoogleAuth], with
  /// the web's account rules: an existing email is linked (never refused) and
  /// a suspended account is blocked — as on the web (lib/auth.ts).
  Future<({StoredSession session, AuthUser user})> loginWithGoogle(
    String idToken,
  ) async {
    final body = await _post(
      '/api/mobile/auth/google',
      {'idToken': idToken},
      // A 401 here means Google's token was refused, not an expired session.
      unauthorized: (
        message: 'تعذّر التحقق من حساب Google. حاول مرة أخرى.',
        code: 'invalid_google_token',
      ),
    );
    return (
      session: _sessionFrom(body),
      user: AuthUser.fromJson((body['user']! as Map).cast<String, Object?>()),
    );
  }

  /// A fresh 30-day token for the current session. Throws
  /// [UnauthorizedException] when the server has ended the session.
  Future<StoredSession> refresh() async =>
      _sessionFrom(await _post('/api/mobile/auth/refresh', const {}));

  Future<PhoneVerificationStarted> startPhoneVerification({
    required String phone,
    required String country,
  }) async {
    final body = await _post('/api/phone-verification/start', {
      'phone': phone,
      'country': country,
    });
    final resend = body['resendAfterSeconds'];
    return PhoneVerificationStarted(
      verificationId: body['verificationId']! as String,
      phone: body['phone']! as String,
      resendAfter: Duration(seconds: resend is num ? resend.toInt() : 60),
    );
  }

  Future<void> checkPhoneCode({
    required String verificationId,
    required String code,
  }) => _post('/api/phone-verification/check', {
    'verificationId': verificationId,
    'code': code,
  });

  /// Creates the account for a verified number. Sign in afterwards with
  /// [login] (the web does the same).
  Future<void> register({
    required String verificationId,
    required String name,
    required String password,
  }) => _post('/api/register', {
    'verificationId': verificationId,
    'name': name.trim(),
    'password': password,
  });

  StoredSession _sessionFrom(Map<String, Object?> body) {
    final expiresAt = DateTime.tryParse(body['expiresAt'] as String? ?? '');
    final token = body['token'] as String?;
    if (token == null || token.isEmpty || expiresAt == null) {
      throw const ServerException();
    }
    return StoredSession(
      token: token,
      expiresAt: expiresAt.toUtc(),
      cookieName: body['cookieName'] as String?,
    );
  }

  Future<Map<String, Object?>> _post(
    String path,
    Map<String, Object?> data, {
    ({String message, String code})? unauthorized,
  }) async {
    final Response<Object?> response;
    try {
      response = await _dio.post<Object?>(
        path,
        data: data,
        options: Options(contentType: 'application/json'),
      );
    } on DioException catch (error) {
      throw apiExceptionFromDio(error);
    }
    final status = response.statusCode ?? 0;
    final body = response.data is Map
        ? (response.data! as Map).cast<String, Object?>()
        : null;
    if (status >= 200 && status < 300) return body ?? const {};
    if (status == 401 && unauthorized != null) {
      throw RejectedException(
        body?['error'] as String? ?? unauthorized.message,
        code: body?['code'] as String? ?? unauthorized.code,
      );
    }
    throw apiExceptionFromRest(status, body);
  }
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(dioProvider)),
);
