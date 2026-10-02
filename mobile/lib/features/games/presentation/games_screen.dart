import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/games_models.dart';
import '../data/games_repository.dart';

/// ألعاب — the web's app/games: every game with the player's saved progress.
/// Online only (the server generates and scores every stage).
class GamesScreen extends ConsumerWidget {
  const GamesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final games = ref.watch(gamesOverviewProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.gamesTitle)),
      body: games.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(NlSpace.page),
          child: NlListSkeleton(),
        ),
        error: (e, _) => NlErrorView(
          error: e,
          onRetry: () => ref.invalidate(gamesOverviewProvider),
        ),
        data: (list) {
          final newPlayer = list.every((g) => g.progress == null);
          return RefreshIndicator(
            color: NlColors.ink,
            onRefresh: () async {
              ref.invalidate(gamesOverviewProvider);
              try {
                await ref.read(gamesOverviewProvider.future);
              } catch (_) {}
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                NlSpace.page,
                0,
                NlSpace.page,
                NlSpace.xxxl,
              ),
              children: [
                Text(l10n.gamesIntro, style: NlText.secondary),
                const SizedBox(height: NlSpace.lg),
                if (newPlayer && list.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(bottom: NlSpace.lg),
                    padding: const EdgeInsets.all(NlSpace.lg),
                    decoration: BoxDecoration(
                      color: NlColors.ink,
                      borderRadius: BorderRadius.circular(NlRadius.lg),
                    ),
                    child: Row(
                      children: [
                        const NiroImage(
                          expression: NiroExpression.challenge,
                          size: 72,
                        ),
                        const SizedBox(width: NlSpace.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l10n.gamesWelcome,
                                style: NlText.title.copyWith(
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                l10n.gamesWelcomeBody,
                                style: NlText.secondary.copyWith(
                                  color: Colors.white70,
                                ),
                              ),
                              const SizedBox(height: NlSpace.sm),
                              NlButton(
                                label: l10n.gamesStartFirst,
                                kind: NlButtonKind.marker,
                                onPressed: () =>
                                    context.push(Routes.game(list.first.id)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                for (final game in list) _GameCard(game: game),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _GameCard extends StatelessWidget {
  const _GameCard({required this.game});
  final GameSummary game;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final p = game.progress;
    final stage = p?.currentStage ?? 1;
    final completed = p?.completedStages.length ?? 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: NlSpace.md),
      child: Material(
        color: NlColors.sheet,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NlRadius.lg),
          side: const BorderSide(color: NlColors.rule),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(NlRadius.lg),
          onTap: () => context.push(Routes.game(game.id)),
          child: Padding(
            padding: const EdgeInsets.all(NlSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Text(game.emoji, style: const TextStyle(fontSize: 30)),
                    const SizedBox(width: NlSpace.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(game.title, style: NlText.title),
                          Text(game.tagline, style: NlText.secondary),
                        ],
                      ),
                    ),
                    Icon(
                      Directionality.of(context) == TextDirection.rtl
                          ? LucideIcons.chevronLeft
                          : LucideIcons.chevronRight,
                      color: NlColors.ink3,
                    ),
                  ],
                ),
                const SizedBox(height: NlSpace.md),
                if (p != null) ...[
                  Wrap(
                    spacing: NlSpace.md,
                    children: [
                      Text(
                        l10n.gamesStageOf(
                          isolateLtr('$stage/${game.totalStages}'),
                        ),
                        style: NlText.caption,
                      ),
                      if (p.bestScore > 0)
                        Text(
                          l10n.gamesBestScore(isolateLtr('${p.bestScore}')),
                          style: NlText.caption,
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  NlProgressBar(
                    value: completed / game.totalStages,
                    semanticsLabel: l10n.gamesCompletedStages,
                  ),
                  const SizedBox(height: NlSpace.sm),
                  Text(
                    '▶ ${l10n.gamesContinueStage(stage)}',
                    style: NlText.rowLabel.copyWith(fontSize: 14),
                  ),
                ] else
                  Text(
                    '▶ ${l10n.gamesStartStage1}',
                    style: NlText.rowLabel.copyWith(
                      fontSize: 14,
                      color: NlColors.niroDeep,
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

/// One game — the web's app/games/[gameId]: the level (step back through
/// unlocked levels to replay one), saved stats, play / continue.
class GameScreen extends ConsumerStatefulWidget {
  const GameScreen({super.key, required this.gameId});

  final String gameId;

  @override
  ConsumerState<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends ConsumerState<GameScreen> {
  int? _selected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final game = ref.watch(gameProvider(widget.gameId));
    return Scaffold(
      appBar: AppBar(title: Text(game.value?.title ?? l10n.gamesTitle)),
      body: game.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(NlSpace.page),
          child: NlListSkeleton(),
        ),
        error: (e, _) => NlErrorView(
          error: e,
          onRetry: () => ref.invalidate(gameProvider(widget.gameId)),
        ),
        data: (g) {
          final p = g.progress;
          final current = p?.currentStage ?? 1;
          final highest = p?.highestUnlockedStage ?? 1;
          final stage = (_selected ?? current).clamp(1, highest);
          final done = p?.completedStages.contains(stage) ?? false;
          final best = p?.stageBests['$stage'];
          final resuming = g.activeStage == stage;
          final completed = p?.completedStages.length ?? 0;
          final rtl = Directionality.of(context) == TextDirection.rtl;
          final label = resuming
              ? l10n.gamesResumeStage(stage)
              : done
              ? l10n.gamesReplayStage(stage)
              : p != null
              ? l10n.gamesPlayStage(stage)
              : l10n.gamesStartStage1;
          return ListView(
            padding: const EdgeInsets.all(NlSpace.page),
            children: [
              Container(
                padding: const EdgeInsets.all(NlSpace.xl),
                decoration: BoxDecoration(
                  color: NlColors.ink,
                  borderRadius: BorderRadius.circular(NlRadius.lg),
                ),
                child: Column(
                  children: [
                    Text(g.emoji, style: const TextStyle(fontSize: 44)),
                    Text(
                      g.title,
                      style: NlText.display.copyWith(color: Colors.white),
                    ),
                    Text(
                      g.tagline,
                      style: NlText.secondary.copyWith(color: Colors.white70),
                    ),
                    const SizedBox(height: NlSpace.lg),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        IconButton(
                          tooltip: l10n.gamesPrevLevel,
                          color: Colors.white,
                          disabledColor: Colors.white24,
                          icon: Icon(
                            rtl
                                ? LucideIcons.chevronRight
                                : LucideIcons.chevronLeft,
                          ),
                          onPressed: stage <= 1
                              ? null
                              : () => setState(() => _selected = stage - 1),
                        ),
                        Column(
                          children: [
                            Text(
                              l10n.gamesLevel,
                              style: NlText.caption.copyWith(
                                color: Colors.white70,
                              ),
                            ),
                            Text(
                              isolateLtr('$stage/${g.totalStages}'),
                              style: NlText.display.copyWith(
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              done
                                  ? '✓ ${l10n.gamesDone}${best == null ? '' : ' · $best'}'
                                  : stage == current
                                  ? l10n.gamesCurrentLevel
                                  : l10n.gamesOpenLevel,
                              style: NlText.caption.copyWith(
                                color: Colors.white70,
                              ),
                            ),
                          ],
                        ),
                        IconButton(
                          tooltip: l10n.gamesNextLevel,
                          color: Colors.white,
                          disabledColor: Colors.white24,
                          icon: Icon(
                            rtl
                                ? LucideIcons.chevronLeft
                                : LucideIcons.chevronRight,
                          ),
                          onPressed: stage >= highest
                              ? null
                              : () => setState(() => _selected = stage + 1),
                        ),
                      ],
                    ),
                    const SizedBox(height: NlSpace.md),
                    NlProgressBar(
                      value: completed / g.totalStages,
                      semanticsLabel: l10n.gamesCompletedStages,
                    ),
                    const SizedBox(height: NlSpace.lg),
                    NlButton(
                      label: label,
                      kind: NlButtonKind.marker,
                      icon: LucideIcons.play,
                      expand: true,
                      onPressed: () async {
                        await context.push(Routes.gamePlay(g.id, stage));
                        ref
                          ..invalidate(gameProvider(widget.gameId))
                          ..invalidate(gamesOverviewProvider);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: NlSpace.lg),
              Row(
                children: [
                  _Stat(l10n.gamesStatBest, isolateLtr('${p?.bestScore ?? 0}')),
                  const SizedBox(width: NlSpace.sm),
                  _Stat(
                    l10n.gamesStatAccuracy,
                    p?.accuracy == null ? '—' : isolateLtr('${p!.accuracy}%'),
                  ),
                  const SizedBox(width: NlSpace.sm),
                  _Stat(
                    g.kind == GameKind.sudoku
                        ? l10n.gamesStatFastestSolve
                        : l10n.gamesStatFastestAnswer,
                    isolateLtr(formatGameMs(p?.bestTimeMs)),
                  ),
                ],
              ),
              const SizedBox(height: NlSpace.md),
              Text(l10n.gamesOnlineOnly, style: NlText.caption),
            ],
          );
        },
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(NlSpace.md),
        decoration: BoxDecoration(
          color: NlColors.sheet,
          borderRadius: BorderRadius.circular(NlRadius.md),
          border: Border.all(color: NlColors.rule),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: NlText.caption, maxLines: 1),
            Text(value, style: NlText.title),
          ],
        ),
      ),
    );
  }
}
