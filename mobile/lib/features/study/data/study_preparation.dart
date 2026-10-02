import 'dart:async';

import 'package:flutter/foundation.dart';

import 'study_models.dart';
import 'study_repository.dart';

enum PrepPhase { idle, knowledge, generating, done }

@immutable
class PrepState {
  const PrepState({
    this.phase = PrepPhase.idle,
    this.unitsDone = 0,
    this.unitsTotal = 0,
    this.done = 0,
    this.total = 0,
    this.current,
    this.waiting = 0,
    this.errors = const [],
  });

  final PrepPhase phase;

  /// Knowledge base (Exam Focus) units built so far.
  final int unitsDone;
  final int unitsTotal;

  /// Chapters whose generation settled / all queued chapters.
  final int done;
  final int total;

  /// The chapter being generated now, if any.
  final String? current;

  /// Chapters still waiting in the queue.
  final int waiting;

  /// Titles of chapters whose generation failed.
  final List<String> errors;

  bool get busy =>
      phase == PrepPhase.knowledge || phase == PrepPhase.generating;
}

/// What the web's study page does when the owner opens cards / questions
/// and some analysed chapters have none yet (app/books/[bookId]/study):
///
/// 1. the knowledge base (the file's Exam Focus facts) is started if it does
///    not exist, and waited for — polled every 4 s, stalled units re-queued
///    every 45 s; if it cannot be built, generation continues without it
///    (the server falls back);
/// 2. every missing chapter is queued (`generateChapter…`), one call each;
/// 3. the jobs are followed (`generationJobs` every 3 s) until each one
///    completed or failed, then the content is reloaded.
///
/// Only server calls — cards and questions are generated on the server.
class StudyPreparation {
  StudyPreparation({
    required this.repo,
    required this.bookId,
    required this.tool,
    required this.onReload,
    this.deckPoll = const Duration(seconds: 4),
    this.deckResume = const Duration(seconds: 45),
    this.jobsPoll = const Duration(seconds: 3),
  });

  final StudyRepository repo;
  final String bookId;
  final StudyTool tool;

  /// Reload the study content (after the jobs settle).
  final Future<void> Function() onReload;
  final Duration deckPoll;
  final Duration deckResume;
  final Duration jobsPoll;

  final state = ValueNotifier(const PrepState());
  bool _started = false;
  bool _disposed = false;
  Timer? _timer;

  /// Starts once, for the content first shown. Does nothing for a shared
  /// book (read-only: the recipient never triggers AI cost) or when every
  /// analysed chapter already has its cards / questions.
  Future<void> run(StudyContent content) async {
    if (_started || tool == StudyTool.summary || !content.isOwner) return;
    final missing = content.missingFor(tool);
    if (missing.isEmpty) return;
    _started = true;

    await _waitForKnowledge();
    if (_disposed) return;
    await _queue([for (final c in missing) (chapter: c, rebuild: false)]);
  }

  /// «أعد البناء من قاعدة المعرفة» (owner, after confirming): replaces the
  /// page-text cards / questions of [chapters] with ones built from the
  /// knowledge base — only once that base is ready, as on the web. Returns
  /// false when it is not ready (nothing is queued).
  Future<bool> rebuild(List<StudyChapter> chapters) async {
    if (state.value.busy || chapters.isEmpty) return false;
    final ready = await _waitForKnowledge();
    if (_disposed || !ready) {
      _set(const PrepState());
      return false;
    }
    await _queue([for (final c in chapters) (chapter: c, rebuild: true)]);
    return true;
  }

  Future<void> _queue(List<({StudyChapter chapter, bool rebuild})> jobs) async {
    final errors = <String>[];
    final queued = <StudyChapter>[];
    _set(PrepState(phase: PrepPhase.generating, total: jobs.length));
    for (final job in jobs) {
      if (_disposed) return;
      try {
        await repo.generate(tool, job.chapter.id, rebuild: job.rebuild);
        queued.add(job.chapter);
      } catch (_) {
        errors.add(job.chapter.title);
      }
    }
    await _followJobs(queued, errors);
  }

  /// Returns whether the knowledge base ended up ready (complete / partial).
  Future<bool> _waitForKnowledge() async {
    try {
      var deck = await repo.examFocus(bookId);
      if (deck == null) {
        try {
          await repo.startExamFocus(bookId);
        } catch (_) {
          return false; // can't be built: generate without it (server fallback)
        }
        deck = await repo.examFocus(bookId);
      }
      var sinceResume = Duration.zero;
      while (!_disposed && deck != null && !deck.settled) {
        _set(
          PrepState(
            phase: PrepPhase.knowledge,
            unitsDone: deck.unitsDone,
            unitsTotal: deck.units.length,
          ),
        );
        await _sleep(deckPoll);
        sinceResume += deckPoll;
        if (sinceResume >= deckResume) {
          sinceResume = Duration.zero;
          unawaited(repo.resumeExamFocus(bookId).catchError((_) {}));
        }
        deck = await repo.examFocus(bookId);
      }
      return deck?.ready ?? false;
    } catch (_) {
      // An unreadable deck counts as settled on the web too.
      return false;
    }
  }

  Future<void> _followJobs(
    List<StudyChapter> queued,
    List<String> errors,
  ) async {
    final total = queued.length + errors.length;
    while (!_disposed && queued.isNotEmpty) {
      List<GenerationJob> jobs;
      try {
        jobs = await repo.jobs(bookId);
      } catch (_) {
        await _sleep(jobsPoll);
        continue;
      }
      GenerationJob? jobOf(StudyChapter c) {
        for (final job in jobs) {
          if (job.chapterId == c.id && job.kind == tool.jobKind) return job;
        }
        return null;
      }

      final failed = [
        for (final c in queued)
          if (jobOf(c)?.status == 'failed') c.title,
      ];
      final settled = queued.where((c) => jobOf(c)?.settled ?? false).length;
      if (settled >= queued.length) {
        errors.addAll(failed);
        break;
      }
      final running = queued.where((c) => jobOf(c)?.status == 'processing');
      _set(
        PrepState(
          phase: PrepPhase.generating,
          done: settled + errors.length,
          total: total,
          current: running.isEmpty ? null : running.first.title,
          waiting: queued.where((c) {
            final status = jobOf(c)?.status;
            return status == null || status == 'queued';
          }).length,
          errors: [...errors, ...failed],
        ),
      );
      await _sleep(jobsPoll);
    }
    if (_disposed) return;
    await onReload();
    _set(
      PrepState(
        phase: PrepPhase.done,
        done: total,
        total: total,
        errors: errors,
      ),
    );
  }

  Future<void> _sleep(Duration d) {
    final done = Completer<void>();
    _timer = Timer(d, done.complete);
    return done.future;
  }

  void _set(PrepState next) {
    if (!_disposed) state.value = next;
  }

  void dispose() {
    _disposed = true;
    _timer?.cancel();
    state.dispose();
  }
}
