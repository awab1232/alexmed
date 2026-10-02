import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../account/data/account_repository.dart';
import 'folder_sheets.dart';

/// The bottom bar's ＋ — the web's UPLOAD_CHOICES (components/BottomNav.tsx):
/// study book, question file, new folder, and "code from your doctor" only
/// while protected doctor sets are switched on.
Future<void> showAddSheet(BuildContext context) {
  final l10n = AppLocalizations.of(context);
  return showNlSheet<void>(
    context,
    title: l10n.addSheetTitle,
    builder: (sheetContext) => const _AddChoices(),
  );
}

class _AddChoices extends ConsumerWidget {
  const _AddChoices();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final doctorSets = ref.watch(doctorSetsEnabledProvider).value ?? false;
    final router = GoRouter.of(context);
    void go(String route) {
      Navigator.of(context).pop();
      router.push(route);
    }

    return SingleChildScrollView(
      child: NlGroup(
        children: [
          NlRow(
            icon: LucideIcons.bookOpen,
            label: l10n.addBook,
            value: l10n.addBookDetail,
            onTap: () => go(Routes.uploadBook),
          ),
          NlRow(
            icon: LucideIcons.listChecks,
            label: l10n.addQuestionFile,
            value: l10n.addQuestionFileDetail,
            onTap: () => go(Routes.uploadQuestionFile),
          ),
          NlRow(
            icon: LucideIcons.folderPlus,
            label: l10n.newFolder,
            value: l10n.addFolderDetail,
            onTap: () async {
              final navigator = Navigator.of(context);
              final messengerContext = navigator.context;
              navigator.pop();
              final created = await showCreateFolderSheet(messengerContext);
              if (created != null && messengerContext.mounted) {
                showNlToast(
                  messengerContext,
                  AppLocalizations.of(messengerContext).saved,
                );
              }
            },
          ),
          if (doctorSets)
            NlRow(
              icon: LucideIcons.keyRound,
              label: l10n.addDoctorCode,
              value: l10n.addDoctorCodeDetail,
              onTap: () => go(Routes.redeemCode),
            ),
        ],
      ),
    );
  }
}
