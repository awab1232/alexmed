import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../library/data/library_models.dart';
import '../../library/data/library_repository.dart';
import '../../library/presentation/library_widgets.dart' show shortDate;
import '../../study/data/study_models.dart' show McqResult;
import '../../study/data/study_repository.dart';
import '../../study/presentation/study_widgets.dart';
import '../data/progress_repository.dart';

/// إحصائياتي (the web's /books/stats): reviews, accuracy, streak, hours.
class StatsScreen extends ConsumerStatefulWidget {
  const StatsScreen({super.key});

  @override
  ConsumerState<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends ConsumerState<StatsScreen> {
  late Future<StudyStats> _stats = ref.read(progressRepositoryProvider).stats();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.statsRow)),
      body: FutureBuilder(
        future: _stats,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return NlErrorView(
              error: snapshot.error!,
              onRetry: () => setState(
                () => _stats = ref.read(progressRepositoryProvider).stats(),
              ),
            );
          }
          final s = snapshot.data;
          if (s == null) {
            return const Center(child: CircularProgressIndicator());
          }
          final tiles = [
            (
              LucideIcons.layers3,
              '${s.cardsReviewed}',
              l10n.statsReviewed,
              l10n.statsReviewedHint,
            ),
            (
              LucideIcons.target,
              '${s.accuracyPercent}%',
              l10n.statsAccuracy,
              l10n.statsAccuracyHint,
            ),
            (
              LucideIcons.flame,
              '${s.streakDays}',
              l10n.statsStreak,
              l10n.statsStreakHint,
            ),
            (
              LucideIcons.clock,
              _hours(s.hoursStudied),
              l10n.statsHours,
              l10n.statsHoursHint,
            ),
          ];
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              NlSpace.page,
              0,
              NlSpace.page,
              NlSpace.xxxl,
            ),
            children: [
              Text(l10n.statsIntro, style: NlText.secondary),
              const SizedBox(height: NlSpace.lg),
              for (var r = 0; r < tiles.length; r += 2) ...[
                if (r > 0) const SizedBox(height: NlSpace.sm),
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final i in [r, r + 1]) ...[
                        if (i > r) const SizedBox(width: NlSpace.sm),
                        Expanded(child: _statTile(i, tiles[i])),
                      ],
                    ],
                  ),
                ),
              ],
              const SizedBox(height: NlSpace.xl),
              NlGroup(
                children: [
                  NlRow(
                    icon: LucideIcons.triangleAlert,
                    label: l10n.weakTitle,
                    value: l10n.weakRowHint,
                    onTap: () => context.push(Routes.weakPoints),
                  ),
                  NlRow(
                    icon: LucideIcons.calendarDays,
                    label: l10n.todayTitle,
                    value: l10n.todayRowHint,
                    onTap: () => context.push(Routes.today),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

Widget _statTile(int i, (IconData, String, String, String) t) {
  final (icon, value, label, hint) = t;
  return Container(
    padding: const EdgeInsets.all(NlSpace.md),
    decoration: BoxDecoration(
      color: i == 1 ? NlColors.markerSoft : NlColors.sheet,
      borderRadius: BorderRadius.circular(NlRadius.md),
      border: Border.all(color: i == 1 ? NlColors.marker : NlColors.rule),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: NlColors.ink2),
        const SizedBox(height: NlSpace.md),
        Text(isolateLtr(value), style: NlText.display.copyWith(fontSize: 28)),
        Text(label, style: NlText.rowLabel.copyWith(fontSize: 14)),
        Text(
          hint,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: NlText.caption.copyWith(fontSize: 11),
        ),
      ],
    ),
  );
}

String _hours(double h) =>
    h == h.roundToDouble() ? '${h.round()}' : h.toStringAsFixed(1);

/// نقاط الضعف (the web's /books/weak-points): questions whose latest answer
/// was wrong; answering right removes them (after the feedback is seen).
class WeakPointsScreen extends ConsumerStatefulWidget {
  const WeakPointsScreen({
    super.key,
    this.resolveDelay = const Duration(milliseconds: 1600),
  });

  final Duration resolveDelay;

  @override
  ConsumerState<WeakPointsScreen> createState() => _WeakPointsScreenState();
}

class _WeakPointsScreenState extends ConsumerState<WeakPointsScreen> {
  WeakPoints? _data;
  Object? _error;
  final _resolved = <String>{};
  final _answers = <String, (int, McqResult)>{};
  String? _pending;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final data = await ref.read(progressRepositoryProvider).weakPoints();
      if (mounted) setState(() => _data = data);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _answer(WeakQuestion q, int choice) async {
    setState(() => _pending = '${q.mcqId}:$choice');
    try {
      final result = await ref
          .read(studyRepositoryProvider)
          .submitMcq(q.mcqId, choice);
      if (!mounted) return;
      setState(() => _answers[q.mcqId] = (choice, result));
      if (result.isCorrect) {
        // Delayed so the green answer and explanation are actually seen.
        Timer(widget.resolveDelay, () {
          if (mounted) setState(() => _resolved.add(q.mcqId));
        });
      }
    } catch (error) {
      if (mounted) showNlToast(context, apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _pending = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final data = _data;
    final Widget body;
    if (data == null) {
      body = _error == null
          ? const Center(child: CircularProgressIndicator())
          : NlErrorView(error: _error!, onRetry: _load);
    } else {
      final questions = data.questions
          .where((q) => !_resolved.contains(q.mcqId))
          .toList();
      body = questions.isEmpty
          ? NlEmptyState(
              title: l10n.weakEmpty,
              message: l10n.weakEmptyHint,
              expression: NiroExpression.victory,
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                NlSpace.page,
                0,
                NlSpace.page,
                NlSpace.xxxl,
              ),
              children: [
                Text(l10n.weakIntro, style: NlText.secondary),
                const SizedBox(height: NlSpace.lg),
                if (data.chapters.isNotEmpty) ...[
                  NlGroup(
                    title: l10n.weakChapters,
                    children: [
                      for (final c in data.chapters)
                        NlRow(
                          label: isolate(c.title),
                          trailing: NlBadge('${c.wrongCount}', marked: true),
                          onTap: () =>
                              context.push(Routes.bookStudy(c.bookId, 'mcqs')),
                        ),
                    ],
                  ),
                  const SizedBox(height: NlSpace.xl),
                ],
                for (final q in questions) ...[
                  _WeakCard(
                    question: q,
                    answer: _answers[q.mcqId],
                    pending: _pending?.startsWith('${q.mcqId}:') ?? false
                        ? int.parse(_pending!.split(':').last)
                        : null,
                    onChoose: _pending == null ? (i) => _answer(q, i) : null,
                  ),
                  const SizedBox(height: NlSpace.md),
                ],
              ],
            );
    }
    return Scaffold(
      appBar: AppBar(title: Text(l10n.weakTitle)),
      body: body,
    );
  }
}

class _WeakCard extends StatelessWidget {
  const _WeakCard({
    required this.question,
    required this.answer,
    required this.pending,
    required this.onChoose,
  });

  final WeakQuestion question;
  final (int, McqResult)? answer;
  final int? pending;
  final ValueChanged<int>? onChoose;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final answer = this.answer;
    return Container(
      padding: const EdgeInsets.all(NlSpace.md),
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(isolate(question.meta), style: NlText.caption),
          const SizedBox(height: 4),
          Text(
            question.questionEn,
            textDirection: TextDirection.ltr,
            style: NlText.rowLabel,
          ),
          const SizedBox(height: NlSpace.sm),
          for (var i = 0; i < question.choices.length; i++) ...[
            McqChoice(
              letter: String.fromCharCode(65 + i),
              text: question.choices[i],
              state: answer == null
                  ? (pending == i
                        ? McqChoiceState.pending
                        : McqChoiceState.idle)
                  : i == answer.$2.correctIndex
                  ? McqChoiceState.correct
                  : i == answer.$1
                  ? McqChoiceState.wrong
                  : McqChoiceState.dim,
              removed: false,
              onTap: answer == null && onChoose != null
                  ? () => onChoose!(i)
                  : null,
            ),
            const SizedBox(height: 6),
          ],
          if (answer != null) ...[
            Text(
              answer.$2.isCorrect ? l10n.quizCorrect : l10n.quizWrong,
              style: NlText.rowLabel.copyWith(
                color: answer.$2.isCorrect ? NlColors.correct : NlColors.wrong,
              ),
            ),
            if (answer.$2.explanationEn.isNotEmpty)
              Text(
                answer.$2.explanationEn,
                textDirection: TextDirection.ltr,
                style: NlText.body,
              ),
          ],
        ],
      ),
    );
  }
}

