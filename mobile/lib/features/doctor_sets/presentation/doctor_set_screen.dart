import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/ui/dates.dart';
import '../../../core/ui/secure_screen.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../question_files/domain/question_rules.dart';
import '../../question_files/presentation/question_deck_view.dart';
import '../data/doctor_set_models.dart';
import '../data/doctor_sets_repository.dart';
import 'doctor_screens.dart' show setMetaLine;
import 'doctor_widgets.dart';

/// Writes the fresh codes to a temporary CSV and opens the share sheet —
/// the web's "تنزيل CSV". The file is deleted once the sheet closes; the
/// codes are never kept by the app. Injectable for tests.
typedef CodesSharer = Future<void> Function(String csv, String fileName);

Future<void> shareCodesCsv(String csv, String fileName) async {
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}${Platform.pathSeparator}$fileName');
  await file.writeAsString(csv, flush: true);
  try {
    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path, mimeType: 'text/csv')]),
    );
  } finally {
    if (await file.exists()) await file.delete();
  }
}

final codesSharerProvider = Provider<CodesSharer>((ref) => shareCodesCsv);

enum _Tab { questions, settings, codes, students, audit }

/// One of the doctor's sets — the web's app/doctor/sets/[setId]: الأسئلة
/// (processing / failure + retry / preview as students see it / all
/// answers / image checks / needs-review with reasons / publish),
/// الإعدادات (edit, disable, enable, archive), الأكواد (generate, CSV once,
/// list, revoke), الطلاب (revoke access), السجل (audit). Polls the set every
/// 4 s while a draft is processing. Protected content: FLAG_SECURE, and the
/// preview's images are not cached.
class DoctorSetScreen extends ConsumerStatefulWidget {
  const DoctorSetScreen({
    super.key,
    required this.setId,
    this.poll = const Duration(seconds: 4),
  });

  final String setId;
  final Duration poll;

  @override
  ConsumerState<DoctorSetScreen> createState() => _DoctorSetScreenState();
}

class _DoctorSetScreenState extends ConsumerState<DoctorSetScreen> {
  DoctorSet? _set;
  SetPreview? _preview;
  Object? _error;
  Timer? _timer;
  _Tab _tab = _Tab.questions;

