import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/dates.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../account/data/account_repository.dart';
import '../../auth/presentation/auth_widgets.dart';
import '../../library/data/library_models.dart' show bookDisplayTitle;
import '../../library/data/library_repository.dart';
import '../data/sharing_repository.dart';

enum _Tab { requests, library, notifications }

/// مشترك معي — the web's app/shared: the username that makes you findable,
/// incoming requests (accept / decline / decline and block), the packs
/// shared with you, and sharing notifications (marked read when opened).
class SharedScreen extends ConsumerStatefulWidget {
  const SharedScreen({super.key});

  @override
  ConsumerState<SharedScreen> createState() => _SharedScreenState();
}

class _SharedScreenState extends ConsumerState<SharedScreen> {
  _Tab? _tab;
  String? _busyShare;
  String? _error;

  void _refreshAll() {
    ref
      ..invalidate(incomingProvider)
      ..invalidate(sharedWithMeProvider)
      ..invalidate(sharedSummaryProvider);
  }

  Future<void> _respond(
    IncomingRequest r, {
    required bool accept,
    bool block = false,
  }) async {
    final l10n = AppLocalizations.of(context);
    if (block) {
      final ok = await showNlConfirm(
        context,
        title: l10n.shBlockTitle,
        message: l10n.shBlockConfirm(
          ownerLabel(r.ownerName, r.ownerUsername, l10n.dsStudent),
        ),
        confirmLabel: l10n.shDeclineBlock,
        destructive: true,
      );
      if (!ok) return;
    }
    setState(() {
      _busyShare = r.shareId;
      _error = null;
    });
    try {
      await ref
          .read(sharingRepositoryProvider)
          .respond(r.shareId, accept: accept, block: block);
      _refreshAll();
      if (block) ref.invalidate(blockedProvider);
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _busyShare = null);
    }
  }

  void _open(_Tab tab) {
    setState(() => _tab = tab);
    if (tab == _Tab.notifications) {
      final unread = ref.read(sharedSummaryProvider).value?.unread ?? 0;
      if (unread > 0) {
        ref
            .read(sharingRepositoryProvider)
            .markNotificationsRead()
            .then((_) => ref.invalidate(sharedSummaryProvider))
            .catchError((_) {});
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final incoming = ref.watch(incomingProvider);
    final summary = ref.watch(sharedSummaryProvider).value;
    final tab =
        _tab ??
        ((incoming.value?.isNotEmpty ?? false) ? _Tab.requests : _Tab.library);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.sharedWithMe)),
      body: RefreshIndicator(
        color: NlColors.ink,
        onRefresh: () async {
          _refreshAll();
          ref.invalidate(notificationsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            NlSpace.page,
            0,
            NlSpace.page,
            NlSpace.xxxl,
          ),
          children: [
            Text(l10n.shIntro, style: NlText.secondary),
            const SizedBox(height: NlSpace.md),
            const UsernameCard(),
            const SizedBox(height: NlSpace.md),
            Wrap(
              spacing: NlSpace.sm,
              runSpacing: 4,
              children: [
                for (final (t, label, count) in [
                  (_Tab.requests, l10n.shTabRequests, incoming.value?.length),
                  (_Tab.library, l10n.sharedWithMe, null),
                  (
                    _Tab.notifications,
                    l10n.shTabNotifications,
                    summary?.unread,
                  ),
                ])
                  ChoiceChip(
                    label: Text(
                      count != null && count > 0 ? '$label · $count' : label,
                    ),
                    selected: tab == t,
                    onSelected: (_) => _open(t),
                  ),
              ],
            ),
            const SizedBox(height: NlSpace.md),
            if (_error != null) AuthError(_error!),
            switch (tab) {
              _Tab.requests => incoming.when(
                loading: () => const NlListSkeleton(),
                error: (e, _) => NlErrorView(
                  error: e,
                  inline: true,
                  onRetry: () => ref.invalidate(incomingProvider),
                ),
                data: (list) => list.isEmpty
                    ? NlEmptyState(
                        inline: true,
                        title: l10n.shNoRequests,
                        message: l10n.shNoRequestsHint,
                      )
                    : Column(
                        children: [
                          for (final r in list)
                            _RequestCard(
                              request: r,
                              busy: _busyShare == r.shareId,
                              onAccept: () => _respond(r, accept: true),
                              onDecline: () => _respond(r, accept: false),
                              onBlock: () =>
                                  _respond(r, accept: false, block: true),
                            ),
                        ],
                      ),
              ),
              _Tab.library =>
                ref
                    .watch(sharedWithMeProvider)
                    .when(
                      loading: () => const NlListSkeleton(),
                      error: (e, _) => NlErrorView(
                        error: e,
                        inline: true,
                        onRetry: () => ref.invalidate(sharedWithMeProvider),
                      ),
                      data: (list) => list.isEmpty
                          ? NlEmptyState(
                              inline: true,
                              title: l10n.shNoPacks,
                              message: l10n.shNoPacksHint,
                            )
                          : Column(
                              children: [
                                for (final p in list) _PackCard(pack: p),
                              ],
                            ),
                    ),
              _Tab.notifications =>
                ref
                    .watch(notificationsProvider)
                    .when(
                      loading: () => const NlListSkeleton(),
                      error: (e, _) => NlErrorView(
                        error: e,
                        inline: true,
                        onRetry: () => ref.invalidate(notificationsProvider),
                      ),
                      data: (list) => list.isEmpty
                          ? NlEmptyState(
                              inline: true,
                              title: l10n.shNoNotifications,
                            )
                          : Column(
                              children: [
                                for (final n in list) _NotificationRow(note: n),
                              ],
                            ),
                    ),
            },
          ],
        ),
      ),
    );
  }
}

