import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/app/router.dart';
import 'package:nirolearn/core/auth/session_controller.dart';
import 'package:nirolearn/core/auth/session_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  group('SessionStore', () {
    test('write → read → clear', () async {
      final store = SessionStore();
      expect(await store.read(), isNull);
      await store.write(
        StoredSession(token: 't', expiresAt: DateTime.utc(2030)),
      );
      final fresh = SessionStore();
      final read = await fresh.read();
      expect(read!.token, 't');
      expect(read.expiresAt, DateTime.utc(2030));
      await fresh.clear();
      expect(await SessionStore().read(), isNull);
    });

    test('refresh window and expiry', () {
      final session = StoredSession(
        token: 't',
        expiresAt: DateTime.utc(2026, 10, 10),
      );
      expect(session.needsRefreshAt(DateTime.utc(2026, 9, 29)), isFalse);
      expect(session.needsRefreshAt(DateTime.utc(2026, 10, 5)), isTrue);
      expect(session.isExpiredAt(DateTime.utc(2026, 10, 10)), isTrue);
    });
  });

  group('SessionController', () {
    Future<SessionState> settle(ProviderContainer container) async {
      container.read(sessionControllerProvider);
      for (var i = 0; i < 20; i++) {
        await Future<void>.delayed(Duration.zero);
        final state = container.read(sessionControllerProvider);
        if (state.status != SessionStatus.restoring) return state;
      }
      return container.read(sessionControllerProvider);
    }

    test('no stored session → signed out', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect((await settle(container)).status, SessionStatus.signedOut);
    });

    test('valid stored session → signed in without network', () async {
      FlutterSecureStorage.setMockInitialValues({
        'nl.session.token': 'tok',
        'nl.session.expiresAt': '2099-01-01T00:00:00.000Z',
      });
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect((await settle(container)).status, SessionStatus.signedIn);
    });

    test('expired stored session → wiped and signed out', () async {
      FlutterSecureStorage.setMockInitialValues({
        'nl.session.token': 'tok',
        'nl.session.expiresAt': '2000-01-01T00:00:00.000Z',
      });
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect((await settle(container)).status, SessionStatus.signedOut);
      expect(await SessionStore().read(), isNull);
    });

    test('server 401 → signed out as expired, sign-out hooks run', () async {
      FlutterSecureStorage.setMockInitialValues({
        'nl.session.token': 'tok',
        'nl.session.expiresAt': '2099-01-01T00:00:00.000Z',
      });
      final container = ProviderContainer();
      addTearDown(container.dispose);
      await settle(container);
      var wiped = false;
      final controller = container.read(sessionControllerProvider.notifier)
        ..addSignOutHook(() async => wiped = true)
        // A failing hook must not keep the session alive.
        ..addSignOutHook(() async => throw StateError('boom'));
      controller.onServerRejected();
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      final state = container.read(sessionControllerProvider);
      expect(state.status, SessionStatus.signedOut);
      expect(state.expired, isTrue);
      expect(wiped, isTrue);
      expect(await SessionStore().read(), isNull);
    });
  });

  group('sessionRedirect', () {
    const restoring = SessionState.restoring();
    const signedOut = SessionState.signedOut();
    const signedIn = SessionState.signedIn();

    test('restoring always shows the splash', () {
      expect(sessionRedirect(restoring, Routes.home), Routes.splash);
      expect(sessionRedirect(restoring, Routes.splash), isNull);
    });

    test('signed out can only be in the auth flow', () {
      expect(sessionRedirect(signedOut, Routes.home), Routes.welcome);
      expect(sessionRedirect(signedOut, Routes.account), Routes.welcome);
      expect(sessionRedirect(signedOut, Routes.splash), Routes.welcome);
      expect(sessionRedirect(signedOut, Routes.login), isNull);
    });

    test('signed in leaves splash and auth flow for Home, stays elsewhere', () {
      expect(sessionRedirect(signedIn, Routes.splash), Routes.home);
      expect(sessionRedirect(signedIn, Routes.login), Routes.home);
      expect(sessionRedirect(signedIn, Routes.games), isNull);
    });
  });
}