  DoctorSetsRepository get _repo => ref.read(doctorSetsRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    _timer?.cancel();
    try {
      final results = await Future.wait([
        _repo.set(widget.setId),
        _repo.preview(widget.setId),
      ]);
      if (!mounted) return;
      final set = results[0] as DoctorSet;
      setState(() {
        _set = set;
        _preview = results[1] as SetPreview;
        _error = null;
      });
      if (set.processing) {
        _timer = Timer(widget.poll, () {
          if (!mounted) return;
          if (ModalRoute.of(context)?.isCurrent ?? true) {
            _load();
          } else {
            _timer = Timer(widget.poll, _load);
          }
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _act(Future<void> Function() action, {String? done}) async {
    try {
      await action();
      await _load();
      if (mounted && done != null) showNlToast(context, done);
    } catch (error) {
      if (mounted) showNlToast(context, apiErrorText(context, error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final set = _set;
    return SecureScreen(
      child: Scaffold(
        appBar: AppBar(
          title: Text(set == null ? l10n.doctorDashboard : isolate(set.title)),
        ),
        body: set == null
            ? (_error != null
                  ? NlErrorView(error: _error!, onRetry: _load)
                  : const Padding(
                      padding: EdgeInsets.all(NlSpace.page),
                      child: NlListSkeleton(),
                    ))
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: NlSpace.page,
                    ),
                    child: Wrap(
                      spacing: NlSpace.sm,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        StatusChip(
                          label: setStatusLabel(set).label,
                          tone: setStatusLabel(set).tone,
                        ),
                        Text(
                          '${setMetaLine(l10n, set)} · ${set.settings.listed ? l10n.dsListedShort : l10n.dsUnlistedShort}',
                          style: NlText.caption,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: NlSpace.sm),
                  // Wraps rather than scrolling sideways: every section stays
                  // visible on narrow phones.
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: NlSpace.page,
                    ),
                    child: Wrap(
                      spacing: NlSpace.sm,
                      runSpacing: 4,
                      children: [
                        for (final t in _Tab.values)
                          ChoiceChip(
                            label: Text(_tabLabel(l10n, t)),
                            selected: _tab == t,
                            onSelected: (_) => setState(() => _tab = t),
                          ),
                      ],
                    ),
                  ),
                  const Divider(height: NlSpace.lg),
                  Expanded(
                    child: switch (_tab) {
                      _Tab.questions => _QuestionsTab(
                        set: set,
                        preview: _preview,
                        onPublish: () => _act(
                          () => _repo.publish(set.id),
                          done: l10n.dsPublished,
                        ),
                        onRetry: () =>
                            _act(() => _repo.retryProcessing(set.id)),
                      ),
                      _Tab.settings => _SettingsTab(
                        set: set,
                        onSave: (s) => _act(
                          () => _repo.update(set.id, s),
                          done: l10n.saved,
                        ),
                        onDisable: () => _act(() => _repo.disable(set.id)),
                        onEnable: () => _act(() => _repo.enable(set.id)),
                        onArchive: () => _act(() => _repo.archive(set.id)),
                      ),
                      _Tab.codes => _CodesTab(
                        setId: set.id,
                        published: set.status == SetStatus.published,
                      ),
                      _Tab.students => _StudentsTab(setId: set.id),
                      _Tab.audit => _AuditTab(setId: set.id),
                    },
                  ),
                ],
              ),
      ),
    );
  }
}

String _tabLabel(AppLocalizations l10n, _Tab t) => switch (t) {
  _Tab.questions => l10n.dsTabQuestions,
  _Tab.settings => l10n.dsTabSettings,
  _Tab.codes => l10n.dsTabCodes,
  _Tab.students => l10n.dsTabStudents,
  _Tab.audit => l10n.dsTabAudit,
};

class _QuestionsTab extends StatefulWidget {
  const _QuestionsTab({
    required this.set,
    required this.preview,
    required this.onPublish,
    required this.onRetry,
  });

  final DoctorSet set;
  final SetPreview? preview;
  final Future<void> Function() onPublish;
  final Future<void> Function() onRetry;

  @override
  State<_QuestionsTab> createState() => _QuestionsTabState();
}

class _QuestionsTabState extends State<_QuestionsTab> {
  bool _showAll = false;
  bool _busy = false;
  final _answers = <String, CardAnswer>{};

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    await action();
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final set = widget.set;
    final preview = widget.preview;
    final questions = preview?.questions ?? const [];
    final machine = questions.any((q) => q.translationSource == 'machine');

    final header = <Widget>[
      if (set.failed)
        DoctorPanel(
          color: NlColors.wrongSoft,
          children: [
            AutoDirText(
              (set.extractionError ?? '').isNotEmpty
                  ? set.extractionError!
                  : l10n.qfFailed,
              style: NlText.body.copyWith(color: NlColors.wrong),
            ),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: NlButton(
                label: l10n.qfRetry,
                kind: NlButtonKind.secondary,
                loading: _busy,
                onPressed: () => _run(widget.onRetry),
              ),
            ),
          ],
        ),
      if (set.processing)
        DoctorPanel(
          color: NlColors.markerSoft,
          children: [Text(l10n.dsProcessing, style: NlText.body)],
        ),
      if (set.status == SetStatus.draft && set.processingDone)
        DoctorPanel(
          children: [
            Text(l10n.dsReviewFirst, style: NlText.rowLabel),
            Text(l10n.dsNoEditAfterPublish, style: NlText.secondary),
            NlButton(
              label: l10n.dsPublish,
              kind: NlButtonKind.marker,
              loading: _busy,
              onPressed: () => _run(widget.onPublish),
            ),
          ],
        ),
      if (questions.isNotEmpty)
        Wrap(
          spacing: NlSpace.sm,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            NlButton(
              label: _showAll ? l10n.dsHideAnswers : l10n.dsShowAllAnswers,
              kind: NlButtonKind.secondary,
              onPressed: () => setState(() => _showAll = !_showAll),
            ),
            if (machine) Text(l10n.dsMachineNote, style: NlText.caption),
          ],
        ),
    ];

    final checks = <Widget>[
      if (preview != null && preview.checkImage.isNotEmpty) ...[
        const SizedBox(height: NlSpace.lg),
        Text(l10n.dsImageChecks, style: NlText.title),
        Text(l10n.dsImageChecksNote, style: NlText.secondary),
        for (final (i, q) in questions.indexed)
          if (preview.checkImage.contains(q.id))
            DoctorRow(
              title: l10n.dsQuestionOnPage(i + 1, q.sourcePage),
              meta: q.questionText.length > 140
                  ? q.questionText.substring(0, 140)
                  : q.questionText,
            ),
      ],
      if (preview != null && preview.needsReview.isNotEmpty) ...[
        const SizedBox(height: NlSpace.lg),
        Text(
          l10n.dsNeedsReview(preview.needsReview.length),
          style: NlText.title,
        ),
        Text(l10n.dsNeedsReviewNote, style: NlText.secondary),
        for (final item in preview.needsReview)
          DoctorPanel(
            children: [
              Text(l10n.quizPage(item.sourcePage), style: NlText.rowLabel),
              AutoDirText(
                item.questionText.isEmpty ? l10n.dsNoStem : item.questionText,
                style: NlText.body,
              ),
              for (final (i, o) in (item.options ?? const <String>[]).indexed)
                AutoDirText('${i + 1}. $o', style: NlText.secondary),
              Text(
                item.reasons
                    .map((r) => '${reviewReasonLabels[r] ?? r} ($r)')
                    .join(' · '),
                style: NlText.caption.copyWith(color: NlColors.wrong),
              ),
            ],
          ),
      ],
    ];

    // The all-answers review is a stacked list; otherwise one card at a
    // time, like a student.
    if (questions.isEmpty || _showAll) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(
          NlSpace.page,
          0,
          NlSpace.page,
          NlSpace.xxxl,
        ),
        children: [
          ...header,
          if (preview == null)
            const NlListSkeleton()
          else if (questions.isEmpty)
            DoctorPanel(
              children: [Text(l10n.dsNoQuestionsYet, style: NlText.rowLabel)],
            ),
          for (final (i, q) in questions.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: NlSpace.md),
              child: QuestionCard(
                question: q,
                position: i + 1,
                total: questions.length,
                answer: CardAnswer.empty,
                onAnswer: (_) {},
                revealAll: true,
                imagesCached: false,
              ),
            ),
          ...checks,
        ],
      );
    }
    return ListView(
      padding: const EdgeInsets.only(bottom: NlSpace.xxxl),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: NlSpace.page),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: header,
          ),
        ),
        // One card at a time, like a student — in a box of its own height
        // (the deck pages horizontally, the tab scrolls vertically).
        SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.72,
          child: QuestionDeckView(
            questions: questions,
            answers: _answers,
            imagesCached: false,
            onAnswer: (id, a) => setState(() => _answers[id] = a),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: NlSpace.page),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: checks,
          ),
        ),
      ],
    );
  }
}

