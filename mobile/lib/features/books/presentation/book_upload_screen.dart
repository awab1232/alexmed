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
import '../../question_files/data/question_file_repository.dart';
import '../../upload/upload_widgets.dart';
import '../data/book_models.dart';
import '../data/book_repository.dart';

/// Upload to كتبي — the web's app/books/upload: a study book (chapters,
/// summaries, cards, quizzes) or a question file (its questions extracted
/// as they are, no AI generation). The file goes straight to storage, then
/// the server reads it; the book / question-file screen shows that
/// progress. (مِرآة, the ＋ sheet's «ملف أسئلة», is the other path.)
class BookUploadScreen extends ConsumerStatefulWidget {
  const BookUploadScreen({
    super.key,
    this.subjectId,
    this.questionFile = false,
  });

  /// Pre-selected folder (opened from a folder's "add").
  final String? subjectId;

  /// Starts on the question-file kind (from بنوك الأسئلة).
  final bool questionFile;

  @override
  ConsumerState<BookUploadScreen> createState() => _BookUploadScreenState();
}

class _BookUploadScreenState extends ConsumerState<BookUploadScreen> {
  PickedPdf? _pdf;
  late String? _folderId = widget.subjectId;
  late bool _questionFile = widget.questionFile;
  String _profile = 'general';
  bool _profileTouched = false;

  double? _progress;
  bool _busy = false;
  CancelToken? _cancel;
  String? _error;

  @override
  void initState() {
    super.initState();
    // A folder opened from its screen: its type is the natural profile.
    if (widget.subjectId != null) {
      ref.read(subjectsProvider.future).then((folders) {
        final folder = folders.where((f) => f.id == widget.subjectId);
        if (mounted && folder.isNotEmpty) _folderChosen(folder.first);
      }, onError: (_) {});
    }
  }

  @override
  void dispose() {
    _cancel?.cancel();
    super.dispose();
  }

