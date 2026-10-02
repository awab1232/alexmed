import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../auth/session_controller.dart' show SessionStatus;
import '../ui/components/nl_states.dart';
import '../ui/tokens.dart';
import 'offline.dart';

/// Wraps the whole app: the offline banner above every screen while the
/// server can't be reached (cached content stays readable below it), and
/// the sync loop — queued ratings are sent as soon as the server answers
/// again, on every return to the app, and every [probeEvery] while
/// offline (a light request that doubles as the "are we back?" check).
class OfflineShell extends ConsumerStatefulWidget {
  const OfflineShell({
    super.key,
    required this.child,
    this.probeEvery = const Duration(seconds: 20),
  });

  final Widget child;
  final Duration probeEvery;

  @override
  ConsumerState<OfflineShell> createState() => _OfflineShellState();
}

class _OfflineShellState extends ConsumerState<OfflineShell>
    with WidgetsBindingObserver {
  Timer? _probe;
  bool _flushing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Anything left from the last run goes out once the app is up.
    WidgetsBinding.instance.addPostFrameCallback((_) => _flush());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _probe?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _flush();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      _probe?.cancel();
    }
  }

  bool get _signedIn =>
      ref.read(sessionControllerProvider).status == SessionStatus.signedIn;

  Future<void> _flush() async {
    if (_flushing || !_signedIn) return;
    _flushing = true;
    try {
      await ref.read(trpcProvider).flushQueue();
    } catch (_) {
      // Retried on the next trigger.
    } finally {
      _flushing = false;
    }
  }

  void _startProbe() {
    _probe?.cancel();
    _probe = Timer.periodic(widget.probeEvery, (_) async {
      if (!_signedIn) return;
      try {
        await ref
            .read(trpcProvider)
            .query('questionSets.enabled', parse: (_) {});
      } catch (_) {
        // Still offline (or the server refused) — keep probing.
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(onlineProvider, (was, online) {
      if (online) {
        _probe?.cancel();
        _flush();
      } else {
        _startProbe();
      }
    });
    final online = ref.watch(onlineProvider);
    final signedIn = ref.watch(
      sessionControllerProvider.select(
        (s) => s.status == SessionStatus.signedIn,
      ),
    );
    if (online || !signedIn) return widget.child;
    return Column(
      children: [
        // The banner colour runs up under the status bar.
        const Material(
          color: NlColors.markerSoft,
          child: SafeArea(bottom: false, child: NlOfflineBanner()),
        ),
        Expanded(
          child: MediaQuery.removePadding(
            context: context,
            removeTop: true,
            child: widget.child,
          ),
        ),
      ],
    );
  }
}