class _SettingsTab extends StatefulWidget {
  const _SettingsTab({
    required this.set,
    required this.onSave,
    required this.onDisable,
    required this.onEnable,
    required this.onArchive,
  });

  final DoctorSet set;
  final Future<void> Function(SetSettings) onSave;
  final Future<void> Function() onDisable;
  final Future<void> Function() onEnable;
  final Future<void> Function() onArchive;

  @override
  State<_SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<_SettingsTab> {
  late SetSettings _value = widget.set.settings;
  bool _busy = false;

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    await action();
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final set = widget.set;
    final archived = set.status == SetStatus.archived;
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        NlSpace.page,
        0,
        NlSpace.page,
        NlSpace.xxxl,
      ),
      children: [
        SetSettingsForm(
          value: _value,
          enabled: !archived && !_busy,
          onChanged: (v) => setState(() => _value = v),
        ),
        const SizedBox(height: NlSpace.md),
        NlButton(
          label: l10n.actionSave,
          loading: _busy,
          expand: true,
          onPressed: archived || _value.title.trim().isEmpty
              ? null
              : () => _run(() => widget.onSave(_value)),
        ),
        const SizedBox(height: NlSpace.xl),
        DoctorPanel(
          children: [
            Text(l10n.dsAccess, style: NlText.rowLabel),
            Text(l10n.dsAccessNote, style: NlText.secondary),
            if (set.status == SetStatus.published)
              NlButton(
                label: l10n.dsDisableNow,
                kind: NlButtonKind.secondary,
                onPressed: _busy ? null : () => _run(widget.onDisable),
              ),
            if (set.status == SetStatus.disabled)
              NlButton(
                label: l10n.dsEnable,
                onPressed: _busy ? null : () => _run(widget.onEnable),
              ),
            if (!archived)
              NlButton(
                label: l10n.dsArchive,
                kind: NlButtonKind.destructive,
                onPressed: _busy
                    ? null
                    : () async {
                        final ok = await showNlConfirm(
                          context,
                          title: l10n.dsArchive,
                          message: l10n.dsArchiveConfirm,
                          confirmLabel: l10n.dsArchiveFinal,
                          destructive: true,
                        );
                        if (ok) await _run(widget.onArchive);
                      },
              ),
          ],
        ),
      ],
    );
  }
}

