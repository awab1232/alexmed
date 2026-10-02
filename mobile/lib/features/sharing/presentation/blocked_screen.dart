import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../library/data/library_repository.dart';
import '../data/sharing_repository.dart';

/// المحظورون (`sharing.blocked` / `sharing.unblock`): people blocked from a
/// share request. A blocked student can't find you or share with you.
class BlockedScreen extends ConsumerWidget {
  const BlockedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final blocked = ref.watch(blockedProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.shBlockedTitle)),
      body: blocked.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(NlSpace.page),
          child: NlListSkeleton(),
        ),
        error: (e, _) => NlErrorView(
          error: e,
          onRetry: () => ref.invalidate(blockedProvider),
        ),
        data: (list) => list.isEmpty
            ? NlEmptyState(
                title: l10n.shBlockedEmpty,
                message: l10n.shBlockedHint,
              )
            : ListView(
                padding: const EdgeInsets.symmetric(horizontal: NlSpace.page),
                children: [
                  Text(l10n.shBlockedHint, style: NlText.secondary),
                  for (final u in list)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        isolate(ownerLabel(u.name, u.username, l10n.dsStudent)),
                        style: NlText.rowLabel,
                      ),
                      subtitle: u.username == null
                          ? null
                          : Text(
                              isolateLtr('@${u.username}'),
                              style: NlText.caption,
                            ),
                      trailing: NlButton(
                        label: l10n.shUnblock,
                        kind: NlButtonKind.secondary,
                        onPressed: () async {
                          final ok = await showNlConfirm(
                            context,
                            title: l10n.shUnblock,
                            message: l10n.shUnblockConfirm,
                            confirmLabel: l10n.shUnblock,
                          );
                          if (!ok) return;
                          try {
                            await ref
                                .read(sharingRepositoryProvider)
                                .unblock(u.id);
                            ref.invalidate(blockedProvider);
                          } catch (error) {
                            if (context.mounted) {
                              showNlToast(
                                context,
                                apiErrorText(context, error),
                              );
                            }
                          }
                        },
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

/// In-app notifications (blueprint §6 #35): while the app is in the
/// foreground the sharing summary (pending requests, unread
/// notifications — shown on Home and in مشترك معي) is refreshed every
/// minute and on every return to the app. No push (P15).
class SharingPoller extends ConsumerStatefulWidget {
  const SharingPoller({
    super.key,
    required this.child,
    this.every = const Duration(minutes: 1),
  });

  final Widget child;
  final Duration every;

  @override
  ConsumerState<SharingPoller> createState() => _SharingPollerState();
}

class _SharingPollerState extends ConsumerState<SharingPoller>
    with WidgetsBindingObserver {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _start();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  void _start() {
    _timer?.cancel();
    _timer = Timer.periodic(widget.every, (_) => _refresh());
  }

  void _refresh() {
    ref
      ..invalidate(sharedSummaryProvider)
      ..invalidate(incomingProvider);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refresh();
      _start();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      _timer?.cancel();
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
