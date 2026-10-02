import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/auth_widgets.dart';
import '../data/library_models.dart';
import '../data/library_repository.dart';

/// New folder (name + subject type) — the web's home folder form.
/// Returns the created folder, or null when dismissed.
Future<Subject?> showCreateFolderSheet(BuildContext context) {
  final l10n = AppLocalizations.of(context);
  return showNlSheet<Subject>(
    context,
    title: l10n.newFolder,
    builder: (_) => const _FolderForm(),
  );
}

/// Rename an existing folder. Returns true when saved.
Future<bool> showRenameFolderSheet(
  BuildContext context,
  Subject subject,
) async {
  final l10n = AppLocalizations.of(context);
  final saved = await showNlSheet<Subject>(
    context,
    title: l10n.renameFolder,
    builder: (_) => _FolderForm(existing: subject),
  );
  return saved != null;
}

class _FolderForm extends ConsumerStatefulWidget {
  const _FolderForm({this.existing});

  final Subject? existing;

  @override
  ConsumerState<_FolderForm> createState() => _FolderFormState();
}

class _FolderFormState extends ConsumerState<_FolderForm> {
  late final _name = TextEditingController(text: widget.existing?.name);
  String _type = 'general';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final repo = ref.read(libraryRepositoryProvider);
    try {
      final existing = widget.existing;
      final Subject result;
      if (existing == null) {
        result = await repo.createSubject(name: name, type: _type);
      } else {
        await repo.renameSubject(id: existing.id, name: name);
        result = Subject(id: existing.id, name: name, type: existing.type);
        ref.invalidate(subjectProvider(existing.id));
      }
      ref.invalidate(subjectsProvider);
      if (mounted) Navigator.of(context).pop(result);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = widget.existing == null
            ? AppLocalizations.of(context).folderCreateError
            : apiErrorText(context, error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final creating = widget.existing == null;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthField(
          label: l10n.folderName,
          controller: _name,
          hint: l10n.folderNameHint,
          maxLength: 120,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _save(),
        ),
        if (creating) ...[
          const SizedBox(height: NlSpace.lg),
          Text(
            l10n.folderType,
            style: NlText.label.copyWith(color: NlColors.ink),
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue: _type,
            isExpanded: true,
            items: [
              for (final entry in subjectTypeLabels.entries)
                DropdownMenuItem(value: entry.key, child: Text(entry.value)),
            ],
            onChanged: _busy ? null : (value) => setState(() => _type = value!),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: NlSpace.md),
          AuthError(_error!),
        ],
        const SizedBox(height: NlSpace.xl),
        ListenableBuilder(
          listenable: _name,
          builder: (context, _) => NlButton(
            label: creating ? l10n.folderCreate : l10n.actionSave,
            loading: _busy,
            expand: true,
            onPressed: _name.text.trim().isEmpty ? null : _save,
          ),
        ),
      ],
    );
  }
}

/// Pick the folder a book / question file belongs to ("بدون مادة" = none).
/// Resolves to the chosen folder id (null = none), or [keep] when dismissed.
Future<({bool picked, String? subjectId})> showMoveToFolderSheet(
  BuildContext context, {
  required List<Subject> folders,
  required String? currentId,
}) async {
  final l10n = AppLocalizations.of(context);
  const noneKey = '__none__';
  final choice = await showNlSheet<String>(
    context,
    title: l10n.moveTo,
    builder: (sheetContext) => SingleChildScrollView(
      child: NlGroup(
        children: [
          for (final folder in folders)
            NlRow(
              label: folder.name,
              showChevron: false,
              trailing: folder.id == currentId
                  ? const Icon(Icons.check, color: NlColors.ink)
                  : null,
              onTap: () => Navigator.of(sheetContext).pop(folder.id),
            ),
          NlRow(
            label: l10n.noFolder,
            showChevron: false,
            trailing: currentId == null
                ? const Icon(Icons.check, color: NlColors.ink)
                : null,
            onTap: () => Navigator.of(sheetContext).pop(noneKey),
          ),
        ],
      ),
    ),
  );
  if (choice == null) return (picked: false, subjectId: currentId);
  return (picked: true, subjectId: choice == noneKey ? null : choice);
}
