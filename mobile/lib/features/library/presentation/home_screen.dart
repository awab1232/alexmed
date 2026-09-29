import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/library_models.dart';
import '../data/library_repository.dart';
import 'folder_sheets.dart';
import 'library_widgets.dart';

/// الرئيسية — the web's /subjects: greeting, the one "what now?" panel,
/// the student's books, sharing, then folders. Everything shown comes from
/// the server; nothing is invented.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: NlColors.ink,
          onRefresh: () async {
            refreshLibrary(ref);
            try {
              await Future.wait([
                ref.read(subjectsProvider.future),
                ref.read(booksProvider.future),
              ]);
            } catch (_) {
              // The sections show their own error state; the spinner stops.
            }
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              NlSpace.page,
              NlSpace.lg,
              NlSpace.page,
              NlSpace.xxxl,
            ),
            children: const [
              _Greeting(),
              SizedBox(height: 18),
              _NextPanel(),
              _BooksSection(),
              _SharedSection(),
              _FoldersSection(),
            ],
          ),
        ),
      ),
    );
  }
}

class _Greeting extends ConsumerWidget {
  const _Greeting();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final hour = DateTime.now().hour;
    final hello = hour < 5
        ? l10n.greetingNight
        : hour < 12
        ? l10n.greetingMorning
        : l10n.greetingEvening;
    final name = ref.watch(myNameProvider).value?.trim();
    final firstName = (name == null || name.isEmpty)
        ? null
        : name.split(RegExp(r'\s+')).first;
    return Semantics(
      header: true,
      child: Text(
        firstName == null ? hello : l10n.greetingWithName(hello, firstName),
        style: NlText.display,
      ),
    );
  }
}

/// The ink panel with a highlighter strip on top (`.home-next`): one clear
/// next step, in the web's priority order — due cards, a book still being
/// prepared, a ready book, or the first upload.
class _NextPanel extends ConsumerWidget {
  const _NextPanel();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final books = ref.watch(booksProvider);
    final due = ref.watch(dueCountProvider);
    final subjects = ref.watch(subjectsProvider).value ?? const [];
    final loading = books.isLoading || due.isLoading;

    final bookList = books.value ?? const <BookSummary>[];
    final dueCount = due.value ?? 0;
    final preparing = bookList
        .where((b) => b.state != BookState.ready)
        .firstOrNull;
    final ready = bookList.where((b) => b.state == BookState.ready).firstOrNull;

    late final String title;
    late final String detail;
    late final String action;
    late final VoidCallback onAction;
    IconData? icon;
    if (dueCount > 0) {
      title = l10n.nextDueTitle(dueCount);
      detail = l10n.nextDueDetail((dueCount / 3).round().clamp(1, 999));
      action = l10n.nextDueAction;
      onAction = () => context.push(Routes.review);
    } else if (preparing != null) {
      title = l10n.nextPreparingTitle(isolate(preparing.title));
      detail = l10n.nextPreparingDetail;
      action = l10n.nextOpenBook;
      onAction = () => context.push(Routes.book(preparing.id));
    } else if (ready != null) {
      title = l10n.nextContinueTitle(isolate(ready.title));
      detail = l10n.nextContinueDetail;
      action = l10n.nextContinueAction;
      onAction = () => context.push(Routes.book(ready.id));
    } else {
      title = l10n.nextFirstTitle;
      detail = l10n.nextFirstDetail;
      action = l10n.nextFirstAction;
      icon = LucideIcons.upload;
      onAction = () => context.push(Routes.uploadBook);
    }

    final exam = _nearestExam(subjects);

