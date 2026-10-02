import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/storage/persisted_map.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../study/data/study_models.dart';
import '../../study/data/study_repository.dart';
import '../../study/presentation/study_screen.dart' show StudyTitle;
import '../../study/presentation/study_widgets.dart';
import '../domain/match_game.dart';

const _pairsPerRound = 6;

/// Best time per book, kept on the device (the web keeps it in
/// localStorage).
final matchBestProvider = NotifierProvider<_Best, Map<String, Duration>>(
  _Best.new,
);

class _Best extends PersistedMapNotifier<Duration> {
  @override
  String get storeKey => 'best-match';
  @override
  Object? encode(Duration value) => value.inMilliseconds;
  @override
  Duration? decode(Object? json) =>
      json is num ? Duration(milliseconds: json.toInt()) : null;

  void set(String bookId, Duration time) => put(bookId, time);
}

/// Quizlet-style match game over the file's own cards and terms (the web's
/// app/books/[bookId]/match): tap a question then its answer — a right
/// pair disappears, a wrong one flashes red and costs a second.
class MatchScreen extends ConsumerStatefulWidget {
  const MatchScreen({super.key, required this.bookId, this.random});

  final String bookId;

  /// For tests: a deterministic source.
  final RandomSource? random;

  @override
  ConsumerState<MatchScreen> createState() => _MatchScreenState();
}

class _MatchScreenState extends ConsumerState<MatchScreen> {
  StudyContent? _content;
  int _available = 0;
  Object? _error;
  late final RandomSource _random = widget.random ?? math.Random().nextDouble;

  List<MatchTile> _tiles = const [];
  final _matched = <String>{};
  MatchTile? _selected;
  List<String> _wrong = const [];
  Duration _penalty = Duration.zero;
  final _clock = Stopwatch();
  final _elapsed = ValueNotifier(Duration.zero);
  Duration? _finished;
  Timer? _ticker;
  Timer? _wrongTimer;
  int _round = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _wrongTimer?.cancel();
    _elapsed.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final content = await ref
          .read(studyRepositoryProvider)
          .content(widget.bookId);
      if (!mounted) return;
      setState(() {
        _content = content;
        _available = _pairs(content).length;
        _error = null;
      });
      _start();
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  List<MatchPair> _pairs(StudyContent c) => buildMatchPairs(
    [
      for (final card in c.cards)
        (id: card.id, questionEn: card.questionEn, answerEn: card.answerEn),
    ],
    c.terms,
    count: _pairsPerRound,
    random: _random,
  );

  void _start() {
    final content = _content;
    if (content == null) return;
    _ticker?.cancel();
    setState(() {
      _round++;
      _tiles = buildMatchTiles(_pairs(content), random: _random);
      _matched.clear();
      _selected = null;
      _wrong = const [];
      _penalty = Duration.zero;
      _finished = null;
      _elapsed.value = Duration.zero;
      _clock
        ..reset()
        ..start();
    });
    _ticker = Timer.periodic(const Duration(milliseconds: 100), (_) {
      _elapsed.value = _clock.elapsed + _penalty;
    });
  }

  void _tap(MatchTile tile) {
    if (_finished != null || _matched.contains(tile.id) || _wrong.isNotEmpty) {
      return;
    }
    final selected = _selected;
    if (selected == null) {
      setState(() => _selected = tile);
      return;
    }
    if (selected.id == tile.id) {
      setState(() => _selected = null);
      return;
    }
    if (isMatch(selected, tile)) {
      HapticFeedback.selectionClick();
      setState(() {
        _matched
          ..add(selected.id)
          ..add(tile.id);
        _selected = null;
      });
      if (_matched.length == _tiles.length) _finish();
      return;
    }
    // Wrong pair: flash both red for a moment, add the penalty.
    HapticFeedback.mediumImpact();
    setState(() {
      _wrong = [selected.id, tile.id];
      _penalty += mismatchPenalty;
      _selected = null;
    });
    _elapsed.value = _clock.elapsed + _penalty;
    _wrongTimer?.cancel();
    _wrongTimer = Timer(const Duration(milliseconds: 550), () {
      if (mounted) setState(() => _wrong = const []);
    });
  }

