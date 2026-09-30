import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/api/api_error.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/games_models.dart';
import '../data/games_repository.dart';
import '../domain/game_rules.dart';
import 'sudoku_player.dart';

/// Play one stage — the web's app/games/[gameId]/play: resumes the server's
/// active session for this stage (app closed, other device) instead of
/// starting over; otherwise asks the server to start it (locked → refused).
class PlayScreen extends ConsumerStatefulWidget {
  const PlayScreen({super.key, required this.gameId, required this.stage});

  final String gameId;
  final int stage;

  @override
  ConsumerState<PlayScreen> createState() => _PlayScreenState();
}

class _PlayScreenState extends ConsumerState<PlayScreen> {
  late int _stage = widget.stage;
  GameSession? _session;
  StageResult? _result;
  Object? _error;

  GamesRepository get _repo => ref.read(gamesRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _open(resume: true);
  }

  Future<void> _open({required bool resume}) async {
    setState(() {
      _session = null;
      _result = null;
      _error = null;
    });
    try {
      GameSession? session;
      if (resume) {
        final active = await _repo.activeSession(widget.gameId);
        if (active != null && active.stage == _stage) session = active;
      }
      session ??= await _repo.startStage(widget.gameId, _stage);
      if (mounted) setState(() => _session = session);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  void _finished(StageResult result) {
    ref
      ..invalidate(gamesOverviewProvider)
      ..invalidate(gameProvider(widget.gameId));
    setState(() => _result = result);
  }

  void _goTo(int stage) {
    _stage = stage;
    _open(resume: false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final game = ref.watch(gameProvider(widget.gameId)).value;
    final session = _session;
    final Widget body;
    if (_result != null) {
      body = StageResultView(
        result: _result!,
        kind: session?.kind ?? GameKind.quiz,
        totalStages: game?.totalStages ?? 100,
        onNext: () => _goTo(_result!.nextStage!),
        onRetry: () => _goTo(_result!.stage),
        onBack: () => context.go(Routes.games),
      );
    } else if (_error != null) {
      final locked = _error is ForbiddenException;
      body = NlEmptyState(
        expression: locked ? NiroExpression.sleepy : NiroExpression.shocked,
        title: locked ? l10n.gamesLocked : l10n.gamesStartFailed,
        message: apiErrorText(context, _error!),
        actionLabel: locked ? l10n.gamesBackToLevels : l10n.actionRetry,
        onAction: locked ? () => context.pop() : () => _open(resume: true),
      );
    } else if (session == null) {
      body = Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: NlSpace.md),
            Text(l10n.gamesPreparing(_stage), style: NlText.secondary),
          ],
        ),
      );
    } else if (session.kind == GameKind.quiz) {
      body = QuizPlayer(
        key: ValueKey(session.sessionId),
        session: session,
        // Math games move on by themselves; General Knowledge waits so
        // the explanation can be read.
        autoAdvance: widget.gameId != 'general_knowledge',
        onFinished: _finished,
        onRestart: () => _goTo(session.stage),
      );
    } else {
      body = SudokuPlayer(
        key: ValueKey(session.sessionId),
        session: session,
        onFinished: _finished,
        onRestart: () => _goTo(session.stage),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${game?.emoji ?? ''} ${game?.title ?? ''}'.trim(),
              style: NlText.title,
            ),
            Text(
              l10n.gamesStageOf(
                isolateLtr(
                  '${session?.stage ?? _stage}/${game?.totalStages ?? '—'}',
                ),
              ),
              style: NlText.caption,
            ),
          ],
        ),
      ),
      body: body,
    );
  }
}

enum _Phase { ready, question, feedback, submitting, error }

enum _ErrorKind { network, expired, other }

/// The web's QuizPlayer: a countdown from an absolute deadline, instant
/// feedback, the live score, and every answer kept on the device the
/// moment it is given — reopening resumes the same question with the time
/// already used (never extra time), and a finished stage is re-sent.
class QuizPlayer extends ConsumerStatefulWidget {
  const QuizPlayer({
    super.key,
    required this.session,
    required this.autoAdvance,
    required this.onFinished,
    required this.onRestart,
    this.now,
  });

  final GameSession session;
  final bool autoAdvance;
  final ValueChanged<StageResult> onFinished;
  final VoidCallback onRestart;

  /// Clock (tests).
  final int Function()? now;

  @override
  ConsumerState<QuizPlayer> createState() => _QuizPlayerState();
}

