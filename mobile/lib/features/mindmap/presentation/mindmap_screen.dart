import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../study/data/study_models.dart' show GenerationJob;
import '../data/mindmap_repository.dart';

/// The book's mind map (the web's app/books/[bookId]/mindmap): each analysed
/// chapter opens into branches — English summary, Arabic explanation,
/// concepts, exam points, recall prompts — plus its visual anchors. Building
/// a chapter's map is a server job; the screen follows it while one is
/// queued or running and reloads the map when it finishes.
class MindMapScreen extends ConsumerStatefulWidget {
  const MindMapScreen({
    super.key,
    required this.bookId,
    this.pollInterval = const Duration(seconds: 3),
  });

  final String bookId;
  final Duration pollInterval;

  @override
  ConsumerState<MindMapScreen> createState() => _MindMapScreenState();
}

class _MindMapScreenState extends ConsumerState<MindMapScreen> {
  MindMap? _map;
  Object? _error;
  final _jobs = <String, GenerationJob>{};
  final _open = <String>{};
  final _queueing = <String>{};
  Timer? _poll;

  MindMapRepository get _repo => ref.read(mindMapRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final map = await _repo.get(widget.bookId);
      if (!mounted) return;
      setState(() {
        _map = map;
        _error = null;
      });
      if (map.isOwner) await _refreshJobs();
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  /// Mind-map jobs by chapter; polls while any is waiting or running and
  /// reloads the map when one of them finishes.
  Future<void> _refreshJobs() async {
    _poll?.cancel();
    final before = {
      for (final e in _jobs.entries)
        if (e.value.active) e.key,
    };
    try {
      final jobs = await _repo.jobs(widget.bookId);
      if (!mounted) return;
      setState(() {
        _jobs
          ..clear()
          ..addEntries(
            jobs
                .where((j) => j.kind == 'mindmap')
                .map((j) => MapEntry(j.chapterId, j)),
          );
      });
    } catch (_) {
      // Keep the last known state; try again below.
    }
    final active = {
      for (final e in _jobs.entries)
        if (e.value.active) e.key,
    };
    if (before.any((id) => !active.contains(id))) {
      final map = await _repo.get(widget.bookId).catchError((_) => _map!);
      if (mounted) setState(() => _map = map);
    }
    if (active.isNotEmpty && mounted) {
      _poll = Timer(widget.pollInterval, _refreshJobs);
    }
  }

  Future<void> _generate(String chapterId) async {
    setState(() => _queueing.add(chapterId));
    try {
      await _repo.generate(chapterId);
      await _refreshJobs();
    } catch (error) {
      if (mounted) showNlToast(context, apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _queueing.remove(chapterId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final map = _map;
    if (map == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.toolMindmap)),
        body: _error == null
            ? const Center(child: CircularProgressIndicator())
            : NlErrorView(error: _error!, onRetry: _load),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(l10n.toolMindmap)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            NlSpace.page,
            0,
            NlSpace.page,
            NlSpace.xxxl,
          ),
          children: [
            Text(l10n.mindmapIntro, style: NlText.secondary),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(
                  LucideIcons.bookOpen,
                  size: 14,
                  color: NlColors.ink3,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    isolate(map.fileName),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: NlText.caption,
                  ),
                ),
              ],
            ),
            const SizedBox(height: NlSpace.lg),
            _Stats(map: map),
            const SizedBox(height: NlSpace.xl),
            if (map.chapters.isEmpty)
              NlEmptyState(
                title: l10n.mindmapEmpty,
                message: l10n.mindmapEmptyHint,
                expression: NiroExpression.sleepy,
                inline: true,
              )
            else
              for (final (i, chapter) in map.chapters.indexed) ...[
                _ChapterTile(
                  index: i,
                  chapter: chapter,
                  open: _open.contains(chapter.id),
                  isOwner: map.isOwner,
                  job: _jobs[chapter.id],
                  queueing: _queueing.contains(chapter.id),
                  onToggle: () => setState(() {
                    if (!_open.remove(chapter.id)) _open.add(chapter.id);
                  }),
                  onGenerate: () => _generate(chapter.id),
                  onOpenTool: (tool) =>
                      context.push(Routes.bookStudy(widget.bookId, tool)),
                ),
                const SizedBox(height: NlSpace.md),
              ],
            const SizedBox(height: NlSpace.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  LucideIcons.sparkles,
                  size: 15,
                  color: NlColors.ink3,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(l10n.mindmapFooter, style: NlText.caption),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.map});
  final MindMap map;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final stats = [
      (map.chapters.length, l10n.mindmapChapters),
      (map.branches, l10n.mindmapBranches),
      (map.concepts, l10n.mindmapConcepts),
      (map.examPoints, l10n.mindmapExamPoints),
    ];
    return Row(
      children: [
        for (final (i, (value, label)) in stats.indexed) ...[
          if (i > 0) const SizedBox(width: NlSpace.sm),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: NlSpace.md),
              decoration: BoxDecoration(
                color: NlColors.sheet,
                borderRadius: BorderRadius.circular(NlRadius.md),
                border: Border.all(color: NlColors.rule),
              ),
              child: Column(
                children: [
                  Text('$value', style: NlText.title),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: NlText.caption.copyWith(fontSize: 11),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _ChapterTile extends StatelessWidget {
  const _ChapterTile({
    required this.index,
    required this.chapter,
    required this.open,
    required this.isOwner,
    required this.job,
    required this.queueing,
    required this.onToggle,
    required this.onGenerate,
    required this.onOpenTool,
  });

  final int index;
  final MindMapChapter chapter;
  final bool open;
  final bool isOwner;
  final GenerationJob? job;
  final bool queueing;
  final VoidCallback onToggle;
  final VoidCallback onGenerate;
  final ValueChanged<String> onOpenTool;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final sections = chapter.sections;
    final queued = queueing || job?.status == 'queued';
    final generating = queued || job?.status == 'processing';
    final failed = !generating && job?.status == 'failed';
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Container(
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: open ? NlColors.ink : NlColors.rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(NlRadius.md),
            onTap: onToggle,
            child: Padding(
              padding: const EdgeInsets.all(NlSpace.md),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: sections.isEmpty
                          ? NlColors.paper
                          : NlColors.marker,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${index + 1}'.padLeft(2, '0'),
                      style: NlText.rowLabel.copyWith(fontSize: 14),
                    ),
                  ),
                  const SizedBox(width: NlSpace.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AutoDirText(chapter.title, style: NlText.rowLabel),
                        Text(
                          sections.isEmpty
                              ? l10n.mindmapNotBuilt
                              : l10n.mindmapChapterMeta(
                                  sections.length,
                                  chapter.keyPoints.length,
                                ),
                          style: NlText.caption,
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    open
                        ? LucideIcons.chevronDown
                        : rtl
                        ? LucideIcons.chevronLeft
                        : LucideIcons.chevronRight,
                    size: 18,
                    color: NlColors.ink3,
                  ),
                ],
              ),
            ),
          ),
          if (sections.isEmpty && !isOwner)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                NlSpace.md,
                0,
                NlSpace.md,
                NlSpace.md,
              ),
              child: Text(l10n.mindmapSharedNotBuilt, style: NlText.secondary),
            ),
          if (sections.isEmpty && isOwner)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                NlSpace.md,
                0,
                NlSpace.md,
                NlSpace.md,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    failed
                        ? (job?.errorMessage ?? l10n.mindmapBuildFailed)
                        : l10n.mindmapBuildHint,
                    style: NlText.secondary.copyWith(
                      color: failed ? NlColors.wrong : null,
                    ),
                  ),
                  const SizedBox(height: NlSpace.sm),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: NlButton(
                      label: queued
                          ? l10n.mindmapQueued
                          : generating
                          ? l10n.mindmapBuilding
                          : failed
                          ? l10n.actionRetry
                          : l10n.mindmapBuild,
                      icon: LucideIcons.sparkles,
                      loading: generating,
                      onPressed: generating ? null : onGenerate,
                    ),
                  ),
                ],
              ),
            ),
          if (open && sections.isNotEmpty) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(NlSpace.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (i, s) in sections.indexed) ...[
                    if (i > 0) const SizedBox(height: NlSpace.md),
                    _Branch(index: i, section: s),
                  ],
                  const SizedBox(height: NlSpace.md),
                  Wrap(
                    spacing: NlSpace.sm,
                    children: [
                      NlButton(
                        label: l10n.mindmapOpenSummary,
                        kind: NlButtonKind.secondary,
                        onPressed: () => onOpenTool('explanation'),
                      ),
                      NlButton(
                        label: l10n.mindmapOpenCards,
                        kind: NlButtonKind.secondary,
                        onPressed: () => onOpenTool('cards'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
          if (open && sections.isEmpty && chapter.keyPoints.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                NlSpace.md,
                0,
                NlSpace.md,
                NlSpace.md,
              ),
              child: _Group(
                icon: LucideIcons.target,
                label: l10n.mindmapKeyPoints,
                children: [
                  for (final (i, p) in chapter.keyPoints.indexed)
                    _Numbered(n: i + 1, text: p),
                ],
              ),
            ),
          if (open && chapter.visuals.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                NlSpace.md,
                0,
                NlSpace.md,
                NlSpace.md,
              ),
              child: _Group(
                icon: LucideIcons.image,
                label: l10n.mindmapVisuals,
                children: [
                  for (final v in chapter.visuals)
                    Text(
                      [
                        '${assetTypeLabels[v.assetType] ?? v.assetType} · ${l10n.quizPage(v.pageNumber)}',
                        if (v.descriptionEn != null) isolate(v.descriptionEn!),
                      ].join(' — '),
                      style: NlText.caption.copyWith(color: NlColors.ink2),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Branch extends StatelessWidget {
  const _Branch({required this.index, required this.section});

  final int index;
  final MindMapSection section;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final s = section;
    return Container(
      padding: const EdgeInsets.all(NlSpace.md),
      decoration: BoxDecoration(
        color: NlColors.paper,
        // One-sided highlighter stripe (a rounded border must be uniform).
        border: BorderDirectional(
          start: const BorderSide(color: NlColors.marker, width: 4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${index + 1}'.padLeft(2, '0'),
                style: NlText.label.copyWith(color: NlColors.niroDeep),
              ),
              const SizedBox(width: NlSpace.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AutoDirText(s.title, style: NlText.rowLabel),
                    Text(
                      s.sourcePages.isEmpty
                          ? l10n.mindmapSourceLinked
                          : l10n.mindmapPages(s.sourcePages.join(', ')),
                      style: NlText.caption,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (s.summaryEn.isNotEmpty) ...[
            const SizedBox(height: NlSpace.sm),
            Text(
              s.summaryEn,
              textDirection: TextDirection.ltr,
              style: NlText.body,
            ),
          ],
          if (s.explanationAr.isNotEmpty) ...[
            const SizedBox(height: NlSpace.sm),
            Text(
              s.explanationAr,
              textDirection: TextDirection.rtl,
              style: NlText.reading,
            ),
          ],
          if (s.concepts.isNotEmpty)
            _Group(
              icon: LucideIcons.layers3,
              label: l10n.mindmapConceptsLabel,
              children: [
                for (final c in s.concepts)
                  Padding(
                    padding: const EdgeInsets.only(bottom: NlSpace.sm),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: isolateLtr(c.termEn),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              if (c.termAr.isNotEmpty)
                                TextSpan(text: ' · ${c.termAr}'),
                            ],
                          ),
                          style: NlText.body,
                        ),
                        if (c.explanationEn.isNotEmpty)
                          Text(
                            c.explanationEn,
                            textDirection: TextDirection.ltr,
                            style: NlText.caption.copyWith(
                              color: NlColors.ink2,
                            ),
                          ),
                        if (c.explanationAr.isNotEmpty)
                          Text(
                            c.explanationAr,
                            textDirection: TextDirection.rtl,
                            style: NlText.caption.copyWith(
                              color: NlColors.ink2,
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          if (s.examPoints.isNotEmpty)
            _Group(
              icon: LucideIcons.target,
              label: l10n.mindmapExamLabel,
              children: [
                for (final (i, p) in s.examPoints.indexed)
                  _Numbered(n: i + 1, text: p),
              ],
            ),
          if (s.cardPrompts.isNotEmpty)
            _Group(
              icon: LucideIcons.fileText,
              label: l10n.mindmapPromptsLabel,
              children: [
                for (final p in s.cardPrompts)
                  AutoDirText('› $p', style: NlText.body),
              ],
            ),
        ],
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({
    required this.icon,
    required this.label,
    required this.children,
  });

  final IconData icon;
  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: NlSpace.md),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(icon, size: 13, color: NlColors.niroDeep),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                label,
                style: NlText.label.copyWith(color: NlColors.niroDeep),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ...children,
      ],
    ),
  );
}

class _Numbered extends StatelessWidget {
  const _Numbered({required this.n, required this.text});

  final int n;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          margin: const EdgeInsetsDirectional.only(end: 8, top: 2),
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: NlColors.markerSoft,
            shape: BoxShape.circle,
          ),
          child: Text('$n', style: NlText.caption.copyWith(fontSize: 11)),
        ),
        Expanded(child: AutoDirText(text, style: NlText.body)),
      ],
    ),
  );
}
