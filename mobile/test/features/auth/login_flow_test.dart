import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/auth/session_store.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/auth/data/auth_repository.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/fake_http.dart';

class FakeAuthRepository implements AuthRepository {
  final loginCalls = <String>[];
  int refreshCalls = 0;
  Object? loginError;
  Object? refreshError;

  @override
  Future<({StoredSession session, AuthUser user})> login({
    required String identifier,
    required String password,
  }) async {
    loginCalls.add('$identifier:$password');
    if (loginError != null) throw loginError!;
    return (
      session: StoredSession(
        token: 'jwe',
        expiresAt: DateTime.now().toUtc().add(const Duration(days: 30)),
        cookieName: '__Secure-authjs.session-token',
      ),
      user: const AuthUser(id: 'u1', role: 'user'),
    );
  }

  @override
  Future<StoredSession> refresh() async {
    refreshCalls++;
    if (refreshError != null) throw refreshError!;
    return StoredSession(
      token: 'fresh',
      expiresAt: DateTime.now().toUtc().add(const Duration(days: 30)),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<(FakeAuthRepository, MemorySessionStore)> pumpApp(
  WidgetTester tester, {
  StoredSession? stored,
  FakeAuthRepository? auth,
}) async {
  final repo = auth ?? FakeAuthRepository();
  final store = MemorySessionStore(stored);
  await tester.pumpWidget(
    ProviderScope(
      retry: noAutomaticRetry,
      overrides: [
        authRepositoryProvider.overrideWithValue(repo),
        sessionStoreProvider.overrideWithValue(store),
        envProvider.overrideWithValue(testEnv),
        libraryRepositoryProvider.overrideWithValue(FakeLibraryRepository()),
        accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
      ],
      child: const NiroLearnApp(),
    ),
  );
  await tester.pumpAndSettle();
  return (repo, store);
}

void main() {
  testWidgets('welcome → login → Home, session stored', (tester) async {
    final (auth, store) = await pumpApp(tester);
    expect(find.text('ذاكر بذكاء مع Niro'), findsOneWidget);

    await tester.tap(find.text('تسجيل الدخول'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), '0791234567');
    await tester.enterText(find.byType(TextField).at(1), 'secret-pass');
    await tester.tap(find.widgetWithText(NlButton, 'دخول'));
    await tester.pumpAndSettle();

    expect(auth.loginCalls, ['0791234567:secret-pass']);
    expect(store.current?.token, 'jwe');
    expect(find.byType(NlBottomNav), findsOneWidget);
  });

  testWidgets('empty form → asks for both fields, no request', (tester) async {
    final (auth, _) = await pumpApp(tester);
    await tester.tap(find.text('تسجيل الدخول'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(NlButton, 'دخول'));
    await tester.pump();
    expect(
      find.text('أدخل رقم الهاتف (أو البريد) وكلمة المرور.'),
      findsOneWidget,
    );
    expect(auth.loginCalls, isEmpty);
  });

  testWidgets('wrong password → the server message, still signed out', (
    tester,
  ) async {
    final auth = FakeAuthRepository()
      ..loginError = const RejectedException(
        'رقم الهاتف (أو البريد) أو كلمة المرور غير صحيحة.',
        code: 'invalid_credentials',
      );
    final (_, store) = await pumpApp(tester, auth: auth);
    await tester.tap(find.text('تسجيل الدخول'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), 'a@b.com');
    await tester.enterText(find.byType(TextField).at(1), 'wrong');
    await tester.tap(find.widgetWithText(NlButton, 'دخول'));
    await tester.pumpAndSettle();
    expect(
      find.text('رقم الهاتف (أو البريد) أو كلمة المرور غير صحيحة.'),
      findsOneWidget,
    );
    expect(store.current, isNull);
    expect(find.byType(NlBottomNav), findsNothing);
  });

  testWidgets('session with < 7 days left is refreshed at launch', (
    tester,
  ) async {
    final (auth, store) = await pumpApp(
      tester,
      stored: StoredSession(
        token: 'old',
        expiresAt: DateTime.now().toUtc().add(const Duration(days: 3)),
      ),
    );
    expect(auth.refreshCalls, 1);
    expect(store.current?.token, 'fresh');
    expect(find.byType(NlBottomNav), findsOneWidget);
  });

  testWidgets('fresh session is not refreshed', (tester) async {
    final (auth, _) = await pumpApp(
      tester,
      stored: StoredSession(
        token: 'ok',
        expiresAt: DateTime.now().toUtc().add(const Duration(days: 20)),
      ),
    );
    expect(auth.refreshCalls, 0);
  });

  testWidgets('refresh rejected by the server → signed out with notice', (
    tester,
  ) async {
    final auth = FakeAuthRepository()
      ..refreshError = const UnauthorizedException();
    final (_, store) = await pumpApp(
      tester,
      auth: auth,
      stored: StoredSession(
        token: 'old',
        expiresAt: DateTime.now().toUtc().add(const Duration(days: 2)),
      ),
    );
    expect(store.current, isNull);
    expect(find.byType(NlBottomNav), findsNothing);
    await tester.tap(find.text('تسجيل الدخول'));
    await tester.pumpAndSettle();
    expect(find.text('انتهت الجلسة. سجّل الدخول مرة أخرى.'), findsOneWidget);
  });

  testWidgets('refresh failing offline keeps the student signed in', (
    tester,
  ) async {
    final auth = FakeAuthRepository()..refreshError = const NetworkException();
    final (_, store) = await pumpApp(
      tester,
      auth: auth,
      stored: StoredSession(
        token: 'old',
        expiresAt: DateTime.now().toUtc().add(const Duration(days: 2)),
      ),
    );
    expect(store.current?.token, 'old');
    expect(find.byType(NlBottomNav), findsOneWidget);
  });
}