/// ماذا ستدرس اليوم؟ (the web's /today): due cards, nearest exam, folders,
/// a book to continue, and the 7-day review forecast.
class TodayScreen extends ConsumerStatefulWidget {
  const TodayScreen({super.key});

  @override
  ConsumerState<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends ConsumerState<TodayScreen> {
  late Future<List<ForecastDay>> _forecast = ref
      .read(progressRepositoryProvider)
      .forecast();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final due = ref.watch(dueCountProvider).value;
    final folders = ref.watch(subjectsProvider).value ?? const <Subject>[];
    final books = ref.watch(booksProvider).value ?? const <BookSummary>[];
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    int daysUntil(DateTime d) {
      final local = d.toLocal();
      return DateTime(
        local.year,
        local.month,
        local.day,
      ).difference(today).inDays;
    }

    final exams =
        folders
            .where((f) => f.examDate != null && daysUntil(f.examDate!) >= 0)
            .toList()
          ..sort((a, b) => a.examDate!.compareTo(b.examDate!));
    final exam = exams.isEmpty ? null : exams.first;
    final suggested = books.where((b) => b.completeChapterCount > 0);

    Widget panel(IconData icon, String title, List<Widget> children) =>
        Container(
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
              Row(
                children: [
                  Icon(icon, size: 18, color: NlColors.niroDeep),
                  const SizedBox(width: NlSpace.sm),
                  Expanded(
                    child: Text(
                      title,
                      style: NlText.title.copyWith(fontSize: 17),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: NlSpace.sm),
              ...children,
            ],
          ),
        );

    return Scaffold(
      appBar: AppBar(title: Text(l10n.todayTitle)),
      body: RefreshIndicator(
        onRefresh: () async {
          refreshLibrary(ref);
          setState(() {
            _forecast = ref.read(progressRepositoryProvider).forecast();
          });
          await _forecast.catchError((_) => <ForecastDay>[]);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            NlSpace.page,
            0,
            NlSpace.page,
            NlSpace.xxxl,
          ),
          children: [
            Text(l10n.todayIntro, style: NlText.secondary),
            const SizedBox(height: NlSpace.lg),
            panel(LucideIcons.layers3, l10n.todayDue, [
              if (due == null)
                const LinearProgressIndicator(minHeight: 4)
              else if (due > 0) ...[
                Text(l10n.todayDueCount(due), style: NlText.body),
                const SizedBox(height: NlSpace.sm),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: NlButton(
                    label: l10n.todayStartReview,
                    kind: NlButtonKind.marker,
                    onPressed: () => context.push(Routes.review),
                  ),
                ),
              ] else
                Text(l10n.todayNothingDue, style: NlText.secondary),
            ]),
            if (exam != null)
              panel(LucideIcons.calendarClock, l10n.todayExam, [
                Text(
                  l10n.todayExamLine(
                    isolate(exam.name),
                    shortDate(exam.examDate!, locale),
                    daysUntil(exam.examDate!),
                  ),
                  style: NlText.body,
                ),
              ]),
            panel(LucideIcons.bookOpen, l10n.todayContinue, [
              if (suggested.isEmpty)
                Text(l10n.todayNoBook, style: NlText.secondary)
              else ...[
                AutoDirText(suggested.first.title, style: NlText.rowLabel),
                const SizedBox(height: NlSpace.sm),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: NlButton(
                    label: l10n.todayOpenBook,
                    kind: NlButtonKind.secondary,
                    onPressed: () =>
                        context.push(Routes.book(suggested.first.id)),
                  ),
                ),
              ],
            ]),
            panel(LucideIcons.trendingUp, l10n.todayForecast, [
              FutureBuilder(
                future: _forecast,
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return Text(
                      apiErrorText(context, snapshot.error!),
                      style: NlText.secondary,
                    );
                  }
                  final days = snapshot.data;
                  if (days == null) {
                    return const LinearProgressIndicator(minHeight: 4);
                  }
                  if (days.isEmpty) {
                    return Text(l10n.todayNoForecast, style: NlText.secondary);
                  }
                  final max = days.fold(1, (m, d) => d.count > m ? d.count : m);
                  return Column(
                    children: [
                      for (final d in days)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 2,
                                child: Text(
                                  shortDate(d.day, locale),
                                  style: NlText.caption,
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: NlProgressBar(value: d.count / max),
                              ),
                              const SizedBox(width: NlSpace.sm),
                              SizedBox(
                                width: 32,
                                child: Text(
                                  '${d.count}',
                                  textAlign: TextAlign.end,
                                  style: NlText.rowLabel.copyWith(fontSize: 14),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  );
                },
              ),
            ]),
            if (folders.isNotEmpty) ...[
              const SizedBox(height: NlSpace.sm),
              NlGroup(
                title: l10n.todayFolders,
                children: [
                  for (final f in folders)
                    NlRow(
                      icon: LucideIcons.folder,
                      label: isolate(f.name),
                      value: [
                        f.typeLabel,
                        l10n.todayFolderBooks(f.bookCount),
                        if (f.examDate != null)
                          l10n.todayFolderExam(shortDate(f.examDate!, locale)),
                      ].join(' · '),
                      onTap: () => context.push(Routes.folder(f.id)),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
