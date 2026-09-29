import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/api/api_error.dart';
import '../../../core/ui/ui.dart';
import '../../../core/upload/pdf_upload.dart';
import '../../../l10n/app_localizations.dart';
import '../../account/data/account_repository.dart';
import '../../auth/presentation/auth_widgets.dart';
import '../../library/data/library_models.dart';
import '../../library/data/library_repository.dart';
import '../../upload/upload_widgets.dart';
import '../data/mirror_models.dart';
import '../data/mirror_repository.dart';

enum _Mode { pdf, text }

/// مِرآة — turn a question file (PDF, or pasted text) into study cards.
/// Same pipeline as the web (upload → server analysis / OCR → generation in
/// parts); the screen is three clear steps with one button at the bottom.
class MirrorStartScreen extends ConsumerStatefulWidget {
  const MirrorStartScreen({super.key, this.appendToDeckId});

  /// Opened from a deck's "إضافة أسئلة": pasted text added to that file.
  final String? appendToDeckId;

  @override
  ConsumerState<MirrorStartScreen> createState() => _MirrorStartScreenState();
}

class _MirrorStartScreenState extends ConsumerState<MirrorStartScreen> {
  static const _minChars = 30;
  static const _maxChars = 60000;

  late _Mode _mode = widget.appendToDeckId != null ? _Mode.text : _Mode.pdf;
  MirrorDepth _depth = MirrorDepth.balanced;
  PickedPdf? _pdf;
  String? _folderId;
  late bool _append = widget.appendToDeckId != null;
  late String? _deckId = widget.appendToDeckId;
  final _text = TextEditingController();
  final _title = TextEditingController();

  double? _progress; // null = not uploading
  bool _busy = false;
  CancelToken? _cancel;
  String? _error;

  @override
  void dispose() {
    _cancel?.cancel();
    _text.dispose();
    _title.dispose();
    super.dispose();
  }

  Future<void> _pickPdf() async {
    setState(() => _error = null);
    final path = await ref.read(pdfPathPickerProvider)();
    if (path == null) return;
    try {
      final plan = ref.read(planProvider).value;
      final pdf = await checkPdf(
        File(path),
        maxFileSizeMb: plan?.maxFileSizeMb,
      );
      setState(() => _pdf = pdf);
    } on PdfRejected catch (rejected) {
      setState(() => _error = rejected.message);
    }
  }

