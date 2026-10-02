import 'dart:async';

import 'package:flutter/foundation.dart';

import '../domain/pdf_marks.dart';

enum SaveState { idle, saving, saved, error }

/// Every page's marks for one book, saved per page 700 ms after the last
/// change (the web's SAVE_DELAY_MS), one save at a time per page, flushed
/// when the reader closes or the app goes to the background. A failed save
/// keeps the page pending and says so.
class MarksController extends ChangeNotifier {
  MarksController({
    required this.save,
    this.delay = const Duration(milliseconds: 700),
  });

  final Future<void> Function(int page, PageMarks marks) save;
  final Duration delay;

  Map<int, PageMarks> _marks = {};
  final _unsaved = <int>{};
  final _saving = <int>{};
  final _timers = <int, Timer>{};
  SaveState _state = SaveState.idle;
  bool _disposed = false;

  SaveState get state => _state;
  PageMarks marksOf(int page) => _marks[page] ?? PageMarks.empty;

  void load(Map<int, PageMarks> marks) {
    _marks = {...marks, for (final p in _unsaved) p: marksOf(p)};
    _notify();
  }

  /// Applies [change] to [page]; schedules its save when something changed.
  void update(int page, PageMarks Function(PageMarks current) change) {
    final current = marksOf(page);
    final next = change(current);
    if (identical(next, current)) return;
    _marks = {..._marks, page: next};
    _unsaved.add(page);
    _state = SaveState.saving;
    _timers[page]?.cancel();
    _timers[page] = Timer(delay, () => flush(page));
    _notify();
  }

  Future<void> flush(int page) async {
    _timers.remove(page)?.cancel();
    if (_saving.contains(page) || !_unsaved.contains(page)) return;
    _saving.add(page);
    try {
      while (_unsaved.remove(page)) {
        _setState(SaveState.saving);
        await save(page, marksOf(page));
      }
      _setState(_unsaved.isEmpty ? SaveState.saved : SaveState.saving);
    } catch (_) {
      _unsaved.add(page);
      _setState(SaveState.error);
    } finally {
      _saving.remove(page);
    }
  }

  Future<void> flushAll() =>
      Future.wait([for (final p in _unsaved.toList()) flush(p)]);

  bool get hasUnsaved => _unsaved.isNotEmpty;

  void _setState(SaveState s) {
    _state = s;
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    for (final t in _timers.values) {
      t.cancel();
    }
    // Still send what is pending — the save does not need the widget.
    unawaited(flushAll().catchError((_) {}));
    super.dispose();
  }
}
