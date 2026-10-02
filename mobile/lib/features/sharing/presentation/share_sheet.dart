import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/auth_widgets.dart';
import '../../library/data/library_models.dart' show bookDisplayTitle;
import '../data/sharing_repository.dart';

/// The web's ShareStudyPackModal for one of the student's books: find a
/// student by username / name (never email; 2+ characters, debounced),
/// confirm, send a request — and the list of who it is shared with, with
/// withdraw / remove access. Every rule is the server's.
Future<void> showShareSheet(
  BuildContext context, {
  required String bookId,
  required String bookTitle,
}) {
  final l10n = AppLocalizations.of(context);
  return showNlSheet<void>(
    context,
    title: l10n.shShareTitle,
    builder: (_) => _ShareSheet(bookId: bookId, bookTitle: bookTitle),
  );
}

class _ShareSheet extends ConsumerStatefulWidget {
  const _ShareSheet({required this.bookId, required this.bookTitle});

  final String bookId;
  final String bookTitle;

  @override
  ConsumerState<_ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends ConsumerState<_ShareSheet> {
  final _query = TextEditingController();
  Timer? _debounce;
  String _debounced = '';
  int _offset = 0;
  List<StudentHit>? _results;
  int? _nextOffset;
  bool _searching = false;
  StudentHit? _selected;
  StudentHit? _sentTo;
  bool _sending = false;
  String? _error;
  List<BookShare>? _shares;

  SharingRepository get _repo => ref.read(sharingRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _loadShares();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  Future<void> _loadShares() async {
    try {
      final shares = await _repo.sharesForBook(widget.bookId);
      if (mounted) setState(() => _shares = shares);
    } catch (_) {
      if (mounted) setState(() => _shares = const []);
    }
  }

  void _onQuery(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _debounced = value.trim();
      _offset = 0;
      _search();
    });
  }

