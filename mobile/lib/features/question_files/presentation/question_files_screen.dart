import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../account/data/account_repository.dart';
import '../../library/data/library_models.dart' show bookDisplayTitle;
import '../../library/presentation/library_widgets.dart';
import '../data/question_file_models.dart';
import '../data/question_file_repository.dart';

String questionFileStatusLabel(
  AppLocalizations l10n,
  QuestionFileStatus status,
) => switch (status) {
  QuestionFileStatus.extracting => l10n.qfStatusExtracting,
  QuestionFileStatus.complete => l10n.qfStatusComplete,
  QuestionFileStatus.failed => l10n.qfStatusFailed,
  QuestionFileStatus.pending => l10n.qfStatusPending,
  QuestionFileStatus.other => l10n.qfStatusPending,
};

/// بنوك أسئلتك — the web's app/books/question-files: questions extracted
/// as they are from the student's files (no AI generation), kept apart
/// from study books. Doctor sets sit next to them when switched on.
class QuestionFilesScreen extends ConsumerWidget {
  const QuestionFilesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final files = ref.watch(questionFilesProvider);
    final doctorSets = ref.watch(doctorSetsEnabledProvider).value ?? false;
    void upload() => context.push(Routes.uploadQuestionBank);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.qfTitle),
        actions: [
          if (doctorSets)
            IconButton(
              tooltip: l10n.doctorSetsTitle,
              icon: const Icon(LucideIcons.keyRound),
              onPressed: () => context.push(Routes.questionSets),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: NlColors.ink,
        foregroundColor: Colors.white,
        icon: const Icon(LucideIcons.plus),
        label: Text(l10n.qfUpload),
        onPressed: upload,
      ),
      body: files.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(NlSpace.page),
          child: NlListSkeleton(),
        ),
        error: (error, _) => NlErrorView(
          error: error,
          onRetry: () => ref.invalidate(questionFilesProvider),
        ),
        data: (list) => list.isEmpty
            ? NlEmptyState(
                title: l10n.qfEmpty,
                message: l10n.qfEmptyHint,
                actionLabel: l10n.qfUpload,
                onAction: upload,
              )
            : RefreshIndicator(
                color: NlColors.ink,
                onRefresh: () async {
                  ref.invalidate(questionFilesProvider);
                  try {
                    await ref.read(questionFilesProvider.future);
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
                    Padding(
                      padding: const EdgeInsets.only(bottom: NlSpace.md),
                      child: Text(l10n.qfIntro, style: NlText.secondary),
                    ),
                    RuledList(
                      children: [
                        for (final file in list)
                          LibraryRow(
                            leading: _FileIcon(status: file.status),
                            title: bookDisplayTitle(file.fileName),
                            detail: file.status == QuestionFileStatus.complete
                                ? '${questionFileStatusLabel(l10n, file.status)} · ${l10n.qfCount(file.questionCount)}'
                                : questionFileStatusLabel(l10n, file.status),
                            onTap: () =>
                                context.push(Routes.questionBank(file.id)),
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

class _FileIcon extends StatelessWidget {
  const _FileIcon({required this.status});
  final QuestionFileStatus status;

  @override
  Widget build(BuildContext context) {
    final (icon, bg, fg) = switch (status) {
      QuestionFileStatus.failed => (
        LucideIcons.circleAlert,
        NlColors.wrongSoft,
        NlColors.wrong,
      ),
      QuestionFileStatus.complete => (
        LucideIcons.clipboardList,
        NlColors.markerSoft,
        NlColors.ink2,
      ),
      _ => (LucideIcons.loaderCircle, NlColors.niroSoft, NlColors.niroDeep),
    };
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, size: 18, color: fg),
    );
  }
}
