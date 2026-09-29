import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../library/data/library_models.dart' show bookDisplayTitle;
import '../../library/data/library_repository.dart';
import '../data/mirror_models.dart';
import '../data/mirror_repository.dart';
import 'mirror_card_view.dart';

enum _DeckAction { addQuestions, details, delete }

/// Studying a مِرآة file — one card at a time (swipe or buttons), filters
/// for "needs review" and the file's sections, search. While the server is
/// still generating, it polls every 3 s and new cards are appended without
/// moving the student's place (web components/Home.tsx behaviour).
class MirrorDeckScreen extends ConsumerStatefulWidget {
  const MirrorDeckScreen({
    super.key,
    required this.deckId,
    this.pollInterval = const Duration(seconds: 3),
  });

  final String deckId;
  final Duration pollInterval;

  @override
  ConsumerState<MirrorDeckScreen> createState() => _MirrorDeckScreenState();
}

class _MirrorDeckScreenState extends ConsumerState<MirrorDeckScreen> {
  MirrorDeck? _deck;
  final List<MirrorCard> _cards = [];
  Object? _error;
  Timer? _timer;

  String _section = 'all';
  bool _onlyReview = false;
  bool _searching = false;
  final _query = TextEditingController();
  final _pages = PageController();
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _query.dispose();
    _pages.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    _timer?.cancel();
    try {
      final deck = await ref.read(mirrorRepositoryProvider).deck(widget.deckId);
      if (!mounted) return;
      setState(() {
        _deck = deck;
        _error = null;
        // Append only cards not seen yet — the student's place never moves.
        final seen = {for (final c in _cards) c.id};
        _cards.addAll(deck.cards.where((c) => !seen.contains(c.id)));
      });
      if (deck.isLive) _timer = Timer(widget.pollInterval, _load);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
    }
  }

  List<MirrorCard> get _visible => _cards
      .where(
        (c) =>
            c.matches(_query.text) &&
            (!_onlyReview || c.needsReview) &&
            (_section == 'all' || c.sectionId == _section),
      )
      .toList();

  void _resetPosition() {
    _index = 0;
    if (_pages.hasClients) _pages.jumpToPage(0);
  }

  void _go(int delta, int count) {
    final next = (_index + delta).clamp(0, count - 1);
    if (next == _index) return;
    _pages.animateToPage(
      next,
      duration: MediaQuery.of(context).disableAnimations
          ? const Duration(milliseconds: 1)
          : NlMotion.normal,
      curve: NlMotion.ease,
    );
  }

  Future<void> _onAction(_DeckAction action) async {
    final l10n = AppLocalizations.of(context);
    final deck = _deck!;
    switch (action) {
      case _DeckAction.addQuestions:
        await context.push(Routes.mirrorAppend(deck.id));
        await _load();
      case _DeckAction.details:
        if (deck.jobId != null) {
          await context.push(Routes.mirrorJob(deck.jobId!, detailsOnly: true));
          await _load();
        }
      case _DeckAction.delete:
        final ok = await showNlConfirm(
          context,
          title: l10n.deckDeleteTitle,
          message: l10n.deckDeleteBody,
          confirmLabel: l10n.deckDelete,
          destructive: true,
        );
        if (!ok || !mounted) return;
        try {
          await ref.read(mirrorRepositoryProvider).deleteDeck(deck.id);
          ref
            ..invalidate(decksProvider)
            ..invalidate(subjectsProvider);
          if (mounted) context.pop();
        } catch (error) {
          if (mounted) showNlToast(context, apiErrorText(context, error));
        }
    }
  }

  String _origin(MirrorCard card, AppLocalizations l10n) {
    final section = _deck?.section(card.sectionId);
    return section != null && section.fromText
        ? section.label
        : l10n.cardPage(card.sourcePage);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final deck = _deck;
    if (deck == null) {
      return Scaffold(
        appBar: AppBar(),
        body: _error != null
            ? NlErrorView(error: _error!, onRetry: _load)
            : const Center(child: CircularProgressIndicator()),
      );
    }
    final visible = _visible;
    if (_index >= visible.length && visible.isNotEmpty) {
      _index = visible.length - 1;
    }

    return Scaffold(
      appBar: AppBar(
        title: _searching
            ? TextField(
                controller: _query,
                autofocus: true,
                onChanged: (_) => setState(_resetPosition),
                decoration: InputDecoration(
                  hintText: l10n.deckSearch,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  filled: false,
                ),
              )
            : Text(isolate(bookDisplayTitle(deck.fileName))),
        actions: [
          IconButton(
            tooltip: l10n.deckSearch,
            icon: Icon(_searching ? LucideIcons.x : LucideIcons.search),
            onPressed: () => setState(() {
              _searching = !_searching;
              if (!_searching) _query.clear();
              _resetPosition();
            }),
          ),
          PopupMenuButton<_DeckAction>(
            tooltip: l10n.deckMore,
            icon: const Icon(LucideIcons.ellipsisVertical),
            onSelected: _onAction,
            itemBuilder: (_) => [
              PopupMenuItem(
                value: _DeckAction.addQuestions,
                child: Text(l10n.deckAddQuestions),
              ),
              if (deck.jobId != null)
                PopupMenuItem(
                  value: _DeckAction.details,
                  child: Text(l10n.deckDetails),
                ),
              PopupMenuItem(
                value: _DeckAction.delete,
                child: Text(
                  l10n.deckDelete,
                  style: const TextStyle(color: NlColors.wrong),
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          _Filters(
            total: _cards.length,
            reviewCount: _cards.where((c) => c.needsReview).length,
            sections: deck.sections,
            section: _section,
            onlyReview: _onlyReview,
            onSection: (id) => setState(() {
              _section = id;
              _resetPosition();
            }),
            onToggleReview: () => setState(() {
              _onlyReview = !_onlyReview;
              _resetPosition();
            }),
          ),
          if (deck.isLive)
            _Banner(
              icon: null,
              text: _cards.isEmpty
                  ? l10n.deckWaiting
                  : l10n.deckLive(_cards.length),
            )
          else if (deck.failedBatchCount > 0)
            _Banner(
              icon: LucideIcons.circleAlert,
              text: l10n.deckFailedParts(deck.failedBatchCount),
              action: deck.jobId == null
                  ? null
                  : () => _onAction(_DeckAction.details),
              actionLabel: l10n.deckDetails,
            ),
          if (visible.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                NlSpace.page,
                NlSpace.sm,
                NlSpace.page,
                0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    l10n.deckCardOf(_index + 1, visible.length),
                    style: NlText.label,
                  ),
                  const SizedBox(height: 6),
                  NlProgressBar(value: (_index + 1) / visible.length),
                ],
              ),
            ),
          Expanded(
            child: visible.isEmpty
                ? (deck.isLive && _cards.isEmpty
                      ? const Center(child: CircularProgressIndicator())
                      : NlEmptyState(
                          title: l10n.deckEmpty,
                          message: l10n.deckEmptyHint,
                        ))
                : PageView.builder(
                    controller: _pages,
                    itemCount: visible.length,
                    onPageChanged: (i) => setState(() => _index = i),
                    itemBuilder: (context, i) => SingleChildScrollView(
                      padding: const EdgeInsets.all(NlSpace.page),
                      child: MirrorCardView(
                        key: ValueKey(visible[i].id),
                        card: visible[i],
                        origin: _origin(visible[i], l10n),
                      ),
                    ),
                  ),
          ),
        ],
      ),
      bottomNavigationBar: visible.isEmpty
          ? null
          : DecoratedBox(
              decoration: const BoxDecoration(
                color: NlColors.sheet,
                border: Border(top: BorderSide(color: NlColors.rule)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: NlSpace.page,
                    vertical: NlSpace.sm,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: NlButton(
                          label: l10n.deckPrevious,
                          kind: NlButtonKind.secondary,
                          onPressed: _index > 0
                              ? () => _go(-1, visible.length)
                              : null,
                        ),
                      ),
                      const SizedBox(width: NlSpace.sm),
                      Expanded(
                        child: NlButton(
                          label: l10n.deckNext,
                          onPressed: _index < visible.length - 1
                              ? () => _go(1, visible.length)
                              : null,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
}

class _Filters extends StatelessWidget {
  const _Filters({
    required this.total,
    required this.reviewCount,
    required this.sections,
    required this.section,
    required this.onlyReview,
    required this.onSection,
    required this.onToggleReview,
  });

  final int total;
  final int reviewCount;
  final List<DeckSection> sections;
  final String section;
  final bool onlyReview;
  final ValueChanged<String> onSection;
  final VoidCallback onToggleReview;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    Widget chip(
      String label,
      bool selected,
      VoidCallback onTap, {
      IconData? icon,
    }) => Padding(
      padding: const EdgeInsetsDirectional.only(end: NlSpace.sm),
      child: FilterChip(
        label: Text(label),
        avatar: icon == null ? null : Icon(icon, size: 16),
        selected: selected,
        showCheckmark: false,
        onSelected: (_) => onTap(),
        selectedColor: NlColors.marker,
        backgroundColor: NlColors.sheet,
        side: BorderSide(color: selected ? NlColors.marker : NlColors.rule),
        labelStyle: NlText.label.copyWith(color: NlColors.ink),
      ),
    );
    return SizedBox(
      height: 52,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: NlSpace.page,
          vertical: NlSpace.sm,
        ),
        children: [
          chip('${l10n.deckAll} · $total', section == 'all' && !onlyReview, () {
            if (onlyReview) onToggleReview();
            onSection('all');
          }),
          if (reviewCount > 0)
            chip(
              '${l10n.deckNeedsReview} · $reviewCount',
              onlyReview,
              onToggleReview,
              icon: LucideIcons.circleAlert,
            ),
          if (sections.length > 1)
            for (final s in sections)
              chip(
                '${isolate(s.label)} · ${s.cardCount}',
                section == s.id,
                () => onSection(s.id),
              ),
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.icon,
    required this.text,
    this.action,
    this.actionLabel,
  });

  final IconData? icon;
  final String text;
  final VoidCallback? action;
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: NlColors.niroSoft,
      padding: const EdgeInsets.symmetric(
        horizontal: NlSpace.page,
        vertical: NlSpace.sm,
      ),
      child: Row(
        children: [
          if (icon == null)
            const SizedBox.square(
              dimension: 14,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Icon(icon, size: 16, color: NlColors.niroDeep),
          const SizedBox(width: NlSpace.sm),
          Expanded(
            child: Semantics(
              liveRegion: true,
              child: Text(
                text,
                style: NlText.caption.copyWith(color: NlColors.ink2),
              ),
            ),
          ),
          if (action != null && actionLabel != null)
            NlButton(
              label: actionLabel!,
              kind: NlButtonKind.ghost,
              onPressed: action,
            ),
        ],
      ),
    );
  }
}
