import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../library/data/library_models.dart' show bookDisplayTitle;
import '../data/mirror_models.dart';
import '../data/mirror_repository.dart';

/// Progress of a مِرآة job (the web's /mirror/[jobId]). Generation runs on
/// the server, so leaving this screen never stops it; it polls every 3 s
/// while the job is running and stops polling when it ends or the screen
/// closes. As on the web, the deck opens as soon as its first part is
/// ready — unless [detailsOnly] (opened from a deck to see failed parts).
class MirrorJobScreen extends ConsumerStatefulWidget {
  const MirrorJobScreen({
    super.key,
    required this.jobId,
    this.detailsOnly = false,
    this.pollInterval = const Duration(seconds: 3),
  });

  final String jobId;
  final bool detailsOnly;
  final Duration pollInterval;

  @override
  ConsumerState<MirrorJobScreen> createState() => _MirrorJobScreenState();
}

class _MirrorJobScreenState extends ConsumerState<MirrorJobScreen> {
  MirrorJob? _job;
  Object? _error;
  Timer? _timer;
  bool _retrying = false;
  bool _leaving = false;

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
      final job = await ref.read(mirrorRepositoryProvider).job(widget.jobId);
      if (!mounted) return;
      setState(() {
        _job = job;
        _error = null;
      });
      if (!widget.detailsOnly && job.canOpenDeck && !_leaving) {
        _leaving = true;
        context.pushReplacement(Routes.deck(job.deckId!));
        return;
      }
      if (!job.status.isTerminal) {
        _timer = Timer(widget.pollInterval, _load);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
      // Keep trying quietly while the job may still be running.
      _timer = Timer(widget.pollInterval * 2, _load);
    }
  }

  Future<void> _retry(Future<void> Function() action) async {
    setState(() => _retrying = true);
    try {
      await action();
      await _load();
    } catch (error) {
      if (mounted) showNlToast(context, apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _retrying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final job = _job;
    return Scaffold(
      appBar: AppBar(
        title: Text(job == null ? '' : isolate(bookDisplayTitle(job.fileName))),
      ),
      body: job == null
          ? (_error != null
                ? NlErrorView(error: _error!, onRetry: _load)
                : const Center(child: CircularProgressIndicator()))
          : _body(context, l10n, job),
    );
  }

  Widget _body(BuildContext context, AppLocalizations l10n, MirrorJob job) {
    final repo = ref.read(mirrorRepositoryProvider);
    final total = job.batches.length;
    final done = job.completeCount;
    final extracting = job.status == MirrorJobStatus.extracting;
    final generating = !extracting && !job.status.isTerminal;

    return ListView(
      padding: const EdgeInsets.all(NlSpace.page),
      children: [
        if (!job.fromText && job.pageCount > 0)
          Text(
            l10n.mirrorJobMeta(job.pageCount, total),
            style: NlText.secondary,
          ),
        const SizedBox(height: NlSpace.xl),
        if (extracting || generating)
          _ProgressPanel(
            title: extracting
                ? l10n.mirrorJobReading
                : l10n.mirrorJobGenerating,
            detail: extracting
                ? l10n.mirrorJobReadingHint
                : l10n.mirrorJobProgress(done, total),
            value: extracting || total == 0 ? null : done / total,
          ),
        if (job.canOpenDeck && (generating || widget.detailsOnly)) ...[
          const SizedBox(height: NlSpace.lg),
          if (generating) Text(l10n.mirrorStartEarly, style: NlText.secondary),
          const SizedBox(height: NlSpace.sm),
          NlButton(
            label: l10n.mirrorStartStudying,
            kind: NlButtonKind.marker,
            expand: true,
            onPressed: () => context.pushReplacement(Routes.deck(job.deckId!)),
          ),
        ],
        if (job.status == MirrorJobStatus.complete)
          _Notice(
            icon: LucideIcons.circleCheck,
            color: NlColors.correct,
            text: l10n.mirrorJobComplete,
          ),
        if (job.status == MirrorJobStatus.failed) ...[
          _Notice(
            icon: LucideIcons.circleAlert,
            color: NlColors.wrong,
            text: job.extractionError ?? l10n.mirrorJobFailed,
          ),
          const SizedBox(height: NlSpace.md),
          NlButton(
            label: l10n.mirrorRetryPages,
            icon: LucideIcons.rotateCcw,
            loading: _retrying,
            expand: true,
            onPressed: () => _retry(() => repo.retryExtraction(job.id)),
          ),
          const SizedBox(height: NlSpace.sm),
          NlButton(
            label: l10n.mirrorUploadNew,
            kind: NlButtonKind.secondary,
            expand: true,
            onPressed: () => context.pushReplacement(Routes.uploadQuestionFile),
          ),
        ],
        if (job.status == MirrorJobStatus.partialFailed)
          _Notice(
            icon: LucideIcons.circleAlert,
            color: const Color(0xFFB7791F),
            text: l10n.mirrorPartial(job.failedBatches.length),
          ),
        if (job.failedBatches.isNotEmpty) ...[
          const SizedBox(height: NlSpace.lg),
          NlGroup(
            children: [
              for (final batch in job.failedBatches)
                NlRow(
                  icon: LucideIcons.circleAlert,
                  destructive: true,
                  label: l10n.mirrorBatchPages(batch.startPage, batch.endPage),
                  value: batch.errorMessage ?? l10n.mirrorBatchFailed,
                  trailing: IconButton(
                    tooltip: l10n.actionRetry,
                    icon: const Icon(LucideIcons.rotateCcw, size: 20),
                    onPressed: _retrying
                        ? null
                        : () => _retry(() => repo.retryBatch(batch.id)),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _ProgressPanel extends StatelessWidget {
  const _ProgressPanel({
    required this.title,
    required this.detail,
    required this.value,
  });

  final String title;
  final String detail;

  /// null = indeterminate (reading the file).
  final double? value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NlSpace.xl),
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.lg),
        border: Border.all(color: NlColors.rule),
      ),
      child: Column(
        children: [
          const NiroImage(expression: NiroExpression.explaining, size: 110),
          const SizedBox(height: NlSpace.md),
          Semantics(
            liveRegion: true,
            child: Text(
              title,
              style: NlText.title,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: NlSpace.xs),
          Text(detail, style: NlText.secondary, textAlign: TextAlign.center),
          const SizedBox(height: NlSpace.lg),
          value == null
              ? const ClipRRect(
                  borderRadius: BorderRadius.all(Radius.circular(99)),
                  child: LinearProgressIndicator(minHeight: 6),
                )
              : NlProgressBar(value: value!, semanticsLabel: title),
        ],
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.color, required this.text});

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: NlSpace.lg),
      child: Container(
        padding: const EdgeInsets.all(NlSpace.md),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(NlRadius.md),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: NlSpace.sm),
            Expanded(child: Text(text, style: NlText.body)),
          ],
        ),
      ),
    );
  }
}
