import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/ui/ui.dart';
import '../../core/upload/pdf_upload.dart';
import '../../l10n/app_localizations.dart';
import '../library/data/library_models.dart';
import '../library/data/library_repository.dart';
import '../library/presentation/folder_sheets.dart';

/// The parts shared by the upload screens (study book, مِرآة): Niro intro,
/// numbered steps, the PDF box and the bottom action bar with progress.

String formatBytes(int bytes) => bytes < 1024 * 1024
    ? '${(bytes / 1024).round()} KB'
    : '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';

class UploadIntro extends StatelessWidget {
  const UploadIntro({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const NiroImage(expression: NiroExpression.explaining, size: 72),
        const SizedBox(width: NlSpace.md),
        Expanded(child: Text(text, style: NlText.secondary)),
      ],
    );
  }
}

/// A numbered step — the steps of an upload really are a sequence.
class UploadStep extends StatelessWidget {
  const UploadStep({
    super.key,
    required this.number,
    required this.title,
    required this.child,
    this.last = false,
  });

  final int number;
  final String title;
  final Widget child;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : NlSpace.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: NlColors.marker,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '$number',
                  style: NlText.label.copyWith(
                    color: NlColors.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: NlSpace.sm),
              Semantics(
                header: true,
                child: Text(title, style: NlText.title.copyWith(fontSize: 17)),
              ),
            ],
          ),
          const SizedBox(height: NlSpace.md),
          child,
        ],
      ),
    );
  }
}

/// Empty: a dashed box that opens the picker. Picked: the file with a
/// "change" button.
class PdfPickBox extends StatelessWidget {
  const PdfPickBox({
    super.key,
    required this.pdf,
    required this.onPick,
    this.maxFileSizeMb,
  });

  final PickedPdf? pdf;
  final int? maxFileSizeMb;

  /// Null while busy.
  final VoidCallback? onPick;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final pdf = this.pdf;
    if (pdf == null) {
      return _DashedBox(
        onTap: onPick,
        child: Column(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: NlColors.niroSoft,
                borderRadius: BorderRadius.circular(NlRadius.md),
              ),
              child: const Icon(LucideIcons.fileUp, color: NlColors.niroDeep),
            ),
            const SizedBox(height: NlSpace.md),
            Text(l10n.mirrorPickFile, style: NlText.rowLabel),
            const SizedBox(height: 2),
            Text(
              l10n.mirrorPickHint,
              style: NlText.caption,
              textAlign: TextAlign.center,
            ),
            if (maxFileSizeMb != null)
              Text(l10n.mirrorMaxSize(maxFileSizeMb!), style: NlText.caption),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(NlSpace.md),
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.ink, width: 1.5),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: NlColors.wrongSoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              LucideIcons.fileText,
              color: NlColors.wrong,
              size: 20,
            ),
          ),
          const SizedBox(width: NlSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isolate(pdf.name),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NlText.rowLabel,
                ),
                Text(
                  l10n.mirrorFileReady(isolateLtr(formatBytes(pdf.size))),
                  style: NlText.caption,
                ),
              ],
            ),
          ),
          NlButton(
            label: l10n.mirrorChangeFile,
            kind: NlButtonKind.ghost,
            onPressed: onPick,
          ),
        ],
      ),
    );
  }
}

class _DashedBox extends StatelessWidget {
  const _DashedBox({required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DashPainter(),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: BorderRadius.circular(NlRadius.lg),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              vertical: NlSpace.xxl,
              horizontal: NlSpace.lg,
            ),
            child: Center(child: child),
          ),
        ),
      ),
    );
  }
}

