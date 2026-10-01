import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/api/http_client.dart';
import 'package:nirolearn/core/auth/session_store.dart';
import 'package:nirolearn/features/auth/data/auth_repository.dart';

import '../../helpers/fake_http.dart';

// Bodies below match what app/api/mobile/auth/* and the web's
// /api/phone-verification/* + /api/register return.
void main() {
  late FakeAdapter adapter;
  late MemorySessionStore sessions;
  var rejected = 0;

  AuthRepository repo() {
    rejected = 0;
    return AuthRepository(
      createApiDio(
        env: testEnv,
        sessions: sessions,
        onSessionRejected: () => rejected++,
        adapter: adapter,
      ),
    );
  }

  setUp(() => sessions = MemorySessionStore());

  group('login', () {
    test('success → session with the server cookie name + user', () async {
      adapter = FakeAdapter(
        (_, _) => (
          status: 200,
          body: jsonEncode({
            'token': 'jwe',
            'expiresAt': '2026-10-29T12:00:00.000Z',
            'cookieName': '__Secure-authjs.session-token',
            'user': {'id': 'u1', 'name': 'طالب', 'email': null, 'role': 'user'},
          }),
        ),
      );
      final result = await repo().login(
        identifier: ' 0791234567 ',
        password: 'secret-pass',
      );
      expect(result.session.token, 'jwe');
      expect(result.session.cookieName, '__Secure-authjs.session-token');
      expect(result.session.expiresAt, DateTime.utc(2026, 10, 29, 12));
      expect(result.user.id, 'u1');
      expect(adapter.requests.single.path, '/api/mobile/auth/login');
      expect(jsonDecode(adapter.bodies.single), {
        'identifier': '0791234567',
        'password': 'secret-pass',
      });
      // No session yet → no cookie sent with the login itself.
      expect(adapter.requests.single.headers.containsKey('cookie'), isFalse);
    });

    test(
      '401 is "wrong phone/email or password", not "session ended"',
      () async {
        adapter = FakeAdapter(
          (_, _) => (
            status: 401,
            body: jsonEncode({
              'error': 'رقم الهاتف (أو البريد) أو كلمة المرور غير صحيحة.',
              'code': 'invalid_credentials',
            }),
          ),
        );
        await expectLater(
          repo().login(identifier: 'a@b.com', password: 'x'),
          throwsA(
            isA<RejectedException>()
                .having((e) => e.code, 'code', 'invalid_credentials')
                .having((e) => e.message, 'message', contains('غير صحيحة')),
          ),
        );
      },
    );

    test(
      'suspended (403) and too many attempts (429) keep the server text',
      () async {
        adapter = FakeAdapter(
          (_, _) => (
            status: 403,
            body: jsonEncode({
              'error': 'حسابك معلّق حاليًا.',
              'code': 'account_suspended',
            }),
          ),
        );
        await expectLater(
          repo().login(identifier: 'a@b.com', password: 'x'),
          throwsA(
            isA<ForbiddenException>().having(
              (e) => e.message,
              'message',
              'حسابك معلّق حاليًا.',
            ),
          ),
        );

        adapter = FakeAdapter(
          (_, _) => (
            status: 429,
            body: jsonEncode({
              'error': 'محاولات دخول كثيرة. حاول بعد شوي.',
              'code': 'too_many_attempts',
            }),
          ),
        );
        await expectLater(
          repo().login(identifier: 'a@b.com', password: 'x'),
          throwsA(isA<RateLimitedException>()),
        );
      },
    );

    test(
      'a success without a token is a server error, never a sign-in',
      () async {
        adapter = FakeAdapter((_, _) => (status: 200, body: '{"user":{}}'));
        await expectLater(
          repo().login(identifier: 'a@b.com', password: 'x'),
          throwsA(isA<ServerException>()),
        );
      },
    );

    test('offline → network error', () async {
      adapter = FakeAdapter((_, _) => (status: 200, body: '{}'))
        ..failWithSocketError = true;
      await expectLater(
        repo().login(identifier: 'a@b.com', password: 'x'),
        throwsA(isA<NetworkException>()),
      );
    });
  });

  group('refresh', () {
    test('sends the current session cookie, returns the new session', () async {
      sessions = MemorySessionStore(
        StoredSession(
          token: 'old',
          expiresAt: DateTime.utc(2026, 10, 2),
          cookieName: '__Secure-authjs.session-token',
        ),
      );
      adapter = FakeAdapter(
        (_, _) => (
          status: 200,
          body: jsonEncode({
            'token': 'new',
            'expiresAt': '2026-11-01T00:00:00.000Z',
            'cookieName': '__Secure-authjs.session-token',
          }),
        ),
      );
      final fresh = await repo().refresh();
      expect(fresh.token, 'new');
      expect(
        adapter.requests.single.headers['cookie'],
        '__Secure-authjs.session-token=old',
      );
    });

    test('401 → session ended', () async {
      sessions = MemorySessionStore(
        StoredSession(token: 'old', expiresAt: DateTime.utc(2026, 10, 2)),
      );
      adapter = FakeAdapter(
        (_, _) => (
          status: 401,
          body: '{"error":"انتهت الجلسة.","code":"unauthorized"}',
        ),
      );
      await expectLater(
        repo().refresh(),
        throwsA(isA<UnauthorizedException>()),
      );
      expect(rejected, 1);
    });
  });

  group('phone sign-up', () {
    test('start → check → register call the web endpoints in order', () async {
      adapter = FakeAdapter((options, _) {
        return switch (options.path) {
          '/api/phone-verification/start' => (
            status: 200,
            body: jsonEncode({
              'verificationId': 'v-1',
              'phone': '+962791234567',
              'resendAfterSeconds': 45,
            }),
          ),
          '/api/phone-verification/check' => (status: 200, body: '{"ok":true}'),
          '/api/register' => (
            status: 201,
            body: '{"id":"u1","phone":"+962791234567"}',
          ),
          _ => (status: 404, body: '{}'),
        };
      });
      final auth = repo();
      final started = await auth.startPhoneVerification(
        phone: '079 123 4567',
        country: 'JO',
      );
      expect(started.verificationId, 'v-1');
      expect(started.phone, '+962791234567');
      expect(started.resendAfter, const Duration(seconds: 45));
      await auth.checkPhoneCode(verificationId: 'v-1', code: '123456');
      await auth.register(
        verificationId: 'v-1',
        name: ' طالب ',
        password: 'secret-pass',
      );
      expect(adapter.requests.map((r) => r.path), [
        '/api/phone-verification/start',
        '/api/phone-verification/check',
        '/api/register',
      ]);
      expect(jsonDecode(adapter.bodies.last), {
        'verificationId': 'v-1',
        'name': 'طالب',
        'password': 'secret-pass',
      });
    });

    test(
      'the server\'s Arabic sign-up errors reach the form as they are',
      () async {
        adapter = FakeAdapter(
          (_, _) => (
            status: 409,
            body: jsonEncode({
              'error':
                  'هذا الرقم مسجّل من قبل. سجّل دخولك بدلاً من إنشاء حساب.',
              'code': 'phone_taken',
            }),
          ),
        );
        await expectLater(
          repo().startPhoneVerification(phone: '0791234567', country: 'JO'),
          throwsA(
            isA<RejectedException>().having(
              (e) => e.message,
              'message',
              contains('مسجّل من قبل'),
            ),
          ),
        );
      },
    );
  });

  group('loginWithGoogle', () {
    test('posts the ID token → session + user', () async {
      adapter = FakeAdapter(
        (_, _) => (
          status: 200,
          body: jsonEncode({
            'token': 'jwe',
            'expiresAt': '2026-10-29T12:00:00.000Z',
            'cookieName': '__Secure-authjs.session-token',
            'created': true,
            'user': {
              'id': 'u2',
              'name': 'S',
              'email': 's@gmail.com',
              'role': 'user',
            },
          }),
        ),
      );
      final result = await repo().loginWithGoogle('google-id-token');
      expect(result.session.token, 'jwe');
      expect(result.user.email, 's@gmail.com');
      expect(adapter.requests.single.path, '/api/mobile/auth/google');
      expect(jsonDecode(adapter.bodies.single), {'idToken': 'google-id-token'});
    });

    test('401 is "Google token refused", not "session ended"', () async {
      adapter = FakeAdapter((_, _) => (status: 401, body: '{}'));
      await expectLater(
        repo().loginWithGoogle('t'),
        throwsA(
          isA<RejectedException>().having(
            (e) => e.code,
            'code',
            'invalid_google_token',
          ),
        ),
      );
      expect(rejected, 0);
    });

    test('a suspended account (403) keeps the server text', () async {
      adapter = FakeAdapter(
        (_, _) => (
          status: 403,
          body: jsonEncode({
            'error': 'حسابك معلّق.',
            'code': 'account_suspended',
          }),
        ),
      );
      await expectLater(
        repo().loginWithGoogle('t'),
        throwsA(
          isA<ForbiddenException>().having(
            (e) => e.message,
            'message',
            'حسابك معلّق.',
          ),
        ),
      );
    });
  });
}