  bool get _canSubmit {
    if (_busy) return false;
    if (_mode == _Mode.pdf) return _pdf != null && _folderId != null;
    final length = _text.text.trim().length;
    if (length < _minChars || length > _maxChars) return false;
    return _append ? _deckId != null : _folderId != null;
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    FocusScope.of(context).unfocus();
    final repo = ref.read(mirrorRepositoryProvider);
    setState(() {
      _busy = true;
      _error = null;
      _progress = _mode == _Mode.pdf ? 0 : null;
      _cancel = CancelToken();
    });
    try {
      final String jobId;
      if (_mode == _Mode.pdf) {
        jobId = await repo.startFromPdf(
          pdf: _pdf!,
          depth: _depth,
          subjectId: _folderId!,
          cancelToken: _cancel,
          onProgress: (p) {
            if (mounted) setState(() => _progress = p);
          },
        );
      } else {
        final started = await repo.startFromText(
          text: _text.text,
          depth: _depth,
          subjectId: _append ? null : _folderId,
          appendToDeckId: _append ? _deckId : null,
          title: _title.text,
        );
        jobId = started.jobId;
      }
      ref.invalidate(decksProvider);
      ref.invalidate(planProvider);
      if (mounted) context.pushReplacement(Routes.mirrorJob(jobId));
    } on DioException catch (error) {
      if (error.type != DioExceptionType.cancel && mounted) {
        setState(() => _error = apiErrorText(context, error));
      }
    } on PlanLimitException catch (limit) {
      if (mounted) {
        setState(() => _error = '${limit.details.title} — ${limit.message}');
      }
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorText(context, error));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _progress = null;
          _cancel = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PopScope(
      canPop: !_busy,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop || !_busy) return;
        if (await confirmLeaveUpload(context) && context.mounted) {
          _cancel?.cancel();
          context.pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(title: Text(l10n.mirrorTitle)),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(
            NlSpace.page,
            0,
            NlSpace.page,
            NlSpace.xxxl,
          ),
          children: [
            UploadIntro(text: l10n.mirrorIntro),
            const SizedBox(height: NlSpace.xl),
            _ModeToggle(
              mode: _mode,
              enabled: !_busy && widget.appendToDeckId == null,
              onChanged: (mode) => setState(() {
                _mode = mode;
                _error = null;
              }),
            ),
            const SizedBox(height: NlSpace.xl),
            UploadStep(
              number: 1,
              title: _mode == _Mode.pdf
                  ? l10n.mirrorStepFile
                  : l10n.mirrorStepText,
              child: _mode == _Mode.pdf ? _pdfPicker(l10n) : _textInput(l10n),
            ),
            UploadStep(
              number: 2,
              title: l10n.mirrorStepDepth,
              child: _DepthPicker(
                value: _depth,
                onChanged: _busy ? null : (d) => setState(() => _depth = d),
              ),
            ),
            UploadStep(
              number: 3,
              title: l10n.mirrorStepFolder,
              last: true,
              child: _destination(l10n),
            ),
            if (_error != null) ...[
              const SizedBox(height: NlSpace.md),
              AuthError(_error!),
            ],
            const SizedBox(height: NlSpace.lg),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  LucideIcons.shieldCheck,
                  size: 15,
                  color: NlColors.ink3,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(l10n.mirrorDisclaimer, style: NlText.caption),
                ),
              ],
            ),
          ],
        ),
        bottomNavigationBar: UploadSubmitBar(
          label: l10n.mirrorSubmit,
          icon: LucideIcons.sparkles,
          startingLabel: l10n.mirrorStarting,
          progress: _progress,
          busy: _busy,
          enabled: _canSubmit,
          onSubmit: _submit,
          onCancel: () => _cancel?.cancel(),
        ),
      ),
    );
  }

  Widget _pdfPicker(AppLocalizations l10n) => PdfPickBox(
    pdf: _pdf,
    maxFileSizeMb: ref.watch(planProvider).value?.maxFileSizeMb,
    onPick: _busy ? null : _pickPdf,
  );

  Widget _textInput(AppLocalizations l10n) {
    return ListenableBuilder(
      listenable: _text,
      builder: (context, _) {
        final length = _text.text.trim().length;
        final tooLong = length > _maxChars;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _text,
              enabled: !_busy,
              // Follows what is typed (the web's dir="auto"): English
              // questions read left-to-right, Arabic right-to-left.
              textDirection:
                  contentDirection(_text.text) ?? Directionality.of(context),
              minLines: 7,
              maxLines: 14,
              keyboardType: TextInputType.multiline,
              style: NlText.body,
              decoration: InputDecoration(hintText: l10n.mirrorTextHint),
            ),
            const SizedBox(height: 6),
            Text(
              tooLong
                  ? l10n.mirrorTextTooLong
                  : length > 0 && length < _minChars
                  ? l10n.mirrorTextTooShort
                  : l10n.mirrorTextCount(length),
              style: NlText.caption.copyWith(
                color: tooLong || (length > 0 && length < _minChars)
                    ? NlColors.wrong
                    : NlColors.ink3,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _destination(AppLocalizations l10n) {
    final decks = ref.watch(decksProvider).value ?? const <DeckSummary>[];
    final folderPicker = FolderPickerField(
      value: _folderId,
      onChanged: _busy ? null : (f) => setState(() => _folderId = f.id),
    );
    if (_mode == _Mode.pdf) return folderPicker;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.mirrorTextDestination, style: NlText.secondary),
        const SizedBox(height: NlSpace.sm),
        SegmentedButton<bool>(
          segments: [
            ButtonSegment(value: false, label: Text(l10n.mirrorTextNewFile)),
            ButtonSegment(value: true, label: Text(l10n.mirrorTextAppend)),
          ],
          selected: {_append},
          showSelectedIcon: false,
          onSelectionChanged: _busy || decks.isEmpty
              ? null
              : (s) => setState(() => _append = s.first),
        ),
        const SizedBox(height: NlSpace.md),
        if (_append)
          DropdownButtonFormField<String>(
            initialValue: _deckId,
            isExpanded: true,
            hint: Text(l10n.mirrorChooseDeck),
            items: [
              for (final d in decks)
                DropdownMenuItem(value: d.id, child: Text(isolate(d.title))),
            ],
            onChanged: _busy ? null : (id) => setState(() => _deckId = id),
          )
        else
          folderPicker,
        const SizedBox(height: NlSpace.md),
        AuthField(
          label: l10n.mirrorTextTitle,
          controller: _title,
          hint: l10n.mirrorTextTitleHint,
          maxLength: 120,
          enabled: !_busy,
        ),
      ],
    );
  }
}

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({
    required this.mode,
    required this.enabled,
    required this.onChanged,
  });

  final _Mode mode;
  final bool enabled;
  final ValueChanged<_Mode> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    Widget option(_Mode value, IconData icon, String label) {
      final selected = mode == value;
      return Expanded(
        child: Semantics(
          selected: selected,
          button: true,
          child: Material(
            color: selected ? NlColors.ink : Colors.transparent,
            borderRadius: BorderRadius.circular(NlRadius.md - 2),
            child: InkWell(
              borderRadius: BorderRadius.circular(NlRadius.md - 2),
              onTap: enabled ? () => onChanged(value) : null,
              child: SizedBox(
                height: 44,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      icon,
                      size: 17,
                      color: selected ? Colors.white : NlColors.ink2,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      label,
                      style: NlText.button.copyWith(
                        color: selected ? Colors.white : NlColors.ink2,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.rule),
      ),
      child: Row(
        children: [
          option(_Mode.pdf, LucideIcons.fileText, l10n.mirrorModePdf),
          option(_Mode.text, LucideIcons.clipboardPaste, l10n.mirrorModeText),
        ],
      ),
    );
  }
}

class _DepthPicker extends StatelessWidget {
  const _DepthPicker({required this.value, required this.onChanged});

  final MirrorDepth value;
  final ValueChanged<MirrorDepth>? onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final options = [
      (MirrorDepth.quick, l10n.depthQuick, l10n.depthQuickCaption),
      (MirrorDepth.balanced, l10n.depthBalanced, l10n.depthBalancedCaption),
      (MirrorDepth.detailed, l10n.depthDetailed, l10n.depthDetailedCaption),
    ];
    return Row(
      children: [
        for (final (i, (depth, label, caption)) in options.indexed) ...[
          if (i > 0) const SizedBox(width: NlSpace.sm),
          Expanded(
            child: Semantics(
              selected: value == depth,
              button: true,
              child: Material(
                color: value == depth ? NlColors.markerSoft : NlColors.sheet,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(NlRadius.md),
                  side: BorderSide(
                    color: value == depth ? NlColors.ink : NlColors.rule,
                    width: value == depth ? 1.5 : 1,
                  ),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(NlRadius.md),
                  onTap: onChanged == null ? null : () => onChanged!(depth),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: NlSpace.sm,
                      vertical: NlSpace.md,
                    ),
                    child: Column(
                      children: [
                        Text(
                          label,
                          style: NlText.rowLabel.copyWith(fontSize: 15),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          caption,
                          textAlign: TextAlign.center,
                          style: NlText.caption.copyWith(fontSize: 12),
                        ),
                        if (depth == MirrorDepth.balanced) ...[
                          const SizedBox(height: 4),
                          Text(
                            l10n.depthRecommended,
                            style: NlText.caption.copyWith(
                              fontSize: 11,
                              color: NlColors.niroDeep,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