class _QuizPlayerState extends ConsumerState<QuizPlayer>
    with WidgetsBindingObserver {
  var _phase = _Phase.ready;
  var _index = 0;
  var _answers = <QuizAnswer>[];
  int? _shownAt;
  late int _nowMs = _clock();
  Timer? _ticker;
  Timer? _advance;
  Timer? _networkRetry;
  bool _submitted = false;
  bool _loaded = false;
  _ErrorKind _errorKind = _ErrorKind.other;
  String _errorMessage = '';

  GamesRepository get _repo => ref.read(gamesRepositoryProvider);
  List<QuizQuestion> get _questions => widget.session.questions;
  String get _sessionId => widget.session.sessionId;

  int _clock() => widget.now?.call() ?? DateTime.now().millisecondsSinceEpoch;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _restore();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker?.cancel();
    _advance?.cancel();
    _networkRetry?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Back from the background: a failed submit is tried again at once.
    if (state == AppLifecycleState.resumed &&
        _phase == _Phase.error &&
        _errorKind == _ErrorKind.network) {
      _submit();
    }
  }

  Future<void> _restore() async {
    final saved = await _repo.loadQuiz(_sessionId);
    if (!mounted) return;
    setState(() {
      _loaded = true;
      if (saved == null) return;
      _index = saved.index;
      _answers = [...saved.answers];
      _shownAt = saved.shownAt;
      if (_answers.length >= _questions.length) {
        _phase = _Phase.submitting;
      } else if (_index < _answers.length) {
        // Reopened right after answering: show that answer's feedback —
        // the same question is never answered twice.
        _phase = _Phase.feedback;
      } else {
        _phase = _shownAt == null ? _Phase.ready : _Phase.question;
      }
    });
    if (_phase == _Phase.submitting) unawaited(_submit());
    if (_phase == _Phase.question) _startTicker();
    if (_phase == _Phase.feedback && widget.autoAdvance) _scheduleAdvance();
  }

  void _persist() => _repo.saveQuiz(
    _sessionId,
    QuizProgress(index: _index, answers: _answers, shownAt: _shownAt),
  );

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(milliseconds: 100), (_) {
      if (!mounted) return;
      final t = _clock();
      setState(() => _nowMs = t);
      final q = _questions[_index];
      if (_shownAt != null && t >= _shownAt! + q.timeLimitMs) _record(null, t);
    });
  }

  void _begin() {
    final at = _clock();
    setState(() {
      _shownAt = at;
      _nowMs = at;
      _phase = _Phase.question;
    });
    _persist();
    _startTicker();
  }

  void _record(int? choice, int at) {
    if (_phase != _Phase.question || _shownAt == null) return;
    _ticker?.cancel();
    final q = _questions[_index];
    final timeMs = choice == null
        ? q.timeLimitMs
        : (at - _shownAt!).clamp(0, q.timeLimitMs);
    if (choice != null) {
      choice == q.correctIndex
          ? HapticFeedback.lightImpact()
          : HapticFeedback.heavyImpact();
    }
    setState(() {
      _answers = [..._answers, QuizAnswer(choice: choice, timeMs: timeMs)];
      _phase = _Phase.feedback;
    });
    _persist();
    if (widget.autoAdvance) _scheduleAdvance();
  }

  void _scheduleAdvance() {
    _advance?.cancel();
    _advance = Timer(const Duration(milliseconds: 850), _next);
  }

  void _next() {
    _advance?.cancel();
    if (!mounted || _phase != _Phase.feedback) return;
    final nextIndex = _index + 1;
    if (nextIndex >= _questions.length) {
      setState(() {
        _index = nextIndex;
        _shownAt = null;
      });
      _persist();
      _submit();
      return;
    }
    final at = _clock();
    setState(() {
      _index = nextIndex;
      _shownAt = at;
      _nowMs = at;
      _phase = _Phase.question;
    });
    _persist();
    _startTicker();
  }

  Future<void> _submit() async {
    if (_submitted) return;
    _submitted = true;
    _networkRetry?.cancel();
    setState(() => _phase = _Phase.submitting);
    try {
      final result = await _repo.submitQuiz(_sessionId, _answers);
      await _repo.clearQuiz(_sessionId);
      if (mounted) widget.onFinished(result);
    } catch (error) {
      _submitted = false;
      if (!mounted) return;
      setState(() {
        _phase = _Phase.error;
        _errorKind = switch (error) {
          NetworkException() || ServerException() => _ErrorKind.network,
          RejectedException(code: 'PRECONDITION_FAILED' || 'CONFLICT') =>
            _ErrorKind.expired,
          _ => _ErrorKind.other,
        };
        _errorMessage = apiErrorText(context, error);
      });
      // The web retries when the connection comes back; without a
      // connectivity listener the app retries every few seconds.
      if (_errorKind == _ErrorKind.network) {
        _networkRetry = Timer(const Duration(seconds: 5), _submit);
      }
    }
  }

  int get _liveScore {
    final answered = _answers.length.clamp(0, _questions.length);
    return scoreQuizStage(
      [
        for (final q in _questions.take(answered))
          (correctIndex: q.correctIndex, timeLimitMs: q.timeLimitMs),
      ],
      _answers,
      widget.session.passCorrect,
    ).pointsPerQuestion.fold(0, (a, b) => a + b);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (!_loaded) return const Center(child: CircularProgressIndicator());
    switch (_phase) {
      case _Phase.ready:
        final limit = ((_questions.firstOrNull?.timeLimitMs ?? 8000) / 1000)
            .round();
        return ListView(
          padding: const EdgeInsets.all(NlSpace.xl),
          children: [
            const NiroImage(expression: NiroExpression.challenge, size: 110),
            const SizedBox(height: NlSpace.md),
            Text(
              l10n.gamesLevelN(widget.session.stage),
              style: NlText.caption,
              textAlign: TextAlign.center,
            ),
            Text(
              _index > 0 ? l10n.gamesReadyContinue : l10n.gamesReady,
              style: NlText.display,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: NlSpace.lg),
            for (final line in [
              l10n.gamesRuleQuestions(_questions.length),
              l10n.gamesRuleSeconds(limit),
              l10n.gamesRulePass(widget.session.passCorrect),
            ])
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  '• $line',
                  style: NlText.body,
                  textAlign: TextAlign.center,
                ),
              ),
            const SizedBox(height: NlSpace.lg),
            NlButton(
              label: _index > 0
                  ? l10n.gamesContinueFrom(_index + 1)
                  : l10n.gamesStart,
              kind: NlButtonKind.marker,
              icon: LucideIcons.play,
              expand: true,
              onPressed: _begin,
            ),
          ],
        );
      case _Phase.submitting:
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: NlSpace.md),
              Text(l10n.gamesScoring, style: NlText.secondary),
            ],
          ),
        );
      case _Phase.error:
        return NlEmptyState(
          expression: _errorKind == _ErrorKind.network
              ? NiroExpression.sleepy
              : NiroExpression.shocked,
          title: switch (_errorKind) {
            _ErrorKind.network => l10n.gamesOffline,
            _ErrorKind.expired => l10n.gamesExpired,
            _ErrorKind.other => l10n.gamesSaveFailed,
          },
          message: _errorKind == _ErrorKind.network
              ? l10n.gamesOfflineBody
              : _errorMessage,
          actionLabel: _errorKind == _ErrorKind.expired
              ? l10n.gamesRestartStage
              : l10n.actionRetry,
          onAction: _errorKind == _ErrorKind.expired
              ? widget.onRestart
              : _submit,
        );
      case _Phase.question:
      case _Phase.feedback:
        return _questionView(l10n);
    }
  }

  Widget _questionView(AppLocalizations l10n) {
    final q = _questions[_index.clamp(0, _questions.length - 1)];
    final feedback = _phase == _Phase.feedback;
    final last = feedback && _index < _answers.length ? _answers[_index] : null;
    final remaining = _shownAt == null
        ? 0
        : (_shownAt! + q.timeLimitMs - _nowMs).clamp(0, q.timeLimitMs);
    final seconds = (remaining / 1000).ceil();
    final timedOut = feedback && last?.choice == null;
    final right = feedback && last?.choice == q.correctIndex;
    const keys = ['A', 'B', 'C', 'D'];

    return ListView(
      padding: const EdgeInsets.all(NlSpace.page),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.gamesQuestionOf(
                  isolateLtr('${_index + 1}/${_questions.length}'),
                ),
                style: NlText.rowLabel,
              ),
            ),
            Semantics(
              label: l10n.gamesPoints(_liveScore),
              child: Text('⭐ $_liveScore', style: NlText.rowLabel),
            ),
          ],
        ),
        const SizedBox(height: NlSpace.sm),
        Semantics(
          label: l10n.gamesTimeLeft(seconds),
          child: Row(
            children: [
              Icon(
                LucideIcons.clock,
                size: 16,
                color: seconds <= 2 && !feedback
                    ? NlColors.wrong
                    : NlColors.ink2,
              ),
              const SizedBox(width: 6),
              Text(
                feedback ? '—' : '$seconds',
                style: NlText.rowLabel.copyWith(
                  color: seconds <= 2 && !feedback
                      ? NlColors.wrong
                      : NlColors.ink,
                ),
              ),
              const SizedBox(width: NlSpace.sm),
              Expanded(
                child: NlProgressBar(
                  value: feedback ? 0 : remaining / q.timeLimitMs,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: NlSpace.xl),
        if (q.category != null)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: NlBadge(q.category!),
          ),
        if (q.instruction != null)
          Text(q.instruction!, style: NlText.secondary),
        const SizedBox(height: NlSpace.sm),
        // "7 × 8 = ?" has no letters: it must read left-to-right, not
        // take the interface's RTL (which showed "? = 8 × 7").
        Text(
          q.prompt,
          textDirection: contentDirection(q.prompt) ?? TextDirection.ltr,
          textAlign: TextAlign.start,
          style: NlText.display.copyWith(fontSize: 24),
        ),
        const SizedBox(height: NlSpace.xl),
        for (var i = 0; i < q.options.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: NlSpace.sm),
            child: _OptionButton(
              letter: keys[i % keys.length],
              text: q.options[i],
              state: !feedback
                  ? _OptState.idle
                  : i == q.correctIndex
                  ? _OptState.correct
                  : last?.choice == i
                  ? _OptState.wrong
                  : _OptState.dim,
              onTap: feedback ? null : () => _record(i, _clock()),
            ),
          ),
        if (feedback)
          Semantics(
            liveRegion: true,
            child: Container(
              margin: const EdgeInsets.only(top: NlSpace.sm),
              padding: const EdgeInsets.all(NlSpace.lg),
              decoration: BoxDecoration(
                color: right ? NlColors.correctSoft : NlColors.wrongSoft,
                borderRadius: BorderRadius.circular(NlRadius.md),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    right
                        ? l10n.gamesRight
                        : timedOut
                        ? l10n.gamesTimeUp
                        : l10n.gamesWrong,
                    style: NlText.title.copyWith(
                      color: right ? NlColors.correct : NlColors.wrong,
                    ),
                  ),
                  if (q.explanation != null) ...[
                    const SizedBox(height: 4),
                    AutoDirText(q.explanation!, style: NlText.body),
                  ],
                  if (!widget.autoAdvance) ...[
                    const SizedBox(height: NlSpace.md),
                    NlButton(
                      label: _index + 1 >= _questions.length
                          ? l10n.gamesResult
                          : l10n.flashNext,
                      expand: true,
                      onPressed: _next,
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }
}

enum _OptState { idle, correct, wrong, dim }

class _OptionButton extends StatelessWidget {
  const _OptionButton({
    required this.letter,
    required this.text,
    required this.state,
    required this.onTap,
  });

  final String letter;
  final String text;
  final _OptState state;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (bg, border) = switch (state) {
      _OptState.correct => (NlColors.correctSoft, NlColors.correct),
      _OptState.wrong => (NlColors.wrongSoft, NlColors.wrong),
      _OptState.dim => (NlColors.sheet, NlColors.rule),
      _OptState.idle => (NlColors.sheet, NlColors.ruleStrong),
    };
    return Material(
      color: bg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(NlRadius.md),
        side: BorderSide(color: border, width: state == _OptState.idle ? 1 : 2),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(NlRadius.md),
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: NlSpace.md),
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: NlColors.paper,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(letter, style: NlText.rowLabel),
                ),
                const SizedBox(width: NlSpace.md),
                // Next to its letter (the web's <span dir="auto"> in the
                // button); a number reads left-to-right inside the row.
                Expanded(
                  child: contentDirection(text) == null
                      ? Text(isolateLtr(text), style: NlText.body)
                      : AutoDirText(text, style: NlText.body),
                ),
                if (state == _OptState.correct)
                  const Icon(LucideIcons.check, color: NlColors.correct),
                if (state == _OptState.wrong)
                  const Icon(LucideIcons.x, color: NlColors.wrong),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

const _niroLevelUp = [
  'مستوى جديد! كمّل هيك ⚡',
  'ولا غلطة تقريبًا… مستواك طالع 🔥',
];
const _niroAlmost = [
  'قربت كثير… جرّب مرة كمان 😏',
  'مش مشكلة، خلينا نعيدها صح 💪',
];
const _niroAllDone = 'خلصت كل المستويات! أنت أسطورة 🏆';

/// The web's StageResultView — only ever the server's verdict.
class StageResultView extends StatelessWidget {
  const StageResultView({
    super.key,
    required this.result,
    required this.kind,
    required this.totalStages,
    required this.onNext,
    required this.onRetry,
    required this.onBack,
  });

  final StageResult result;
  final GameKind kind;
  final int totalStages;
  final VoidCallback onNext;
  final VoidCallback onRetry;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final passed = result.passed;
    final lastStage = result.stage >= totalStages;
    final line = passed
        ? (lastStage
              ? _niroAllDone
              : _niroLevelUp[result.stage % _niroLevelUp.length])
        : _niroAlmost[result.stage % _niroAlmost.length];
    Widget stat(String label, String value) => Container(
      constraints: const BoxConstraints(minWidth: 96),
      padding: const EdgeInsets.all(NlSpace.md),
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.rule),
      ),
      child: Column(
        children: [
          Text(label, style: NlText.caption),
          Text(isolateLtr(value), style: NlText.title),
        ],
      ),
    );
    return Semantics(
      liveRegion: true,
      child: ListView(
        padding: const EdgeInsets.all(NlSpace.xl),
        children: [
          NiroImage(
            expression: passed
                ? NiroExpression.victory
                : NiroExpression.challenge,
            size: 128,
          ),
          const SizedBox(height: NlSpace.md),
          Text(
            passed
                ? (lastStage
                      ? l10n.gamesAllDone
                      : l10n.gamesStageDone(result.stage))
                : l10n.gamesAlmost,
            style: NlText.display,
            textAlign: TextAlign.center,
          ),
          Text(line, style: NlText.secondary, textAlign: TextAlign.center),
          if (!passed && kind == GameKind.quiz)
            Text(
              l10n.gamesNeedMore(
                isolateLtr('${result.correct}/${result.total}'),
              ),
              style: NlText.body,
              textAlign: TextAlign.center,
            ),
          const SizedBox(height: NlSpace.lg),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: NlSpace.sm,
            runSpacing: NlSpace.sm,
            children: [
              stat(l10n.gamesScore, '${result.score}'),
              if (kind == GameKind.quiz) ...[
                stat(l10n.gamesCorrect, '${result.correct}/${result.total}'),
                stat(l10n.gamesStatAccuracy, '${result.accuracy}%'),
                stat(
                  l10n.gamesStatFastestAnswer,
                  formatGameMs(result.fastestMs),
                ),
              ] else ...[
                stat(l10n.gamesTime, formatGameMs(result.timeMs)),
                stat(l10n.gamesHints, '${result.hintsUsed ?? 0}'),
              ],
              stat(l10n.gamesStatBest, '${result.bestScore}'),
            ],
          ),
          if (result.newBest) ...[
            const SizedBox(height: NlSpace.md),
            Text(
              l10n.gamesNewBest,
              style: NlText.rowLabel,
              textAlign: TextAlign.center,
            ),
          ],
          if (result.unlockedStage != null)
            Text(
              l10n.gamesUnlocked(result.unlockedStage!),
              style: NlText.rowLabel,
              textAlign: TextAlign.center,
            ),
          const SizedBox(height: NlSpace.xl),
          if (passed && result.nextStage != null) ...[
            NlButton(
              label: l10n.gamesNextStage,
              kind: NlButtonKind.marker,
              icon: LucideIcons.play,
              expand: true,
              onPressed: onNext,
            ),
            const SizedBox(height: NlSpace.sm),
          ],
          NlButton(
            label: passed ? l10n.gamesRetry : l10n.gamesTryAgain,
            kind: NlButtonKind.secondary,
            icon: LucideIcons.rotateCcw,
            expand: true,
            onPressed: onRetry,
          ),
          const SizedBox(height: NlSpace.sm),
          NlButton(
            label: l10n.gamesBackToGames,
            kind: NlButtonKind.ghost,
            expand: true,
            onPressed: onBack,
          ),
        ],
      ),
    );
  }
}