  void _folderChosen(Subject folder) {
    setState(() {
      _folderId = folder.id;
      // Same default as the folder's type until the student picks one.
      if (!_profileTouched && bookProfiles.containsKey(folder.type)) {
        _profile = folder.type;
      }
    });
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

  bool get _canSubmit => !_busy && _pdf != null && _folderId != null;

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() {
      _busy = true;
      _error = null;
      _progress = 0;
      _cancel = CancelToken();
    });
    try {
      void progress(double p) {
        if (mounted) setState(() => _progress = p);
      }

      if (_questionFile) {
        final fileId = await ref
            .read(questionFileRepositoryProvider)
            .upload(
              pdf: _pdf!,
              subjectId: _folderId!,
              cancelToken: _cancel,
              onProgress: progress,
            );
        ref
          ..invalidate(questionFilesProvider)
          ..invalidate(planProvider);
        if (mounted) context.pushReplacement(Routes.questionBank(fileId));
        return;
      }
      final bookId = await ref
          .read(bookRepositoryProvider)
          .upload(
            pdf: _pdf!,
            profile: _profile,
            subjectId: _folderId!,
            cancelToken: _cancel,
            onProgress: progress,
          );
      ref
        ..invalidate(booksProvider)
        ..invalidate(subjectsProvider)
        ..invalidate(planProvider);
      if (mounted) context.pushReplacement(Routes.book(bookId));
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

  /// A book already in the library under the same name — most likely the
  /// same file picked again (local check, nothing is uploaded).
  BookSummary? _duplicateOf(PickedPdf pdf) {
    final books = ref.watch(booksProvider).value ?? const <BookSummary>[];
    final name = _normalize(pdf.name);
    for (final book in books) {
      if (_normalize(book.fileName) == name) return book;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final plan = ref.watch(planProvider).value;
    final pdf = _pdf;
    final duplicate = pdf == null || _questionFile ? null : _duplicateOf(pdf);
    final quota = _questionFile ? plan?.questionFiles : plan?.studyFiles;

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
        appBar: AppBar(
          title: Text(
            _questionFile ? l10n.qfUploadTitle : l10n.bookUploadTitle,
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(
            NlSpace.page,
            0,
            NlSpace.page,
            NlSpace.xxxl,
          ),
          children: [
            UploadIntro(
              text: _questionFile ? l10n.qfUploadIntro : l10n.bookUploadIntro,
            ),
            const SizedBox(height: NlSpace.xl),
            UploadStep(
              number: 1,
              title: _questionFile ? l10n.qfStepFile : l10n.bookStepFile,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  PdfPickBox(
                    pdf: pdf,
                    maxFileSizeMb: plan?.maxFileSizeMb,
                    onPick: _busy ? null : _pickPdf,
                  ),
                  if (duplicate != null && !_busy) ...[
                    const SizedBox(height: NlSpace.md),
                    _DuplicateNotice(book: duplicate),
                  ],
                ],
              ),
            ),
            UploadStep(
              number: 2,
              title: l10n.uploadStepKind,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: NlSpace.sm,
                    runSpacing: NlSpace.sm,
                    children: [
                      _Pill(
                        label: l10n.addBook,
                        selected: !_questionFile,
                        onTap: _busy
                            ? null
                            : () => setState(() => _questionFile = false),
                      ),
                      _Pill(
                        label: l10n.qfKind,
                        selected: _questionFile,
                        onTap: _busy
                            ? null
                            : () => setState(() => _questionFile = true),
                      ),
                    ],
                  ),
                  if (_questionFile) ...[
                    const SizedBox(height: NlSpace.sm),
                    Text(l10n.qfKindNote, style: NlText.caption),
                  ],
                ],
              ),
            ),
            if (!_questionFile)
              UploadStep(
                number: 3,
                title: l10n.bookStepProfile,
                child: _ProfilePicker(
                  value: _profile,
                  onChanged: _busy
                      ? null
                      : (p) => setState(() {
                          _profile = p;
                          _profileTouched = true;
                        }),
                ),
              ),
            UploadStep(
              number: _questionFile ? 3 : 4,
              title: l10n.mirrorStepFolder,
              last: true,
              child: FolderPickerField(
                value: _folderId,
                onChanged: _busy ? null : _folderChosen,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: NlSpace.md),
              AuthError(_error!),
            ],
            if (quota?.limit != null && !_busy) ...[
              const SizedBox(height: NlSpace.lg),
              Text(
                (_questionFile ? l10n.qfQuotaLeft : l10n.bookQuotaLeft)(
                  (quota!.limit! - quota.used).clamp(0, quota.limit!),
                  quota.limit!,
                ),
                style: NlText.caption,
              ),
            ],
          ],
        ),
        bottomNavigationBar: UploadSubmitBar(
          label: _questionFile ? l10n.qfSubmit : l10n.bookSubmit,
          icon: _questionFile
              ? LucideIcons.clipboardList
              : LucideIcons.bookOpen,
          startingLabel: l10n.bookStarting,
          note: l10n.bookKeepOpen,
          progress: _progress,
          busy: _busy,
          enabled: _canSubmit,
          onSubmit: _submit,
          onCancel: () => _cancel?.cancel(),
        ),
      ),
    );
  }
}

String _normalize(String fileName) =>
    bookDisplayTitle(fileName).trim().toLowerCase();

class _DuplicateNotice extends StatelessWidget {
  const _DuplicateNotice({required this.book});
  final BookSummary book;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.all(NlSpace.md),
      decoration: BoxDecoration(
        color: NlColors.markerSoft,
        borderRadius: BorderRadius.circular(NlRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(LucideIcons.copy, size: 17, color: NlColors.ink),
              const SizedBox(width: NlSpace.sm),
              Expanded(
                child: Text(l10n.bookDuplicateTitle, style: NlText.rowLabel),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            l10n.bookDuplicateBody(isolate(book.title)),
            style: NlText.secondary,
          ),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: NlButton(
              label: l10n.bookDuplicateOpen,
              kind: NlButtonKind.ghost,
              onPressed: () => context.pushReplacement(Routes.book(book.id)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfilePicker extends StatelessWidget {
  const _ProfilePicker({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: NlSpace.sm,
          runSpacing: NlSpace.sm,
          children: [
            for (final MapEntry(key: id, value: label) in bookProfiles.entries)
              _Pill(
                label: label,
                selected: value == id,
                onTap: onChanged == null ? null : () => onChanged!(id),
              ),
          ],
        ),
        const SizedBox(height: NlSpace.sm),
        Text(l10n.bookProfileHint, style: NlText.caption),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.selected, this.onTap});

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      child: Material(
        color: selected ? NlColors.ink : NlColors.sheet,
        shape: StadiumBorder(
          side: BorderSide(color: selected ? NlColors.ink : NlColors.rule),
        ),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: NlSpace.lg),
              child: Center(
                widthFactor: 1,
                child: Text(
                  label,
                  style: NlText.button.copyWith(
                    fontSize: 14,
                    color: selected ? Colors.white : NlColors.ink2,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