  void _finish() {
    _clock.stop();
    _ticker?.cancel();
    final total = _clock.elapsed + _penalty;
    final best = ref.read(matchBestProvider)[widget.bookId];
    if (best == null || total < best) {
      ref.read(matchBestProvider.notifier).set(widget.bookId, total);
    }
    setState(() => _finished = total);
    _elapsed.value = total;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final content = _content;
    if (content == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.toolMatch)),
        body: _error == null
            ? const Center(child: CircularProgressIndicator())
            : NlErrorView(error: _error!, onRetry: _load),
      );
    }
    if (_available < 3) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.toolMatch)),
        body: NlEmptyState(
          title: l10n.matchNeedCards,
          message: l10n.matchNeedCardsHint,
          actionLabel: l10n.matchMakeCards,
          onAction: () =>
              context.pushReplacement(Routes.bookStudy(widget.bookId, 'cards')),
          expression: NiroExpression.sleepy,
        ),
      );
    }

    final best = ref.watch(matchBestProvider)[widget.bookId];
    final finished = _finished;
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: kToolbarHeight + 8,
        title: ValueListenableBuilder(
          valueListenable: _elapsed,
          builder: (_, value, _) => StudyTitle(
            title: l10n.matchSeconds(_seconds(value)),
            book: content.title,
          ),
        ),
        actions: [
          IconButton(
            tooltip: l10n.matchNewRound,
            icon: const Icon(LucideIcons.rotateCcw),
            onPressed: _start,
          ),
        ],
      ),
      body: finished != null
          ? StudyResult(
              expression: NiroExpression.victory,
              title: l10n.matchDone(_seconds(finished)),
              body: [
                best == finished
                    ? l10n.matchRecord
                    : l10n.matchBest(_seconds(best ?? finished)),
                if (_penalty > Duration.zero)
                  l10n.matchMistakes(_penalty.inSeconds),
              ].join('\n'),
              actions: [
                NlButton(
                  label: l10n.matchPlayAgain,
                  icon: LucideIcons.rotateCcw,
                  expand: true,
                  onPressed: _start,
                ),
                NlButton(
                  label: l10n.studyBack,
                  kind: NlButtonKind.secondary,
                  expand: true,
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
              ],
            )
          : Padding(
              padding: const EdgeInsets.all(NlSpace.page),
              child: Column(
                children: [
                  Text(
                    l10n.matchHint,
                    style: NlText.secondary,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: NlSpace.md),
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, box) {
                        const columns = 2;
                        final rows = (_tiles.length / columns).ceil();
                        const gap = NlSpace.sm;
                        final w = (box.maxWidth - gap) / columns;
                        final h = (box.maxHeight - gap * (rows - 1)) / rows;
                        return GridView.count(
                          key: ValueKey(_round),
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: columns,
                          mainAxisSpacing: gap,
                          crossAxisSpacing: gap,
                          childAspectRatio: w / math.max(h, 48),
                          children: [
                            for (final tile in _tiles)
                              _Tile(
                                tile: tile,
                                matched: _matched.contains(tile.id),
                                wrong: _wrong.contains(tile.id),
                                selected: _selected?.id == tile.id,
                                onTap: () => _tap(tile),
                              ),
                          ],
                        );
                      },
                    ),
                  ),
                  if (best != null) ...[
                    const SizedBox(height: NlSpace.sm),
                    Text(
                      l10n.matchBestLine(_seconds(best)),
                      style: NlText.caption,
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

String _seconds(Duration d) => (d.inMilliseconds / 1000).toStringAsFixed(1);

class _Tile extends StatelessWidget {
  const _Tile({
    required this.tile,
    required this.matched,
    required this.wrong,
    required this.selected,
    required this.onTap,
  });

  final MatchTile tile;
  final bool matched;
  final bool wrong;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color border) = wrong
        ? (NlColors.wrongSoft, NlColors.wrong)
        : selected
        ? (NlColors.markerSoft, NlColors.ink)
        : (NlColors.sheet, NlColors.rule);
    return AnimatedOpacity(
      opacity: matched ? 0 : 1,
      duration: NlMotion.fast,
      child: IgnorePointer(
        ignoring: matched,
        child: Semantics(
          button: true,
          selected: selected,
          child: Material(
            color: bg,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(NlRadius.md),
              side: BorderSide(color: border, width: selected || wrong ? 2 : 1),
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(NlRadius.md),
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.all(NlSpace.sm),
                child: Center(
                  child: AutoDirText(
                    tile.text,
                    maxLines: 5,
                    overflow: TextOverflow.ellipsis,
                    style: NlText.body.copyWith(
                      fontSize: 14,
                      height: 1.3,
                      fontWeight: tile.kind == TileKind.prompt
                          ? FontWeight.w600
                          : FontWeight.w400,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
