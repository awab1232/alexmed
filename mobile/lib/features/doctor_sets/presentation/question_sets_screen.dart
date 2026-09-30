import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/providers.dart';
import '../../../app/routes.dart';
import '../../../core/ui/dates.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/auth_widgets.dart';
import '../data/doctor_set_models.dart';
import '../data/doctor_sets_repository.dart';
import 'doctor_widgets.dart';

final mySetsProvider = FutureProvider<List<StudentSet>>((ref) {
  ref.watch(sessionControllerProvider.select((s) => s.status));
  return ref.watch(doctorSetsRepositoryProvider).mine();
});

final setCatalogProvider = FutureProvider<List<StudentSet>>((ref) {
  ref.watch(sessionControllerProvider.select((s) => s.status));
  return ref.watch(doctorSetsRepositoryProvider).catalog();
});

/// مجموعات الدكاترة — the web's app/question-sets: add an access code from
/// your doctor (rate-limited on the server), your sets with whether they
/// open now, and listed sets (titles only — opening needs a code).
class QuestionSetsScreen extends ConsumerStatefulWidget {
  const QuestionSetsScreen({super.key, this.focusCode = false});

  /// Opened from ＋ «كود من دكتورك».
  final bool focusCode;

  @override
  ConsumerState<QuestionSetsScreen> createState() => _QuestionSetsScreenState();
}

class _QuestionSetsScreenState extends ConsumerState<QuestionSetsScreen> {
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _code.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _redeem() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(doctorSetsRepositoryProvider)
          .redeem(_code.text);
      ref
        ..invalidate(mySetsProvider)
        ..invalidate(setCatalogProvider);
      if (!mounted) return;
      if (result.already) showNlToast(context, l10n.dsAlreadyAdded);
      _code.clear();
      await context.push(Routes.questionSet(result.setId));
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final mine = ref.watch(mySetsProvider);
    final catalog = ref.watch(setCatalogProvider);
    final listed = (catalog.value ?? const <StudentSet>[])
        .where((s) => !s.inMyAccount)
        .toList();

    return Scaffold(
      appBar: AppBar(title: Text(l10n.doctorSetsTitle)),
      body: RefreshIndicator(
        color: NlColors.ink,
        onRefresh: () async {
          ref
            ..invalidate(mySetsProvider)
            ..invalidate(setCatalogProvider);
          try {
            await ref.read(mySetsProvider.future);
          } catch (_) {}
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            NlSpace.page,
            0,
            NlSpace.page,
            NlSpace.xxxl,
          ),
          children: [
            Text(l10n.dsIntro, style: NlText.secondary),
            const SizedBox(height: NlSpace.lg),
            DoctorPanel(
              children: [
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: TextField(
                    controller: _code,
                    autofocus: widget.focusCode,
                    maxLength: 40,
                    autocorrect: false,
                    enableSuggestions: false,
                    textCapitalization: TextCapitalization.characters,
                    style: NlText.rowLabel.copyWith(
                      fontFamily: 'monospace',
                      letterSpacing: 1,
                    ),
                    onSubmitted: (_) {
                      if (_code.text.trim().length >= 12 && !_busy) _redeem();
                    },
                    decoration: InputDecoration(
                      labelText: l10n.dsCodeLabel,
                      hintText: 'NL-XXXX-XXXX-XXXX',
                      counterText: '',
                    ),
                  ),
                ),
                if (_error != null) AuthError(_error!),
                NlButton(
                  label: _busy ? l10n.dsChecking : l10n.dsAddSet,
                  kind: NlButtonKind.marker,
                  icon: LucideIcons.keyRound,
                  loading: _busy,
                  expand: true,
                  onPressed: _code.text.trim().length >= 12 ? _redeem : null,
                ),
              ],
            ),
            Text(l10n.dsMine, style: NlText.title),
            const SizedBox(height: NlSpace.sm),
            mine.when(
              loading: () => const NlListSkeleton(),
              error: (e, _) => NlErrorView(
                error: e,
                inline: true,
                onRetry: () => ref.invalidate(mySetsProvider),
              ),
              data: (sets) => sets.isEmpty
                  ? DoctorPanel(
                      children: [
                        Text(l10n.dsMineEmpty, style: NlText.rowLabel),
                        Text(l10n.dsMineEmptyHint, style: NlText.secondary),
                      ],
                    )
                  : Column(
                      children: [for (final set in sets) _MySetRow(set: set)],
                    ),
            ),
            if (listed.isNotEmpty) ...[
              const SizedBox(height: NlSpace.xl),
              Text(l10n.dsListedTitle, style: NlText.title),
              const SizedBox(height: 4),
              Text(l10n.dsListedNote, style: NlText.secondary),
              for (final set in listed)
                DoctorRow(
                  leading: LucideIcons.lock,
                  title: set.title,
                  meta: [
                    set.doctorName,
                    set.subjectLabel,
                    set.academicYear,
                    l10n.qfCount(set.questionCount),
                  ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                  trailing: Text(l10n.dsByCode, style: NlText.caption),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MySetRow extends StatelessWidget {
  const _MySetRow({required this.set});
  final StudentSet set;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final chip = switch (set.availability) {
      SetAvailability.available => StatusChip(
        label: l10n.dsAvailable,
        tone: StatusTone.live,
      ),
      SetAvailability.notStarted => StatusChip(
        label: l10n.dsOpensAt(formatDateTime(context, set.startsAt)),
        tone: StatusTone.warn,
      ),
      SetAvailability.unavailable => StatusChip(
        label: l10n.dsUnavailable,
        tone: StatusTone.muted,
      ),
    };
    return DoctorRow(
      leading: LucideIcons.lock,
      title: set.title,
      meta: [
        set.doctorName,
        set.subjectLabel,
        l10n.qfCount(set.questionCount),
        if (set.endsAt != null)
          l10n.dsUntil(formatDateTime(context, set.endsAt)),
      ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
      trailing: chip,
      onTap: set.availability == SetAvailability.available
          ? () => context.push(Routes.questionSet(set.id))
          : null,
    );
  }
}
