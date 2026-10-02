import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../library/data/library_repository.dart';
import '../../library/presentation/library_widgets.dart';

/// ملفات الأسئلة — the student's مِرآة files (the web's "مكتبتي" view).
class MirrorLibraryScreen extends ConsumerWidget {
  const MirrorLibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final decks = ref.watch(decksProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.questionFilesTitle)),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: NlColors.ink,
        foregroundColor: Colors.white,
        icon: const Icon(LucideIcons.plus),
        label: Text(l10n.questionFilesNew),
        onPressed: () => context.push(Routes.uploadQuestionFile),
      ),
      body: decks.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(NlSpace.page),
          child: NlListSkeleton(),
        ),
        error: (error, _) => NlErrorView(
          error: error,
          onRetry: () => ref.invalidate(decksProvider),
        ),
        data: (list) => list.isEmpty
            ? NlEmptyState(
                title: l10n.questionFilesEmpty,
                message: l10n.questionFilesEmptyHint,
                actionLabel: l10n.questionFilesNew,
                onAction: () => context.push(Routes.uploadQuestionFile),
              )
            : RefreshIndicator(
                color: NlColors.ink,
                onRefresh: () async {
                  ref.invalidate(decksProvider);
                  try {
                    await ref.read(decksProvider.future);
                  } catch (_) {}
                },
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    NlSpace.page,
                    0,
                    NlSpace.page,
                    96,
                  ),
                  children: [
                    RuledList(
                      children: [
                        for (final deck in list)
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
                            detail: l10n.deckMeta(
                              deck.cardCount,
                              deck.pageCount,
                            ),
                            onTap: () => context.push(Routes.deck(deck.id)),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
