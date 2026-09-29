import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'session_store.dart';

final sessionStoreProvider = Provider<SessionStore>((ref) => SessionStore());

final sessionControllerProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);

enum SessionStatus { restoring, signedOut, signedIn }

final class SessionState {
  const SessionState._(this.status, {this.expired = false});

  const SessionState.restoring() : this._(SessionStatus.restoring);
  const SessionState.signedIn() : this._(SessionStatus.signedIn);

  /// [expired]: signed out by the server (401), not by the student — the
  /// login screen says «انتهت الجلسة».
  const SessionState.signedOut({bool expired = false})
    : this._(SessionStatus.signedOut, expired: expired);

  final SessionStatus status;
  final bool expired;
}

/// Owns "is someone signed in". Restores from secure storage at launch
/// without touching the network, so a returning student lands on Home
/// immediately (blueprint §9); the server stays the authority — any 401
/// ends the session through [onServerRejected].
class SessionController extends Notifier<SessionState> {
  SessionStore get _store => ref.read(sessionStoreProvider);

  /// Hook for wiping everything tied to the account (caches, protected
  /// memory) on sign-out. Registered by features as they are added.
  final List<Future<void> Function()> _signOutHooks = [];

  @override
  SessionState build() {
    Future(_restore);
    return const SessionState.restoring();
  }

  Future<void> _restore() async {
    final session = await _store.read();
    if (session == null || session.isExpiredAt(DateTime.now().toUtc())) {
      if (session != null) await _store.clear();
      state = const SessionState.signedOut();
      return;
    }
    state = const SessionState.signedIn();
  }

  void addSignOutHook(Future<void> Function() hook) => _signOutHooks.add(hook);

  /// Stores a session issued by the server (mobile auth endpoints, phase 4).
  Future<void> signIn(StoredSession session) async {
    await _store.write(session);
    state = const SessionState.signedIn();
  }

  Future<void> signOut({bool expired = false}) async {
    await _store.clear();
    for (final hook in _signOutHooks) {
      try {
        await hook();
      } catch (_) {
        // A failing cache wipe must not keep the student signed in.
      }
    }
    state = SessionState.signedOut(expired: expired);
  }

  void onServerRejected() {
    if (state.status == SessionStatus.signedIn) signOut(expired: true);
  }
}