class _DashPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(NlRadius.lg),
    );
    canvas.drawRRect(rect, Paint()..color = NlColors.sheet);
    final path = Path()..addRRect(rect);
    final paint = Paint()
      ..color = NlColors.ruleStrong
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    for (final metric in path.computeMetrics()) {
      for (var d = 0.0; d < metric.length; d += 12) {
        canvas.drawPath(metric.extractPath(d, d + 7), paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// The one action, always reachable above the keyboard / gesture bar.
/// While busy it shows upload progress (with cancel), then [startingLabel]
/// while the server takes over.
class UploadSubmitBar extends StatelessWidget {
  const UploadSubmitBar({
    super.key,
    required this.label,
    required this.icon,
    required this.startingLabel,
    required this.progress,
    required this.busy,
    required this.enabled,
    required this.onSubmit,
    required this.onCancel,
    this.note,
  });

  final String label;
  final IconData icon;
  final String startingLabel;
  final double? progress;
  final bool busy;
  final bool enabled;
  final VoidCallback onSubmit;
  final VoidCallback onCancel;

  /// Shown under the progress while busy (e.g. "keep the app open").
  final String? note;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final uploading = progress != null && progress! < 1;
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: NlColors.sheet,
        border: Border(top: BorderSide(color: NlColors.rule)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            NlSpace.page,
            NlSpace.md,
            NlSpace.page,
            NlSpace.md + MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: busy
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            uploading
                                ? l10n.mirrorUploading(
                                    (progress! * 100).round(),
                                  )
                                : startingLabel,
                            style: NlText.rowLabel.copyWith(fontSize: 15),
                          ),
                        ),
                        if (uploading)
                          NlButton(
                            label: l10n.mirrorCancelUpload,
                            kind: NlButtonKind.ghost,
                            onPressed: onCancel,
                          ),
                      ],
                    ),
                    const SizedBox(height: NlSpace.sm),
                    uploading
                        ? NlProgressBar(value: progress!)
                        : const LinearProgressIndicator(minHeight: 6),
                    if (note != null && uploading) ...[
                      const SizedBox(height: NlSpace.sm),
                      Text(note!, style: NlText.caption),
                    ],
                  ],
                )
              : NlButton(
                  label: label,
                  kind: NlButtonKind.marker,
                  icon: icon,
                  expand: true,
                  onPressed: enabled ? onSubmit : null,
                ),
        ),
      ),
    );
  }
}

/// Folder dropdown + "new folder" — every upload goes into a folder (the
/// server requires one).
class FolderPickerField extends ConsumerWidget {
  const FolderPickerField({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String? value;

  /// Null while busy.
  final ValueChanged<Subject>? onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final folders = ref.watch(subjectsProvider).value ?? const <Subject>[];
    // A just-created folder may not be in the list until it reloads.
    final known = folders.any((f) => f.id == value);
    return Row(
      children: [
        Expanded(
          child: DropdownButtonFormField<String>(
            key: ValueKey(known ? value : null),
            initialValue: known ? value : null,
            isExpanded: true,
            hint: Text(
              folders.isEmpty ? l10n.mirrorNoFolders : l10n.mirrorChooseFolder,
            ),
            items: [
              for (final f in folders)
                DropdownMenuItem(value: f.id, child: Text(isolate(f.name))),
            ],
            onChanged: onChanged == null
                ? null
                : (id) => onChanged!(folders.firstWhere((f) => f.id == id)),
          ),
        ),
        const SizedBox(width: NlSpace.sm),
        IconButton.outlined(
          tooltip: l10n.newFolder,
          icon: const Icon(LucideIcons.folderPlus),
          onPressed: onChanged == null
              ? null
              : () async {
                  final created = await showCreateFolderSheet(context);
                  if (created != null) onChanged!(created);
                },
        ),
      ],
    );
  }
}

/// Asked when leaving a screen mid-upload: the transfer is tied to the
/// screen (no background upload yet), so leaving stops it.
Future<bool> confirmLeaveUpload(BuildContext context) {
  final l10n = AppLocalizations.of(context);
  return showNlConfirm(
    context,
    title: l10n.uploadLeaveTitle,
    message: l10n.uploadLeaveBody,
    confirmLabel: l10n.uploadLeaveConfirm,
    destructive: true,
  );
}
