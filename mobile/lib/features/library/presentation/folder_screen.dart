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

enum _FolderAction { rename, delete }

/// A folder (the web's /subjects/[id]): its books, then its question files
/// as a separate section, each movable to another folder.
class FolderScreen extends ConsumerWidget {
  const FolderScreen({super.key, required this.subjectId});

  final String subjectId;

  Future<void> _onAction(
    BuildContext context,
    WidgetRef ref,
    Subject subject,
    _FolderAction action,
  ) async {
    final l10n = AppLocalizations.of(context);
    switch (action) {
      case _FolderAction.rename:
        final saved = await showRenameFolderSheet(context, subject);
        if (saved && context.mounted) showNlToast(context, l10n.saved);
      case _FolderAction.delete:
        final confirmed = await showNlConfirm(
          context,
          title: l10n.deleteFolderTitle,
          message: l10n.deleteFolderBody,
          confirmLabel: l10n.deleteFolder,
          destructive: true,
        );
        if (!confirmed || !context.mounted) return;
        try {
          await ref.read(libraryRepositoryProvider).deleteSubject(subject.id);
          refreshLibrary(ref);
          if (context.mounted) context.go(Routes.home);
        } catch (error) {
          if (context.mounted) {
            showNlToast(context, apiErrorText(context, error));
          }
        }
    }
  }

  Future<void> _move(
    BuildContext context,
    WidgetRef ref, {
    String? bookId,
    String? deckId,
  }) async {
    final folders = ref.read(subjectsProvider).value ?? const <Subject>[];
    final choice = await showMoveToFolderSheet(
      context,
      folders: folders,
      currentId: subjectId,
    );
    if (!choice.picked || choice.subjectId == subjectId) return;
    final repo = ref.read(libraryRepositoryProvider);
    try {
      if (bookId != null) {
        await repo.moveBook(bookId: bookId, subjectId: choice.subjectId);
        ref.invalidate(booksProvider);
      } else if (deckId != null) {
        await repo.moveDeck(deckId: deckId, subjectId: choice.subjectId);
        ref.invalidate(decksProvider);
      }
      ref.invalidate(subjectsProvider);
      if (context.mounted) {
        showNlToast(context, AppLocalizations.of(context).moved);
      }
    } catch (error) {
      if (context.mounted) showNlToast(context, apiErrorText(context, error));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final subject = ref.watch(subjectProvider(subjectId));
    final books = ref.watch(booksProvider);
    final decks = ref.watch(decksProvider).value ?? const <DeckSummary>[];

    return Scaffold(
      appBar: AppBar(
        title: Text(subject.value?.name ?? ''),
        actions: [
          if (subject.value != null)
            PopupMenuButton<_FolderAction>(
              tooltip: l10n.folderActions,
              icon: const Icon(LucideIcons.ellipsisVertical),
              onSelected: (action) =>
                  _onAction(context, ref, subject.value!, action),
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: _FolderAction.rename,
                  child: Text(l10n.renameFolder),
                ),
                PopupMenuItem(
                  value: _FolderAction.delete,
                  child: Text(
                    l10n.deleteFolder,
                    style: const TextStyle(color: NlColors.wrong),
                  ),
                ),
              ],
            ),
        ],
      ),
      body: switch ((subject, books)) {
        (AsyncError(:final error), _) ||
        (_, AsyncError(:final error)) => NlErrorView(
          error: error,
          onRetry: () {
            ref
              ..invalidate(subjectProvider(subjectId))
              ..invalidate(booksProvider);
          },
        ),
        (AsyncData(value: final folder), AsyncData(value: final allBooks)) =>
          _FolderBody(
            folder: folder,
            books: allBooks.where((b) => b.subjectId == subjectId).toList(),
            decks: decks.where((d) => d.subjectId == subjectId).toList(),
            onMoveBook: (id) => _move(context, ref, bookId: id),
            onMoveDeck: (id) => _move(context, ref, deckId: id),
            onRefresh: () async {
              ref
                ..invalidate(subjectProvider(subjectId))
                ..invalidate(booksProvider)
                ..invalidate(decksProvider);
              await ref
                  .read(booksProvider.future)
                  .catchError((_) => const <BookSummary>[]);
            },
          ),
        _ => const Padding(
          padding: EdgeInsets.all(NlSpace.page),
          child: NlListSkeleton(),
        ),
      },
    );
  }
}

class _FolderBody extends StatelessWidget {
  const _FolderBody({
    required this.folder,
    required this.books,
    required this.decks,
    required this.onMoveBook,
    required this.onMoveDeck,
    required this.onRefresh,
  });

  final Subject folder;
  final List<BookSummary> books;
  final List<DeckSummary> decks;
  final ValueChanged<String> onMoveBook;
  final ValueChanged<String> onMoveDeck;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    Widget moveButton(VoidCallback onPressed) => IconButton(
      tooltip: l10n.moveTo,
      icon: const Icon(LucideIcons.folderInput, size: 20, color: NlColors.ink3),
      onPressed: onPressed,
    );

    return RefreshIndicator(
      color: NlColors.ink,
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          NlSpace.page,
          0,
          NlSpace.page,
          NlSpace.xxxl,
        ),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  [
                    l10n.folderSummary(folder.typeLabel, books.length),
                    if (decks.isNotEmpty) l10n.folderDecks(decks.length),
                  ].join(),
                  style: NlText.secondary,
                ),
              ),
              NlButton(
                label: l10n.addFile,
                kind: NlButtonKind.secondary,
                icon: LucideIcons.plus,
                onPressed: () => context.push(Routes.uploadBook),
              ),
            ],
          ),
          const SizedBox(height: NlSpace.lg),
          if (books.isEmpty)
            NlEmptyState(
              title: l10n.folderEmpty,
              actionLabel: l10n.addFile,
              inline: true,
              onAction: () => context.push(Routes.uploadBook),
            )
          else
            RuledList(
              children: [
                for (final book in books)
                  LibraryRow(
                    leading: BookSpine(state: book.state),
                    title: book.title,
                    detail: [
                      l10n.bookMeta(book.pageCount),
                      if (book.updatedAt != null)
                        l10n.folderUpdated(shortDate(book.updatedAt!, locale)),
                    ].join(),
                    onTap: () => context.push(Routes.book(book.id)),
                    trailing: moveButton(() => onMoveBook(book.id)),
                  ),
              ],
            ),
          if (decks.isNotEmpty) ...[
            SectionHead(title: l10n.questionFilesSection),
            RuledList(
              children: [
                for (final deck in decks)
                  LibraryRow(
                    leading: Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: NlColors.markerSoft,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        LucideIcons.layers3,
                        size: 18,
                        color: NlColors.ink2,
                      ),
                    ),
                    title: deck.title,
                    badge: l10n.questionFileBadge,
                    detail: l10n.deckMeta(deck.cardCount, deck.pageCount),
                    onTap: () => context.push(Routes.deck(deck.id)),
                    trailing: moveButton(() => onMoveDeck(deck.id)),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
