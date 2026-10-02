import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/auth_widgets.dart';
import '../data/account_repository.dart';

/// الملف الدراسي: year + specialty, and — quietly at the bottom, as on the
/// web since 2026-09-29 — the way to delete the account.
Future<void> showStudyProfileSheet(BuildContext context, AccountProfile me) {
  return showNlSheet<void>(
    context,
    title: AppLocalizations.of(context).studyProfile,
    builder: (_) => _StudyProfileForm(profile: me),
  );
}

class _StudyProfileForm extends ConsumerStatefulWidget {
  const _StudyProfileForm({required this.profile});

  final AccountProfile profile;

  @override
  ConsumerState<_StudyProfileForm> createState() => _StudyProfileFormState();
}

class _StudyProfileFormState extends ConsumerState<_StudyProfileForm> {
  late final _year = TextEditingController(text: widget.profile.academicYear);
  late final _specialty = TextEditingController(text: widget.profile.specialty);
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _year.dispose();
    _specialty.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    String? clean(String value) => value.trim().isEmpty ? null : value.trim();
    try {
      await ref
          .read(accountRepositoryProvider)
          .updateProfile(
            academicYear: clean(_year.text),
            specialty: clean(_specialty.text),
          );
      ref.invalidate(profileProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      showNlToast(context, AppLocalizations.of(context).saved);
    } catch (error) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = apiErrorText(context, error);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthField(
            label: l10n.academicYear,
            controller: _year,
            hint: l10n.academicYearHint,
            maxLength: 120,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: NlSpace.lg),
          AuthField(
            label: l10n.specialty,
            controller: _specialty,
            hint: l10n.specialtyHint,
            maxLength: 120,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _save(),
          ),
          if (_error != null) ...[
            const SizedBox(height: NlSpace.md),
            AuthError(_error!),
          ],
          const SizedBox(height: NlSpace.xl),
          NlButton(
            label: l10n.actionSave,
            loading: _busy,
            expand: true,
            onPressed: _save,
          ),
          const SizedBox(height: NlSpace.lg),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton(
              style: TextButton.styleFrom(foregroundColor: NlColors.ink3),
              onPressed: _busy ? null : () => showDeleteAccountDialog(context),
              child: Text(
                l10n.deleteAccount,
                style: const TextStyle(decoration: TextDecoration.underline),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The web's confirmation: the delete button stays disabled until «حذف» is
/// typed. On success the session ends here too.
Future<void> showDeleteAccountDialog(BuildContext context) {
  return showDialog<void>(
    context: context,
    builder: (_) => const _DeleteAccountDialog(),
  );
}

class _DeleteAccountDialog extends ConsumerStatefulWidget {
  const _DeleteAccountDialog();

  @override
  ConsumerState<_DeleteAccountDialog> createState() =>
      _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends ConsumerState<_DeleteAccountDialog> {
  final _typed = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _typed.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(accountRepositoryProvider).deleteAccount();
      await ref.read(sessionControllerProvider.notifier).signOut();
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = apiErrorText(context, error);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(l10n.deleteAccountTitle),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.deleteAccountBody),
            const SizedBox(height: NlSpace.lg),
            AuthField(
              label: l10n.deleteAccountTypeWord,
              controller: _typed,
              hint: l10n.deleteAccountConfirmWord,
              enabled: !_busy,
            ),
            if (_error != null) ...[
              const SizedBox(height: NlSpace.md),
              AuthError(_error!),
            ],
          ],
        ),
      ),
      actions: [
        NlButton(
          label: l10n.actionCancel,
          kind: NlButtonKind.secondary,
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
        ),
        ListenableBuilder(
          listenable: _typed,
          builder: (context, _) => NlButton(
            label: l10n.deleteAccountSubmit,
            kind: NlButtonKind.destructive,
            loading: _busy,
            onPressed: _typed.text.trim() == l10n.deleteAccountConfirmWord
                ? _delete
                : null,
          ),
        ),
      ],
    );
  }
}
