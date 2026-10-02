import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/providers.dart';
import '../../../app/routes.dart';
import '../../../core/api/api_error.dart';
import '../../../core/ui/dates.dart';
import '../../../core/ui/ui.dart';
import '../../../core/upload/pdf_upload.dart';
import '../../../l10n/app_localizations.dart';
import '../../account/data/account_repository.dart';
import '../../auth/presentation/auth_widgets.dart';
import '../../upload/upload_widgets.dart';
import '../data/doctor_set_models.dart';
import '../data/doctor_sets_repository.dart';
import 'doctor_widgets.dart';

final doctorApplicationProvider = FutureProvider<DoctorApplicationState>((ref) {
  ref.watch(sessionControllerProvider.select((s) => s.status));
  return ref.watch(doctorSetsRepositoryProvider).status();
});

/// «حساب دكتور» — the web's app/account/doctor: apply, or see the
/// application's state (pending / approved / suspended / rejected with the
/// reason). Same account, same login. An admin approves on the web.
class DoctorApplyScreen extends ConsumerStatefulWidget {
  const DoctorApplyScreen({super.key});

  @override
  ConsumerState<DoctorApplyScreen> createState() => _DoctorApplyScreenState();
}

class _DoctorApplyScreenState extends ConsumerState<DoctorApplyScreen> {
  final _fullName = TextEditingController();
  final _university = TextEditingController();
  final _faculty = TextEditingController();
  final _department = TextEditingController();
  final _email = TextEditingController();
  final _note = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [
      _fullName,
      _university,
      _faculty,
      _department,
      _email,
      _note,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _valid =>
      _fullName.text.trim().length >= 2 &&
      _university.text.trim().length >= 2 &&
      _faculty.text.trim().length >= 2 &&
      _department.text.trim().length >= 2;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(doctorSetsRepositoryProvider)
          .apply(
            fullName: _fullName.text,
            university: _university.text,
            faculty: _faculty.text,
            department: _department.text,
            universityEmail: _email.text,
            note: _note.text,
          );
      ref
        ..invalidate(doctorApplicationProvider)
        ..invalidate(doctorStatusProvider);
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final enabled = ref.watch(doctorSetsEnabledProvider);
    final state = ref.watch(doctorApplicationProvider);

    Widget body() {
      if (enabled.value == false) {
        return NlEmptyState(title: l10n.dsFeatureOff);
      }
      return state.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(NlSpace.page),
          child: NlListSkeleton(),
        ),
        error: (e, _) => NlErrorView(
          error: e,
          onRetry: () => ref.invalidate(doctorApplicationProvider),
        ),
        data: (s) {
          final p = s.profile;
          final showForm = p == null || p.status == 'rejected';
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              NlSpace.page,
              0,
              NlSpace.page,
              NlSpace.xxxl,
            ),
            children: [
              Text(l10n.dsApplyIntro, style: NlText.secondary),
              const SizedBox(height: NlSpace.lg),
              if (p?.status == 'pending')
                DoctorPanel(
                  children: [
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: StatusChip(
                        label: l10n.dsPending,
                        tone: StatusTone.warn,
                      ),
                    ),
                    Text(l10n.dsPendingBody, style: NlText.rowLabel),
                    Text(
                      [
                        p!.fullName,
                        p.university,
                        p.faculty,
                      ].whereType<String>().join(' · '),
                      style: NlText.secondary,
                    ),
                  ],
                ),
              if (p?.status == 'approved' && s.approved)
                DoctorPanel(
                  children: [
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: StatusChip(
                        label: l10n.dsApproved,
                        tone: StatusTone.live,
                      ),
                    ),
                    Text(l10n.dsApprovedBody, style: NlText.rowLabel),
                    NlButton(
                      label: l10n.dsOpenDashboard,
                      kind: NlButtonKind.marker,
                      onPressed: () => context.push(Routes.doctor),
                    ),
                  ],
                ),
              if (p?.status == 'suspended')
                DoctorPanel(
                  children: [
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: StatusChip(
                        label: l10n.dsSuspended,
                        tone: StatusTone.stop,
                      ),
                    ),
                    Text(l10n.dsSuspendedBody, style: NlText.rowLabel),
                    Text(l10n.dsSuspendedHint, style: NlText.secondary),
                  ],
                ),
              if (p?.status == 'rejected')
                DoctorPanel(
                  children: [
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: StatusChip(
                        label: l10n.dsRejected,
                        tone: StatusTone.stop,
                      ),
                    ),
                    Text(l10n.dsRejectedBody, style: NlText.rowLabel),
                    if ((p!.rejectionReason ?? '').isNotEmpty)
                      Text(
                        l10n.dsRejectedReason(p.rejectionReason!),
                        style: NlText.secondary,
                      ),
                    Text(l10n.dsRejectedHint, style: NlText.secondary),
                  ],
                ),
              if (showForm) ..._form(l10n),
            ],
          );
        },
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(l10n.dsApplyTitle)),
      body: body(),
    );
  }

  List<Widget> _form(AppLocalizations l10n) {
    Widget field(
      TextEditingController c,
      String label, {
      int max = 160,
      bool ltr = false,
      int lines = 1,
    }) => Padding(
      padding: const EdgeInsets.only(bottom: NlSpace.md),
      child: TextField(
        controller: c,
        enabled: !_busy,
        maxLength: max,
        minLines: lines,
        maxLines: lines == 1 ? 1 : 5,
        keyboardType: ltr ? TextInputType.emailAddress : null,
        textDirection: ltr ? TextDirection.ltr : null,
        onChanged: (_) => setState(() {}),
        decoration: InputDecoration(labelText: label, counterText: ''),
      ),
    );
    return [
      field(_fullName, l10n.dsFullName, max: 120),
      field(_university, l10n.dsUniversity),
      field(_faculty, l10n.dsFaculty),
      field(_department, l10n.dsDepartment),
      field(_email, l10n.dsUniEmail, max: 320, ltr: true),
      field(_note, l10n.dsNote, max: 1000, lines: 3),
      if (_error != null) ...[AuthError(_error!), const SizedBox(height: 8)],
      NlButton(
        label: l10n.dsSendApplication,
        kind: NlButtonKind.marker,
        loading: _busy,
        expand: true,
        onPressed: _valid ? _submit : null,
      ),
    ];
  }
}

