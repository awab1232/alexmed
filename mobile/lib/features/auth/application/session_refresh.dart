import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/auth/session_controller.dart';
import '../data/auth_repository.dart';

/// Keeps a signed-in student signed in: whenever the session is (re)entered
/// with fewer than 7 days left, it is exchanged for a fresh 30-day one
/// (`/api/mobile/auth/refresh`, gap G4). A 401 means the server already
/// ended the session (expired, suspended, deleted) → sign out. Network
/// failures are ignored; the next launch tries again, and the old token
/// keeps working until it expires.
final sessionRefreshProvider = Provider<void>((ref) {
  var inFlight = false;
  Future<void> refreshIfDue() async {
    final store = ref.read(sessionStoreProvider);
    final current = store.current;
    if (inFlight ||
        current == null ||
        !current.needsRefreshAt(DateTime.now().toUtc())) {
      return;
    }
    inFlight = true;
    try {
      final fresh = await ref.read(authRepositoryProvider).refresh();
      await ref.read(sessionControllerProvider.notifier).signIn(fresh);
    } on UnauthorizedException {
      await ref.read(sessionControllerProvider.notifier).signOut(expired: true);
    } catch (_) {
      // Offline or server trouble — try again next time.
    } finally {
      inFlight = false;
    }
  }

  ref.listen(sessionControllerProvider, (_, next) {
    if (next.status == SessionStatus.signedIn) refreshIfDue();
  }, fireImmediately: true);
});
