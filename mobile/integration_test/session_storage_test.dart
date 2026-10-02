// Runs on a real device / emulator (not the secure-storage mock):
//   flutter test integration_test/session_storage_test.dart \
//     --dart-define-from-file=env/prod.json -d <device>
// Proves the session survives in the platform keystore/keychain, is wiped
// on sign-out, and that the app boots to the right screen for each state.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/core/auth/session_store.dart';
import 'package:nirolearn/core/ui/ui.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('session round-trips through the platform secure storage', (
    tester,
  ) async {
    await SessionStore().clear();
    expect(await SessionStore().read(), isNull);

    final session = StoredSession(
      token: 'device-test-token',
      expiresAt: DateTime.utc(2099),
    );
    await SessionStore().write(session);

    // A new instance reads from the platform store, not memory.
    final read = await SessionStore().read();
    expect(read?.token, 'device-test-token');
    expect(read?.expiresAt, DateTime.utc(2099));

    await SessionStore().clear();
    expect(await SessionStore().read(), isNull);
  });

  testWidgets('signed out on device → welcome, no bottom bar', (tester) async {
    await SessionStore().clear();
    await tester.pumpWidget(const ProviderScope(child: NiroLearnApp()));
    await tester.pumpAndSettle();
    expect(find.text('ذاكر بذكاء مع Niro'), findsOneWidget);
    expect(find.byType(NlBottomNav), findsNothing);
  });

  testWidgets('stored session on device → Home with the bottom bar', (
    tester,
  ) async {
    await SessionStore().write(
      StoredSession(token: 'device-test-token', expiresAt: DateTime.utc(2099)),
    );
    await tester.pumpWidget(const ProviderScope(child: NiroLearnApp()));
    await tester.pumpAndSettle();
    expect(find.byType(NlBottomNav), findsOneWidget);
    await SessionStore().clear();
  });
}