  Future<void> _search() async {
    if (_debounced.length < 2) {
      setState(() => _results = null);
      return;
    }
    final query = _debounced;
    setState(() => _searching = true);
    try {
      final page = await _repo.search(query, offset: _offset);
      if (!mounted || query != _debounced) return;
      setState(() {
        _results = page.items;
        _nextOffset = page.nextOffset;
      });
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _send() async {
    final to = _selected!;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await _repo.sendRequest(widget.bookId, to.id);
      if (!mounted) return;
      setState(() {
        _sentTo = to;
        _selected = null;
        _query.clear();
        _results = null;
      });
      await _loadShares();
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _revoke(BookShare share) async {
    final l10n = AppLocalizations.of(context);
    final who = ownerLabel(
      share.recipientName,
      share.recipientUsername,
      l10n.dsStudent,
    );
    final pending = share.status == 'pending';
    final ok = await showNlConfirm(
      context,
      title: pending ? l10n.shWithdraw : l10n.shRemoveAccess,
      message: pending
          ? l10n.shWithdrawConfirm(isolate(who))
          : l10n.shRemoveAccessConfirm(isolate(who)),
      confirmLabel: pending ? l10n.shWithdraw : l10n.shRemoveAccess,
      destructive: true,
    );
    if (!ok) return;
    try {
      await _repo.revoke(share.shareId);
      await _loadShares();
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorText(context, error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    Widget student(StudentHit s, {VoidCallback? onTap}) => ListTile(
      contentPadding: EdgeInsets.zero,
      onTap: onTap,
      leading: CircleAvatar(
        backgroundColor: NlColors.niroSoft,
        child: Text(
          (s.name?.isNotEmpty ?? false ? s.name! : s.username).characters.first
              .toUpperCase(),
          style: NlText.rowLabel.copyWith(color: NlColors.niroDeep),
        ),
      ),
      title: Text(
        isolate((s.name ?? '').isNotEmpty ? s.name! : s.username),
        style: NlText.rowLabel,
      ),
      subtitle: Text(isolateLtr('@${s.username}'), style: NlText.caption),
    );

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            isolate(bookDisplayTitle(widget.bookTitle)),
            style: NlText.secondary,
          ),
          const SizedBox(height: NlSpace.md),
          if (_sentTo != null) ...[
            Text(
              l10n.shSent,
              style: NlText.title.copyWith(color: NlColors.correct),
            ),
            Text(
              l10n.shSentBody(
                isolate(
                  (_sentTo!.name ?? '').isNotEmpty
                      ? _sentTo!.name!
                      : '@${_sentTo!.username}',
                ),
              ),
              style: NlText.secondary,
            ),
            const SizedBox(height: NlSpace.sm),
            NlButton(
              label: l10n.shShareAnother,
              kind: NlButtonKind.secondary,
              onPressed: () => setState(() => _sentTo = null),
            ),
          ] else if (_selected != null) ...[
            student(_selected!),
            Text(l10n.shExplain, style: NlText.secondary),
            if (_error != null) AuthError(_error!),
            const SizedBox(height: NlSpace.md),
            NlButton(
              label: l10n.shSendRequest,
              icon: LucideIcons.send,
              loading: _sending,
              expand: true,
              onPressed: _send,
            ),
            const SizedBox(height: NlSpace.sm),
            NlButton(
              label: l10n.shBack,
              kind: NlButtonKind.secondary,
              expand: true,
              onPressed: _sending
                  ? null
                  : () => setState(() {
                      _selected = null;
                      _error = null;
                    }),
            ),
          ] else ...[
            TextField(
              controller: _query,
              maxLength: 64,
              autofocus: true,
              onChanged: _onQuery,
              decoration: InputDecoration(
                hintText: l10n.shSearchHint,
                prefixIcon: const Icon(LucideIcons.search, size: 18),
                suffixIcon: _searching
                    ? const Padding(
                        padding: EdgeInsets.all(14),
                        child: SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : null,
                counterText: '',
              ),
            ),
            if (_error != null) AuthError(_error!),
            if (_debounced.length < 2)
              Text(l10n.shSearchRule, style: NlText.caption)
            else if (_results != null && _results!.isEmpty)
              Text(l10n.shNoStudent, style: NlText.caption)
            else if (_results != null) ...[
              for (final s in _results!)
                student(s, onTap: () => setState(() => _selected = s)),
              if (_nextOffset != null)
                NlButton(
                  label: l10n.shMoreResults,
                  kind: NlButtonKind.ghost,
                  onPressed: () {
                    _offset = _nextOffset!;
                    _search();
                  },
                ),
              if (_offset > 0)
                NlButton(
                  label: l10n.shFirstResults,
                  kind: NlButtonKind.ghost,
                  onPressed: () {
                    _offset = 0;
                    _search();
                  },
                ),
            ],
          ],
          const Divider(height: NlSpace.xxl),
          Text('👥 ${l10n.shSharedWith}', style: NlText.rowLabel),
          if (_shares == null)
            const Padding(
              padding: EdgeInsets.all(NlSpace.md),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_shares!.isEmpty)
            Text(l10n.shNotSharedYet, style: NlText.caption)
          else
            for (final share in _shares!)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  isolate(
                    (share.recipientName ?? '').isNotEmpty
                        ? share.recipientName!
                        : (share.recipientUsername ?? ''),
                  ),
                  style: NlText.rowLabel,
                ),
                subtitle: Text(switch (share.status) {
                  'accepted' => l10n.shHasAccess,
                  'declined' => l10n.shDeclined,
                  _ => l10n.shPending,
                }, style: NlText.caption),
                trailing: share.status == 'declined'
                    ? null
                    : NlButton(
                        label: share.status == 'pending'
                            ? l10n.shWithdraw
                            : l10n.shRemoveAccess,
                        kind: NlButtonKind.ghost,
                        onPressed: () => _revoke(share),
                      ),
              ),
        ],
      ),
    );
  }
}
