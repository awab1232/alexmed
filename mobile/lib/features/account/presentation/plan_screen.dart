import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../library/presentation/library_widgets.dart' show shortDate;
import '../data/account_repository.dart';

/// Plan and today's usage — read-only. No upgrade button: payments are out
/// of scope for this phase (blueprint §3.6) and the App Store forbids
/// pointing to outside payment (3.1.1).
class PlanScreen extends ConsumerWidget {
  const PlanScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final plan = ref.watch(planProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.planRow)),
      body: plan.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(NlSpace.page),
          child: NlListSkeleton(rows: 3),
        ),
        error: (error, _) => NlErrorView(
          error: error,
          onRetry: () => ref.invalidate(planProvider),
        ),
        data: (plan) {
          final locale = Localizations.localeOf(context);
          return ListView(
            padding: const EdgeInsets.all(NlSpace.page),
            children: [
              Row(
                children: [
                  Expanded(child: Text(l10n.planTitle, style: NlText.title)),
                  NlBadge(plan.planName, marked: true),
                ],
              ),
              const SizedBox(height: NlSpace.xs),
              Text(
                !plan.subscribed
                    ? l10n.planFree
                    : plan.endsAt != null
                    ? l10n.planActiveUntil(shortDate(plan.endsAt!, locale))
                    : l10n.planActive,
                style: NlText.secondary,
              ),
              const SizedBox(height: NlSpace.xl),
              NlGroup(
                title: l10n.usageToday,
                children: [
                  _MeterRow(label: l10n.usageAssistant, meter: plan.assistant),
                  _MeterRow(
                    label: l10n.usageQuestionFiles,
                    meter: plan.questionFiles,
                  ),
                  _MeterRow(
                    label: l10n.usageStudyFiles,
                    meter: plan.studyFiles,
                  ),
                ],
              ),
              const SizedBox(height: NlSpace.md),
              Text(l10n.usageResets, style: NlText.caption),
              if (plan.maxFileSizeMb != null) ...[
                const SizedBox(height: NlSpace.xs),
                Text(
                  l10n.maxFileSize(plan.maxFileSizeMb!),
                  style: NlText.caption,
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _MeterRow extends StatelessWidget {
  const _MeterRow({required this.label, required this.meter});

  final String label;
  final UsageMeter meter;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final fraction = meter.fraction;
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: NlSpace.lg,
        vertical: NlSpace.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(label, style: NlText.rowLabel)),
              Text(
                meter.limit == null
                    ? l10n.usageUnlimited
                    : l10n.usageOf(meter.used, meter.limit!),
                style: NlText.caption,
              ),
            ],
          ),
          if (fraction != null) ...[
            const SizedBox(height: NlSpace.sm),
            NlProgressBar(value: fraction, semanticsLabel: label),
          ],
        ],
      ),
    );
  }
}