/// لوحة الدكتور — the web's app/doctor: the numbers, the doctor's sets
/// (polled every 4 s while one is still processing, like the web), recent
/// activity. Only reachable for an approved doctor; the server refuses
/// every doctor.* call otherwise.
class DoctorDashboardScreen extends ConsumerStatefulWidget {
  const DoctorDashboardScreen({
    super.key,
    this.poll = const Duration(seconds: 4),
  });

  final Duration poll;

  @override
  ConsumerState<DoctorDashboardScreen> createState() =>
      _DoctorDashboardScreenState();
}

class _DoctorDashboardScreenState extends ConsumerState<DoctorDashboardScreen> {
  DoctorStats? _stats;
  List<DoctorSet>? _sets;
  Object? _error;
  Timer? _timer;

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
      final results = await Future.wait([_repo.stats(), _repo.sets()]);
      if (!mounted) return;
      setState(() {
        _stats = results[0] as DoctorStats;
        _sets = results[1] as List<DoctorSet>;
        _error = null;
      });
      if (_sets!.any((s) => s.processing)) {
        _timer = Timer(widget.poll, () {
          if (mounted && (ModalRoute.of(context)?.isCurrent ?? true)) {
            _load();
          } else if (mounted) {
            _timer = Timer(widget.poll, _load);
          }
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final stats = _stats;
    final sets = _sets;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.doctorDashboard)),
      body: sets == null
          ? (_error != null
                ? NlErrorView(error: _error!, onRetry: _load)
                : const Padding(
                    padding: EdgeInsets.all(NlSpace.page),
                    child: NlListSkeleton(),
                  ))
          : RefreshIndicator(
              color: NlColors.ink,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  NlSpace.page,
                  0,
                  NlSpace.page,
                  NlSpace.xxxl,
                ),
                children: [
                  Text(l10n.dsDashboardIntro, style: NlText.secondary),
                  const SizedBox(height: NlSpace.lg),
                  Wrap(
                    spacing: NlSpace.sm,
                    runSpacing: NlSpace.sm,
                    children: [
                      _Stat(l10n.dsStatSets, stats?.totalSets),
                      _Stat(l10n.dsStatPublished, stats?.published),
                      _Stat(l10n.dsStatDisabled, stats?.disabled),
                      _Stat(l10n.dsStatCodes, stats?.codesTotal),
                      _Stat(l10n.dsStatStudents, stats?.activeStudents),
                    ],
                  ),
                  const SizedBox(height: NlSpace.xl),
                  Row(
                    children: [
                      Expanded(child: Text(l10n.dsMine, style: NlText.title)),
                      NlButton(
                        label: l10n.dsNewSet,
                        kind: NlButtonKind.marker,
                        icon: LucideIcons.plus,
                        onPressed: () async {
                          await context.push(Routes.doctorNewSet);
                          if (mounted) unawaited(_load());
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: NlSpace.sm),
                  if (sets.isEmpty)
                    DoctorPanel(
                      children: [
                        Text(l10n.dsMineEmpty, style: NlText.rowLabel),
                        Text(l10n.dsDoctorEmptyHint, style: NlText.secondary),
                      ],
                    )
                  else
                    for (final set in sets)
                      DoctorRow(
                        leading: LucideIcons.lock,
                        title: set.title,
                        meta: setMetaLine(l10n, set),
                        trailing: _chip(set),
                        onTap: () async {
                          await context.push(Routes.doctorSet(set.id));
                          if (mounted) unawaited(_load());
                        },
                      ),
                  if (stats != null && stats.recent.isNotEmpty) ...[
                    const SizedBox(height: NlSpace.xl),
                    Text(l10n.dsRecent, style: NlText.title),
                    for (final e in stats.recent)
                      DoctorRow(
                        title: auditLabel(e),
                        meta:
                            '${e.setTitle ?? ''} · ${formatDateTime(context, e.createdAt)}',
                      ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _chip(DoctorSet set) {
    final s = setStatusLabel(set);
    return StatusChip(label: s.label, tone: s.tone);
  }
}

String setMetaLine(AppLocalizations l10n, DoctorSet set) =>
    '${set.status == SetStatus.draft ? l10n.qfExtractedCount(set.extractedQuestions) : l10n.qfCount(set.questionCount)}'
    ' · ${l10n.dsStudentsCount(set.activeStudents)}'
    ' · ${l10n.dsCodesUsed(set.codesClaimed, set.codesTotal)}';

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);
  final String label;
  final int? value;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 96),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: NlText.caption),
          Text('${value ?? '—'}', style: NlText.title),
        ],
      ),
    );
  }
}