/// The web's ContentsChips.
class ContentsChips extends StatelessWidget {
  const ContentsChips({super.key, required this.contents});
  final PackContents contents;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final c = contents;
    final chips = [
      if (c.chapters > 0) '📘 ${l10n.shChapters(c.chapters)}',
      if (c.flashcards > 0) '🃏 ${l10n.shCards(c.flashcards)}',
      if (c.questions > 0) '❓ ${l10n.qfCount(c.questions)}',
      if (c.chapters > 0) '🧠 ${l10n.shMindMap}',
      if (c.examFocus != null) '🔥 ${isolateLtr('${c.examFocus} Exam Focus')}',
    ];
    if (chips.isEmpty) {
      return Text(l10n.shNoContentYet, style: NlText.caption);
    }
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [for (final chip in chips) NlBadge(chip)],
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.request,
    required this.busy,
    required this.onAccept,
    required this.onDecline,
    required this.onBlock,
  });

  final IncomingRequest request;
  final bool busy;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  final VoidCallback onBlock;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final r = request;
    return Container(
      margin: const EdgeInsets.only(bottom: NlSpace.md),
      padding: const EdgeInsets.all(NlSpace.lg),
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.shWantsToShare(
              isolate(ownerLabel(r.ownerName, r.ownerUsername, l10n.dsStudent)),
            ),
            style: NlText.secondary,
          ),
          const SizedBox(height: 4),
          Text(isolate(bookDisplayTitle(r.bookTitle)), style: NlText.title),
          Text(
            [
              l10n.shPages(r.pageCount),
              if (r.createdAt != null) formatDateTime(context, r.createdAt),
            ].join(' · '),
            style: NlText.caption,
          ),
          const SizedBox(height: NlSpace.sm),
          ContentsChips(contents: r.contents),
          const SizedBox(height: NlSpace.md),
          Wrap(
            spacing: NlSpace.sm,
            runSpacing: NlSpace.sm,
            children: [
              NlButton(
                label: l10n.shAccept,
                icon: LucideIcons.check,
                loading: busy,
                onPressed: busy ? null : onAccept,
              ),
              NlButton(
                label: l10n.shDecline,
                kind: NlButtonKind.secondary,
                icon: LucideIcons.x,
                onPressed: busy ? null : onDecline,
              ),
              NlButton(
                label: l10n.shDeclineBlock,
                kind: NlButtonKind.ghost,
                icon: LucideIcons.shieldBan,
                onPressed: busy ? null : onBlock,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PackCard extends StatelessWidget {
  const _PackCard({required this.pack});
  final SharedWithMe pack;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: NlSpace.md),
      child: Material(
        color: NlColors.sheet,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NlRadius.md),
          side: const BorderSide(color: NlColors.rule),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(NlRadius.md),
          onTap: () => context.push(Routes.book(pack.bookId)),
          child: Padding(
            padding: const EdgeInsets.all(NlSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '📘 ${isolate(bookDisplayTitle(pack.bookTitle))}',
                  style: NlText.rowLabel,
                ),
                Text(
                  '${l10n.shFrom(isolate(ownerLabel(pack.ownerName, pack.ownerUsername, l10n.dsStudent)))}'
                  '${pack.sharedAt == null ? '' : ' · ${formatDateTime(context, pack.sharedAt)}'}',
                  style: NlText.caption,
                ),
                const SizedBox(height: NlSpace.sm),
                ContentsChips(contents: pack.contents),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({required this.note});
  final SharingNotification note;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final who = isolate(
      ownerLabel(note.actorName, note.actorUsername, l10n.dsStudent),
    );
    final title = isolate(bookDisplayTitle(note.bookTitle ?? ''));
    final text = switch (note.type) {
      'share_request' => l10n.shNoteRequest(who, title),
      'share_accepted' => l10n.shNoteAccepted(who, title),
      'share_declined' => l10n.shNoteDeclined(who, title),
      'billing' => note.text ?? '',
      _ => note.bookTitle ?? '',
    };
    return Container(
      margin: const EdgeInsets.only(bottom: NlSpace.sm),
      padding: const EdgeInsets.all(NlSpace.md),
      decoration: BoxDecoration(
        color: note.read ? NlColors.sheet : NlColors.markerSoft,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AutoDirText(text, style: NlText.body),
          Text(formatDateTime(context, note.createdAt), style: NlText.caption),
        ],
      ),
    );
  }
}

/// The web's UsernameCard: opt-in handle — nobody can find you in sharing
/// search until you pick one; email is never searchable or shown.
class UsernameCard extends ConsumerStatefulWidget {
  const UsernameCard({super.key});

  @override
  ConsumerState<UsernameCard> createState() => _UsernameCardState();
}

class _UsernameCardState extends ConsumerState<UsernameCard> {
  final _input = TextEditingController();
  bool _busy = false;
  bool _saved = false;
  String? _error;
  String? _loadedFor;

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  String _normalized(String v) =>
      v.trim().replaceFirst(RegExp('^@+'), '').toLowerCase();

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
      _saved = false;
    });
    try {
      final saved = await ref
          .read(sharingRepositoryProvider)
          .setUsername(_input.text);
      _input.text = saved;
      ref.invalidate(usernameProvider);
      if (mounted) setState(() => _saved = true);
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final current = ref.watch(usernameProvider).value;
    if (current != null && _loadedFor != current) {
      _loadedFor = current;
      _input.text = current;
    }
    final dirty = _normalized(_input.text) != (current ?? '');
    return Container(
      padding: const EdgeInsets.all(NlSpace.lg),
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('@ ${l10n.shUsernameTitle}', style: NlText.rowLabel),
          const SizedBox(height: 4),
          Text(
            current != null ? l10n.shUsernameSet : l10n.shUsernameUnset,
            style: NlText.secondary,
          ),
          const SizedBox(height: NlSpace.md),
          Row(
            children: [
              Expanded(
                child: Directionality(
                  textDirection: TextDirection.ltr,
                  child: TextField(
                    controller: _input,
                    maxLength: 40,
                    autocorrect: false,
                    enableSuggestions: false,
                    onChanged: (_) => setState(() {
                      _saved = false;
                      _error = null;
                    }),
                    decoration: const InputDecoration(
                      prefixText: '@',
                      hintText: 'your.name',
                      counterText: '',
                    ),
                  ),
                ),
              ),
              const SizedBox(width: NlSpace.sm),
              NlButton(
                label: _saved && !dirty
                    ? '✓ ${l10n.actionSave}'
                    : (current != null ? l10n.actionSave : l10n.shChoose),
                loading: _busy,
                onPressed: dirty && _input.text.trim().isNotEmpty && !_busy
                    ? _save
                    : null,
              ),
            ],
          ),
          const SizedBox(height: 6),
          if (_error != null)
            AuthError(_error!)
          else
            Text(l10n.shUsernameRule, style: NlText.caption),
        ],
      ),
    );
  }
}
