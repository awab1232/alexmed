import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_error.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/games_models.dart';
import '../data/games_repository.dart';
import '../domain/game_rules.dart';

enum _Status { playing, submitting, network, expired }

typedef _History = ({int index, int value, List<int> notes});

/// The web's SudokuPlayer: 9×9 board (always left-to-right), notes mode,
/// undo, erase, server hints (the solution never reaches the device), a
/// play clock that runs only while the app is in the foreground, mistakes,
/// and autosave — to the device at once and to the server 1.5 s after the
/// last move (and when the app goes to the background). A full board
/// without conflicts is sent for the server to verify.
class SudokuPlayer extends ConsumerStatefulWidget {
  const SudokuPlayer({
    super.key,
    required this.session,
    required this.onFinished,
    required this.onRestart,
  });

  final GameSession session;
  final ValueChanged<StageResult> onFinished;
  final VoidCallback onRestart;

  @override
  ConsumerState<SudokuPlayer> createState() => _SudokuPlayerState();
}

class _SudokuPlayerState extends ConsumerState<SudokuPlayer>
    with WidgetsBindingObserver {
  late List<int> _board;
  late List<List<int>> _notes;
  int _mistakes = 0;
  final _history = <_History>[];
  int? _selected;
  bool _notesMode = false;
  late int _hintsUsed = widget.session.hintsUsed;
  bool _hinting = false;
  String _message = '';
  var _status = _Status.playing;
  bool _loaded = false;

  int _elapsedBase = 0;
  DateTime? _runningSince;
  Timer? _clock;
  Timer? _serverSave;
  Timer? _localSave;
  Timer? _networkRetry;
  bool _submitting = false;

  // Read once: it is also used while the widget is being disposed.
  late final GamesRepository _repo;
  String get _sessionId => widget.session.sessionId;
  List<int> get _puzzle => widget.session.puzzle;

  int get _elapsed =>
      _elapsedBase +
      (_runningSince == null
          ? 0
          : DateTime.now().difference(_runningSince!).inMilliseconds);

  SudokuState get _snapshot => SudokuState(
    board: _board,
    notes: _notes,
    elapsedMs: _elapsed,
    mistakes: _mistakes,
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _repo = ref.read(gamesRepositoryProvider);
    _board = [..._puzzle];
    _notes = List.generate(81, (_) => <int>[]);
    _restore();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pause();
    if (_loaded && _status == _Status.playing) {
      // Leaving the screen: keep the latest board both places.
      _repo.saveSudokuLocal(_sessionId, _snapshot);
      _repo.sudokuSave(_sessionId, _snapshot).catchError((_) {});
    }
    _clock?.cancel();
    _serverSave?.cancel();
    _localSave?.cancel();
    _networkRetry?.cancel();
    super.dispose();
  }

  Future<void> _restore() async {
    // This device's copy first (the newest), then the server's autosave,
    // else a fresh board.
    final local = await _repo.loadSudoku(_sessionId);
    final start = local ?? SudokuState.tryParse(widget.session.clientState);
    if (!mounted) return;
    setState(() {
      if (start != null) {
        _board = [...start.board];
        _notes = [
          for (final n in start.notes) [...n],
        ];
        _mistakes = start.mistakes;
        _elapsedBase = start.elapsedMs;
      }
      _loaded = true;
    });
    _resume();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
    // The clock keeps running between moves: keep it saved on the device.
    _localSave = Timer.periodic(
      const Duration(seconds: 3),
      (_) => _repo.saveSudokuLocal(_sessionId, _snapshot),
    );
  }

  void _resume() => _runningSince ??= DateTime.now();

  void _pause() {
    if (_runningSince != null) {
      _elapsedBase += DateTime.now().difference(_runningSince!).inMilliseconds;
      _runningSince = null;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _resume();
      if (_status == _Status.network) _submit();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      _pause();
      if (_loaded && _status == _Status.playing) {
        _repo.saveSudokuLocal(_sessionId, _snapshot);
        _repo.sudokuSave(_sessionId, _snapshot).catchError((_) {});
      }
    }
  }

  void _changed() {
    _repo.saveSudokuLocal(_sessionId, _snapshot);
    _serverSave?.cancel();
    _serverSave = Timer(const Duration(milliseconds: 1500), () {
      _repo.sudokuSave(_sessionId, _snapshot).catchError((_) {});
    });
    final complete =
        _board.every((v) => v > 0) && conflictingCells(_board).isEmpty;
    if (complete && _status == _Status.playing) _submit();
  }

  bool _given(int i) => _puzzle[i] != 0;

  void _pushHistory(int index) {
    if (_history.length >= 200) _history.removeAt(0);
    _history.add((
      index: index,
      value: _board[index],
      notes: [..._notes[index]],
    ));
  }

  void _place(int index, int digit) {
    if (_given(index) || _status != _Status.playing) return;
    if (_notesMode && digit != 0) {
      if (_board[index] != 0) return;
      _pushHistory(index);
      setState(() {
        final n = _notes[index];
        _notes[index] = n.contains(digit)
            ? n.where((d) => d != digit).toList()
            : ([...n, digit]..sort());
      });
      _changed();
      return;
    }
    if (_board[index] == digit) return;
    _pushHistory(index);
    HapticFeedback.selectionClick();
    setState(() {
      _board = [..._board]..[index] = digit;
      _notes[index] = [];
      if (digit != 0) {
        for (final p in sudokuPeers[index]) {
          _notes[p] = _notes[p].where((d) => d != digit).toList();
        }
        if (conflictingCells(_board).contains(index)) {
          _mistakes++;
          HapticFeedback.heavyImpact();
        }
      }
    });
    _changed();
  }

  void _undo() {
    if (_history.isEmpty || _status != _Status.playing) return;
    final last = _history.removeLast();
    setState(() {
      _board = [..._board]..[last.index] = last.value;
      _notes[last.index] = last.notes;
      _selected = last.index;
    });
    _changed();
  }

  Future<void> _hint() async {
    if (_hintsUsed >= widget.session.maxHints || _hinting) return;
    setState(() {
      _hinting = true;
      _message = '';
    });
    try {
      final hint = await _repo.sudokuHint(_sessionId, _board);
      if (!mounted) return;
      _pushHistory(hint.index);
      setState(() {
        _hintsUsed = hint.hintsUsed;
        _selected = hint.index;
        _board = [..._board]..[hint.index] = hint.value;
        _notes[hint.index] = [];
      });
      _changed();
    } catch (error) {
      if (mounted) setState(() => _message = apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _hinting = false);
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;
    _submitting = true;
    _networkRetry?.cancel();
    setState(() => _status = _Status.submitting);
    try {
      final result = await _repo.submitSudoku(_sessionId, _snapshot);
      await _repo.clearSudoku(_sessionId);
      _status = _Status.submitting; // stays until the result replaces us
      if (mounted) widget.onFinished(result);
    } catch (error) {
      _submitting = false;
      if (!mounted) return;
      setState(() {
        _message = apiErrorText(context, error);
        _status = switch (error) {
          RejectedException(code: 'PRECONDITION_FAILED' || 'CONFLICT') =>
            _Status.expired,
          NetworkException() || ServerException() => _Status.network,
          _ => _Status.playing,
        };
      });
      if (_status == _Status.network) {
        _networkRetry = Timer(const Duration(seconds: 5), _submit);
      }
    }
  }

  void _move(int dr, int dc) {
    final i = _selected ?? 40;
    final r = rowOf(i) + dr;
    final c = colOf(i) + dc;
    if (r >= 0 && r < 9 && c >= 0 && c < 9) {
      setState(() => _selected = r * 9 + c);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (!_loaded) return const Center(child: CircularProgressIndicator());
    if (_status == _Status.expired) {
      return NlEmptyState(
        title: l10n.gamesExpired,
        message: _message,
        actionLabel: l10n.gamesRestartStage,
        onAction: widget.onRestart,
      );
    }
    final conflicts = conflictingCells(_board);
    final sel = _selected;
    final selValue = sel == null ? 0 : _board[sel];
    final counts = List.filled(10, 0);
    for (final v in _board) {
      if (v > 0) counts[v]++;
    }
    final canEdit = sel != null && !_given(sel) && _status == _Status.playing;
    final seconds = _elapsed ~/ 1000;
    final clock = '${seconds ~/ 60}:${'${seconds % 60}'.padLeft(2, '0')}';

    return Focus(
      autofocus: true,
      onKeyEvent: (node, event) {
        if (event is! KeyDownEvent || _status != _Status.playing) {
          return KeyEventResult.ignored;
        }
        final key = event.logicalKey;
        final digit = int.tryParse(event.character ?? '');
        if (digit != null && digit >= 1 && digit <= 9 && sel != null) {
          _place(sel, digit);
        } else if ((key == LogicalKeyboardKey.backspace ||
                key == LogicalKeyboardKey.delete) &&
            sel != null) {
          _place(sel, 0);
        } else if (key == LogicalKeyboardKey.keyN) {
          setState(() => _notesMode = !_notesMode);
        } else if (key == LogicalKeyboardKey.arrowUp) {
          _move(-1, 0);
        } else if (key == LogicalKeyboardKey.arrowDown) {
          _move(1, 0);
        } else if (key == LogicalKeyboardKey.arrowLeft) {
          _move(0, -1);
        } else if (key == LogicalKeyboardKey.arrowRight) {
          _move(0, 1);
        } else {
          return KeyEventResult.ignored;
        }
        return KeyEventResult.handled;
      },
      child: ListView(
        padding: const EdgeInsets.all(NlSpace.page),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${l10n.gamesLevelN(widget.session.stage)} · ${sudokuDifficultyAr[widget.session.difficulty] ?? widget.session.difficulty}',
                  style: NlText.rowLabel,
                ),
              ),
              Semantics(
                label: l10n.gamesTime,
                child: Text('⏱ ${isolateLtr(clock)}', style: NlText.rowLabel),
              ),
              const SizedBox(width: NlSpace.md),
              Semantics(
                label: l10n.gamesMistakes(_mistakes),
                child: Text('✗ $_mistakes', style: NlText.rowLabel),
              ),
            ],
          ),
          const SizedBox(height: NlSpace.md),
          Directionality(
            textDirection: TextDirection.ltr,
            child: AspectRatio(
              aspectRatio: 1,
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(color: NlColors.ink, width: 2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: GridView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  padding: EdgeInsets.zero,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 9,
                  ),
                  itemCount: 81,
                  itemBuilder: (context, i) => _Cell(
                    index: i,
                    value: _board[i],
                    notes: _notes[i],
                    given: _given(i),
                    selected: i == sel,
                    related:
                        sel != null &&
                        i != sel &&
                        (rowOf(i) == rowOf(sel) ||
                            colOf(i) == colOf(sel) ||
                            boxOf(i) == boxOf(sel)),
                    same: selValue != 0 && _board[i] == selValue && i != sel,
                    conflict: conflicts.contains(i),
                    onTap: () => setState(() => _selected = i),
                  ),
                ),
              ),
            ),
          ),
          if (_message.isNotEmpty && _status != _Status.network)
            Padding(
              padding: const EdgeInsets.only(top: NlSpace.sm),
              child: Text(
                _message,
                style: NlText.secondary.copyWith(color: NlColors.wrong),
              ),
            ),
          if (_status == _Status.network)
            Padding(
              padding: const EdgeInsets.only(top: NlSpace.sm),
              child: Row(
                children: [
                  const Icon(LucideIcons.wifiOff, size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      l10n.gamesSudokuOffline,
                      style: NlText.secondary,
                    ),
                  ),
                  NlButton(
                    label: l10n.actionRetry,
                    kind: NlButtonKind.ghost,
                    onPressed: _submit,
                  ),
                ],
              ),
            ),
          if (_status == _Status.submitting)
            Padding(
              padding: const EdgeInsets.only(top: NlSpace.sm),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox.square(
                    dimension: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  const SizedBox(width: NlSpace.sm),
                  Text(l10n.gamesChecking, style: NlText.secondary),
                ],
              ),
            ),
          const SizedBox(height: NlSpace.md),
          Row(
            children: [
              _Tool(
                icon: LucideIcons.undo2,
                label: l10n.gamesUndo,
                onTap: _history.isNotEmpty && _status == _Status.playing
                    ? _undo
                    : null,
              ),
              _Tool(
                icon: LucideIcons.eraser,
                label: l10n.gamesErase,
                onTap: canEdit ? () => _place(sel, 0) : null,
              ),
              _Tool(
                icon: LucideIcons.pencilLine,
                label: _notesMode ? '${l10n.gamesNotes} ✓' : l10n.gamesNotes,
                on: _notesMode,
                onTap: () => setState(() => _notesMode = !_notesMode),
              ),
              _Tool(
                icon: LucideIcons.lightbulb,
                label: l10n.gamesHint(widget.session.maxHints - _hintsUsed),
                busy: _hinting,
                onTap:
                    _hintsUsed < widget.session.maxHints &&
                        !_hinting &&
                        _status == _Status.playing
                    ? _hint
                    : null,
              ),
            ],
          ),
          const SizedBox(height: NlSpace.sm),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              children: [
                for (var d = 1; d <= 9; d++)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(2),
                      child: Semantics(
                        button: true,
                        excludeSemantics: true,
                        label: l10n.gamesDigit(d, (9 - counts[d]).clamp(0, 9)),
                        child: Material(
                          color: NlColors.sheet,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(NlRadius.sm),
                            side: const BorderSide(color: NlColors.ruleStrong),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(NlRadius.sm),
                            onTap: canEdit ? () => _place(sel, d) : null,
                            child: SizedBox(
                              height: 56,
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    '$d',
                                    style: NlText.title.copyWith(
                                      color: canEdit
                                          ? NlColors.ink
                                          : NlColors.ink3,
                                    ),
                                  ),
                                  Text(
                                    '${(9 - counts[d]).clamp(0, 9)}',
                                    style: NlText.caption.copyWith(
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.index,
    required this.value,
    required this.notes,
    required this.given,
    required this.selected,
    required this.related,
    required this.same,
    required this.conflict,
    required this.onTap,
  });

  final int index;
  final int value;
  final List<int> notes;
  final bool given;
  final bool selected;
  final bool related;
  final bool same;
  final bool conflict;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final r = rowOf(index);
    final c = colOf(index);
    final bg = selected
        ? NlColors.marker
        : conflict
        ? NlColors.wrongSoft
        : same
        ? NlColors.markerSoft
        : related
        ? NlColors.niroSoft
        : NlColors.sheet;
    BorderSide side(bool thick) => BorderSide(
      color: thick ? NlColors.ink : NlColors.rule,
      width: thick ? 2 : 0.5,
    );
    return Semantics(
      button: true,
      selected: selected,
      excludeSemantics: true,
      label: l10n.gamesCell(
        r + 1,
        c + 1,
        value == 0 ? l10n.gamesEmptyCell : '$value',
      ),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            color: bg,
            border: Border(
              right: side(c % 3 == 2 && c != 8),
              bottom: side(r % 3 == 2 && r != 8),
              left: side(false),
              top: side(false),
            ),
          ),
          alignment: Alignment.center,
          child: value != 0
              ? Text(
                  '$value',
                  style: NlText.title.copyWith(
                    fontSize: 20,
                    fontWeight: given ? FontWeight.w700 : FontWeight.w500,
                    color: conflict
                        ? NlColors.wrong
                        : given
                        ? NlColors.ink
                        : NlColors.niroDeep,
                  ),
                )
              : notes.isEmpty
              ? null
              : GridView.count(
                  crossAxisCount: 3,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(1),
                  children: [
                    for (var d = 1; d <= 9; d++)
                      Center(
                        child: Text(
                          notes.contains(d) ? '$d' : '',
                          style: const TextStyle(
                            fontSize: 8,
                            height: 1,
                            color: NlColors.ink2,
                          ),
                        ),
                      ),
                  ],
                ),
        ),
      ),
    );
  }
}

class _Tool extends StatelessWidget {
  const _Tool({
    required this.icon,
    required this.label,
    required this.onTap,
    this.on = false,
    this.busy = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool on;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final color = onTap == null ? NlColors.ink3 : NlColors.ink;
    return Expanded(
      child: Semantics(
        button: true,
        toggled: on ? true : null,
        label: label,
        excludeSemantics: true,
        child: InkWell(
          borderRadius: BorderRadius.circular(NlRadius.md),
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(minHeight: 56),
            decoration: BoxDecoration(
              color: on ? NlColors.markerSoft : null,
              borderRadius: BorderRadius.circular(NlRadius.md),
            ),
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                busy
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(icon, size: 20, color: color),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: NlText.caption.copyWith(color: color, fontSize: 12),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