const _quickCounts = [10, 50, 100, 200, 500];

class _CodesTab extends ConsumerStatefulWidget {
  const _CodesTab({required this.setId, required this.published});

  final String setId;
  final bool published;

  @override
  ConsumerState<_CodesTab> createState() => _CodesTabState();
}

class _CodesTabState extends ConsumerState<_CodesTab> {
  int _count = 50;
  CodeStatus? _status;
  final _search = TextEditingController();
  Timer? _debounce;
  List<AccessCode>? _codes;
  Object? _error;
  bool _busy = false;

  /// Shown once, kept only in this widget's memory.
  ({String batchId, List<String> codes})? _fresh;
  bool _copied = false;

  DoctorSetsRepository get _repo => ref.read(doctorSetsRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final codes = await _repo.codes(
        widget.setId,
        status: _status,
        search: _search.text,
      );
      if (mounted) {
        setState(() {
          _codes = codes;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _generate() async {
    setState(() => _busy = true);
    try {
      final result = await _repo.generateCodes(widget.setId, _count);
      if (!mounted) return;
      setState(() {
        _fresh = result;
        _copied = false;
      });
      await _load();
    } catch (error) {
      if (mounted) showNlToast(context, apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final fresh = _fresh;
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        NlSpace.page,
        0,
        NlSpace.page,
        NlSpace.xxxl,
      ),
      children: [
        if (!widget.published)
          DoctorPanel(
            children: [Text(l10n.dsCodesAfterPublish, style: NlText.rowLabel)],
          )
        else
          DoctorPanel(
            children: [
              Text(l10n.dsCodeCount, style: NlText.label),
              Row(
                children: [
                  IconButton(
                    tooltip: '−',
                    icon: const Icon(LucideIcons.minus),
                    onPressed: _count > 1
                        ? () => setState(() => _count--)
                        : null,
                  ),
                  Text(isolateLtr('$_count'), style: NlText.title),
                  IconButton(
                    tooltip: '+',
                    icon: const Icon(LucideIcons.plus),
                    onPressed: _count < 500
                        ? () => setState(() => _count++)
                        : null,
                  ),
                ],
              ),
              Wrap(
                spacing: NlSpace.sm,
                children: [
                  for (final n in _quickCounts)
                    ChoiceChip(
                      label: Text('$n'),
                      selected: _count == n,
                      onSelected: (_) => setState(() => _count = n),
                    ),
                ],
              ),
              NlButton(
                label: l10n.dsGenerate(_count),
                kind: NlButtonKind.marker,
                loading: _busy,
                onPressed: _generate,
              ),
            ],
          ),
        if (fresh != null)
          DoctorPanel(
            color: NlColors.markerSoft,
            children: [
              Text(
                l10n.dsFreshCodes(fresh.codes.length),
                style: NlText.rowLabel,
              ),
              Text(l10n.dsFreshCodesNote, style: NlText.secondary),
              Wrap(
                spacing: NlSpace.sm,
                runSpacing: NlSpace.sm,
                children: [
                  NlButton(
                    label: l10n.dsShareCsv,
                    icon: LucideIcons.share2,
                    onPressed: () => ref.read(codesSharerProvider)(
                      codesCsv(fresh.codes),
                      'nirolearn-codes-${fresh.batchId.substring(0, fresh.batchId.length < 8 ? fresh.batchId.length : 8)}.csv',
                    ),
                  ),
                  NlButton(
                    label: _copied ? l10n.niroCopied : l10n.dsCopyAll,
                    kind: NlButtonKind.secondary,
                    icon: LucideIcons.copy,
                    onPressed: () async {
                      await Clipboard.setData(
                        ClipboardData(text: fresh.codes.join('\n')),
                      );
                      if (mounted) setState(() => _copied = true);
                    },
                  ),
                  NlButton(
                    label: l10n.dsHideCodes,
                    kind: NlButtonKind.ghost,
                    onPressed: () => setState(() => _fresh = null),
                  ),
                ],
              ),
              for (final code in fresh.codes)
                SelectableText(
                  code,
                  textDirection: TextDirection.ltr,
                  style: NlText.body.copyWith(fontFamily: 'monospace'),
                ),
            ],
          ),
        Wrap(
          spacing: NlSpace.sm,
          children: [
            for (final s in [null, ...CodeStatus.values])
              ChoiceChip(
                label: Text(_statusLabel(l10n, s)),
                selected: _status == s,
                onSelected: (_) {
                  setState(() => _status = s);
                  _load();
                },
              ),
          ],
        ),
        const SizedBox(height: NlSpace.sm),
        TextField(
          controller: _search,
          maxLength: 40,
          onChanged: (_) {
            _debounce?.cancel();
            _debounce = Timer(const Duration(milliseconds: 300), _load);
          },
          decoration: InputDecoration(
            hintText: l10n.dsCodeSearch,
            prefixIcon: const Icon(LucideIcons.search, size: 18),
            counterText: '',
          ),
        ),
        if (_error != null)
          NlErrorView(error: _error!, inline: true, onRetry: _load)
        else if (_codes == null)
          const NlListSkeleton()
        else if (_codes!.isEmpty)
          Padding(
            padding: const EdgeInsets.all(NlSpace.lg),
            child: Text(l10n.dsNoCodes, style: NlText.secondary),
          )
        else
          for (final code in _codes!)
            DoctorRow(
              ltrTitle: true,
              title: 'NL-····-····-${code.hint}',
              meta: switch (code.status) {
                CodeStatus.claimed => l10n.dsCodeClaimed(
                  code.studentUsername != null
                      ? isolateLtr('@${code.studentUsername}')
                      : (code.studentName ?? l10n.dsStudent),
                  formatDateTime(context, code.claimedAt),
                ),
                CodeStatus.revoked => l10n.dsCodeRevoked(
                  formatDateTime(context, code.revokedAt),
                ),
                CodeStatus.unused => l10n.dsCodeUnused(
                  formatDateTime(context, code.createdAt),
                ),
              },
              trailing: code.status == CodeStatus.unused
                  ? NlButton(
                      label: l10n.dsRevoke,
                      kind: NlButtonKind.secondary,
                      onPressed: () async {
                        try {
                          await _repo.revokeCode(code.id);
                          await _load();
                        } catch (error) {
                          if (context.mounted) {
                            showNlToast(context, apiErrorText(context, error));
                          }
                        }
                      },
                    )
                  : null,
            ),
      ],
    );
  }
}

String _statusLabel(AppLocalizations l10n, CodeStatus? s) => switch (s) {
  null => l10n.dsAll,
  CodeStatus.unused => l10n.dsUnused,
  CodeStatus.claimed => l10n.dsClaimed,
  CodeStatus.revoked => l10n.dsRevokedLabel,
};

class _StudentsTab extends ConsumerStatefulWidget {
  const _StudentsTab({required this.setId});
  final String setId;

  @override
  ConsumerState<_StudentsTab> createState() => _StudentsTabState();
}

class _StudentsTabState extends ConsumerState<_StudentsTab> {
  List<SetStudent>? _students;
  Object? _error;

  DoctorSetsRepository get _repo => ref.read(doctorSetsRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await _repo.students(widget.setId);
      if (mounted) setState(() => _students = list);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final list = _students;
    if (_error != null && list == null) {
      return NlErrorView(error: _error!, onRetry: _load);
    }
    if (list == null) {
      return const Padding(
        padding: EdgeInsets.all(NlSpace.page),
        child: NlListSkeleton(),
      );
    }
    if (list.isEmpty) {
      return NlEmptyState(title: l10n.dsNoStudents);
    }
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: NlSpace.page),
      children: [
        for (final s in list)
          DoctorRow(
            title:
                '${s.name ?? l10n.dsStudent}${s.username == null ? '' : ' · ${isolateLtr('@${s.username}')}'}',
            meta: [
              s.active ? l10n.dsActive : l10n.dsWithdrawn,
              formatDateTime(context, s.grantedAt),
              if (s.codeHint != null) isolateLtr('···${s.codeHint}'),
            ].join(' · '),
            trailing: s.active
                ? NlButton(
                    label: l10n.dsWithdraw,
                    kind: NlButtonKind.secondary,
                    onPressed: () async {
                      final ok = await showNlConfirm(
                        context,
                        title: l10n.dsWithdraw,
                        message: l10n.dsWithdrawConfirm,
                        confirmLabel: l10n.dsWithdrawYes,
                        destructive: true,
                      );
                      if (!ok) return;
                      try {
                        await _repo.revokeStudent(s.entitlementId);
                        await _load();
                      } catch (error) {
                        if (context.mounted) {
                          showNlToast(context, apiErrorText(context, error));
                        }
                      }
                    },
                  )
                : null,
          ),
      ],
    );
  }
}

class _AuditTab extends ConsumerWidget {
  const _AuditTab({required this.setId});
  final String setId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<List<AuditEvent>>(
      future: ref.read(doctorSetsRepositoryProvider).audit(setId),
      builder: (context, snapshot) {
        if (snapshot.hasError) return NlErrorView(error: snapshot.error!);
        final events = snapshot.data;
        if (events == null) {
          return const Padding(
            padding: EdgeInsets.all(NlSpace.page),
            child: NlListSkeleton(),
          );
        }
        return ListView(
          padding: const EdgeInsets.symmetric(horizontal: NlSpace.page),
          children: [
            for (final e in events)
              DoctorRow(
                title: auditLabel(e),
                meta:
                    '${e.actorUsername != null ? isolateLtr('@${e.actorUsername}') : (e.actorName ?? '—')} · ${formatDateTime(context, e.createdAt)}',
              ),
          ],
        );
      },
    );
  }
}