    return Semantics(
      container: true,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(NlRadius.lg),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: NlColors.ink,
            border: Border(top: BorderSide(color: NlColors.marker, width: 5)),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
            child: loading
                ? const _PanelSkeleton()
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: NlText.title.copyWith(
                          color: Colors.white,
                          fontSize: 22,
                        ),
                      ),
                      const SizedBox(height: NlSpace.sm),
                      Text(
                        detail,
                        style: NlText.body.copyWith(
                          color: const Color(0xFFC7CBE0),
                        ),
                      ),
                      const SizedBox(height: 14),
                      ConstrainedBox(
                        constraints: const BoxConstraints(minWidth: 160),
                        child: NlButton(
                          label: action,
                          kind: NlButtonKind.marker,
                          icon: icon,
                          onPressed: onAction,
                        ),
                      ),
                      if (exam != null) ...[
                        const SizedBox(height: NlSpace.md),
                        const Divider(color: Color(0x24FFFFFF), height: 1),
                        const SizedBox(height: NlSpace.md),
                        Row(
                          children: [
                            const Icon(
                              LucideIcons.calendarClock,
                              size: 16,
                              color: NlColors.marker,
                            ),
                            const SizedBox(width: NlSpace.sm),
                            Expanded(
                              child: Text(
                                l10n.examIn(
                                  exam.name,
                                  _daysLabel(l10n, _daysUntil(exam.examDate!)),
                                ),
                                style: NlText.body.copyWith(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _PanelSkeleton extends StatelessWidget {
  const _PanelSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 130,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FractionallySizedBox(
            widthFactor: 0.7,
            child: Opacity(opacity: 0.2, child: NlSkeleton(height: 22)),
          ),
          SizedBox(height: NlSpace.md),
          FractionallySizedBox(
            widthFactor: 0.45,
            child: Opacity(opacity: 0.2, child: NlSkeleton(height: 14)),
          ),
        ],
      ),
    );
  }
}

Subject? _nearestExam(List<Subject> subjects) {
  final upcoming =
      subjects
          .where((s) => s.examDate != null && _daysUntil(s.examDate!) >= 0)
          .toList()
        ..sort((a, b) => a.examDate!.compareTo(b.examDate!));
  return upcoming.firstOrNull;
}

int _daysUntil(DateTime date) =>
    (date.difference(DateTime.now()).inHours / 24).ceil();

/// The web's daysLabel(): اليوم / غدًا / بعد يومين / بعد N أيام (≤10) /
/// بعد N يومًا.
String _daysLabel(AppLocalizations l10n, int days) {
  if (days <= 0) return l10n.daysToday;
  if (days == 1) return l10n.daysTomorrow;
  if (days == 2) return l10n.daysTwo;
  return days <= 10 ? l10n.daysFew(days) : l10n.daysMany(days);
}

class _BooksSection extends ConsumerWidget {
  const _BooksSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final books = ref.watch(booksProvider).value ?? const <BookSummary>[];
    if (books.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHead(title: l10n.yourBooks),
        RuledList(
          children: [
            for (final book in books.take(4))
              LibraryRow(
                leading: BookSpine(state: book.state),
                title: book.title,
                detail: switch (book.state) {
                  BookState.ready =>
                    book.chapterCount == 1
                        ? l10n.bookReady
                        : l10n.bookPartsReady(
                            book.completeChapterCount,
                            book.chapterCount,
                          ),
                  BookState.preparing => l10n.bookPreparing,
                  BookState.reading => l10n.bookReading,
                },
                onTap: () => context.push(Routes.book(book.id)),
              ),
          ],
        ),
      ],
    );
  }
}

class _SharedSection extends ConsumerWidget {
  const _SharedSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final summary = ref.watch(sharedSummaryProvider).value;
    if (summary == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 28),
      child: NlGroup(
        children: [
          if (summary.pending > 0)
            NlRow(
              icon: LucideIcons.inbox,
              label: l10n.sharedPending(summary.pending),
              value: l10n.sharedPendingDetail,
              onTap: () => context.push(Routes.shared),
            )
          else
            NlRow(
              icon: LucideIcons.users,
              label: l10n.sharedWithMe,
              value: l10n.sharedWithMeDetail,
              trailing: summary.unread > 0
                  ? Padding(
                      padding: const EdgeInsetsDirectional.only(end: 4),
                      child: NlBadge('${summary.unread}', marked: true),
                    )
                  : null,
              onTap: () => context.push(Routes.shared),
            ),
          for (final pack in summary.recent)
            NlRow(
              icon: LucideIcons.bookOpen,
              label: isolate(pack.bookTitle),
              value: l10n.sharedFrom(
                isolate(
                  pack.ownerName ??
                      (pack.ownerUsername != null
                          ? '@${pack.ownerUsername}'
                          : l10n.sharedColleague),
                ),
              ),
              onTap: () => context.push(Routes.book(pack.bookId)),
            ),
        ],
      ),
    );
  }
}

/// مجلداتي — search appears from 5 folders on, like the web.
class _FoldersSection extends ConsumerStatefulWidget {
  const _FoldersSection();

  @override
  ConsumerState<_FoldersSection> createState() => _FoldersSectionState();
}

class _FoldersSectionState extends ConsumerState<_FoldersSection> {
  static const _searchFrom = 5;
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final created = await showCreateFolderSheet(context);
    if (created != null && mounted) {
      showNlToast(context, AppLocalizations.of(context).saved);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final subjects = ref.watch(subjectsProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHead(
          title: l10n.myFolders,
          action: NlButton(
            label: l10n.newFolder,
            kind: NlButtonKind.ghost,
            icon: LucideIcons.folderPlus,
            onPressed: _create,
          ),
        ),
        ...subjects.when(
          loading: () => [const NlListSkeleton(rows: 3)],
          error: (error, _) => [
            NlErrorView(
              error: error,
              inline: true,
              onRetry: () => ref.invalidate(subjectsProvider),
            ),
          ],
          data: (list) {
            if (list.isEmpty) {
              return [
                Text(l10n.foldersEmpty, style: NlText.secondary),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: NlButton(
                    label: l10n.createFolder,
                    kind: NlButtonKind.ghost,
                    icon: LucideIcons.plus,
                    onPressed: _create,
                  ),
                ),
              ];
            }
            final q = _query.text.trim();
            final filtered = q.isEmpty
                ? list
                : list.where((s) => s.name.contains(q)).toList();
            return [
              if (list.length >= _searchFrom) ...[
                TextField(
                  controller: _query,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: l10n.searchFolders,
                    prefixIcon: const Icon(LucideIcons.search, size: 18),
                  ),
                ),
                const SizedBox(height: NlSpace.md),
              ],
              if (filtered.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: NlSpace.xxl),
                  child: Column(
                    children: [
                      Text(l10n.noMatches, style: NlText.title),
                      Text(l10n.noMatchesDetail, style: NlText.secondary),
                    ],
                  ),
                )
              else
                RuledList(
                  children: [
                    for (final (i, subject) in filtered.indexed)
                      LibraryRow(
                        leading: FolderTab(
                          color:
                              folderTabColors[list.indexOf(subject) %
                                  folderTabColors.length],
                        ),
                        title: subject.name,
                        detail: [
                          l10n.folderBooks(subject.bookCount),
                          if (subject.deckCount > 0)
                            l10n.folderDecks(subject.deckCount),
                          if (subject.lastUpdatedAt != null)
                            l10n.folderUpdated(
                              shortDate(subject.lastUpdatedAt!, locale),
                            ),
                        ].join(),
                        onTap: () => context.go(Routes.folder(subject.id)),
                        key: ValueKey('folder-$i-${subject.id}'),
                      ),
                  ],
                ),
            ];
          },
        ),
      ],
    );
  }
}