/// مجموعة أسئلة جديدة — the web's app/doctor/sets/new: settings + the PDF,
/// uploaded like every question file, then doctor.sets.create starts the
/// same pipeline. Counts against the plan's question files.
class DoctorNewSetScreen extends ConsumerStatefulWidget {
  const DoctorNewSetScreen({super.key});

  @override
  ConsumerState<DoctorNewSetScreen> createState() => _DoctorNewSetScreenState();
}

class _DoctorNewSetScreenState extends ConsumerState<DoctorNewSetScreen> {
  SetSettings _settings = const SetSettings();
  PickedPdf? _pdf;
  double? _progress;
  bool _busy = false;
  CancelToken? _cancel;
  String? _error;

  @override
  void dispose() {
    _cancel?.cancel();
    super.dispose();
  }

  Future<void> _pick() async {
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

  bool get _canSubmit =>
      !_busy && _pdf != null && _settings.title.trim().isNotEmpty;

  Future<void> _submit() async {
    final cancel = CancelToken();
    setState(() {
      _busy = true;
      _error = null;
      _progress = 0;
      _cancel = cancel;
    });
    try {
      final setId = await ref
          .read(doctorSetsRepositoryProvider)
          .create(
            pdf: _pdf!,
            settings: _settings,
            cancelToken: cancel,
            onProgress: (p) {
              if (mounted) setState(() => _progress = p);
            },
          );
      ref.invalidate(planProvider);
      if (mounted) context.pushReplacement(Routes.doctorSet(setId));
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
    final plan = ref.watch(planProvider).value;
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
        appBar: AppBar(title: Text(l10n.dsNewSetTitle)),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(
            NlSpace.page,
            0,
            NlSpace.page,
            NlSpace.xxxl,
          ),
          children: [
            Text(l10n.dsNewSetIntro, style: NlText.secondary),
            const SizedBox(height: NlSpace.lg),
            SetSettingsForm(
              value: _settings,
              enabled: !_busy,
              onChanged: (v) => setState(() => _settings = v),
            ),
            const SizedBox(height: NlSpace.lg),
            Text(l10n.dsFileLabel, style: NlText.label),
            const SizedBox(height: NlSpace.sm),
            PdfPickBox(
              pdf: _pdf,
              maxFileSizeMb: plan?.maxFileSizeMb,
              onPick: _busy ? null : _pick,
            ),
            const SizedBox(height: NlSpace.sm),
            Text(l10n.dsFileHint, style: NlText.caption),
            if (_error != null) ...[
              const SizedBox(height: NlSpace.md),
              AuthError(_error!),
            ],
          ],
        ),
        bottomNavigationBar: UploadSubmitBar(
          label: l10n.dsCreateSet,
          icon: LucideIcons.fileUp,
          startingLabel: l10n.dsStarting,
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
