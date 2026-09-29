import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/providers.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/study_models.dart';
import '../data/study_repository.dart';
import 'study_screen.dart';

const _toneIcon = {'warning': '⚠️', 'high_yield': '⚡', 'clinical': '🩺'};

/// The whole file's summary as one reading document (the web's
/// components/study/SummaryMode): per chapter — lead summary, the composed
/// medical note pages when they exist, otherwise part-by-part summaries
/// with their real page ranges and the explanation, then High-Yield points.
/// The globe switches English ⇄ Arabic wherever both exist.
class SummaryView extends ConsumerStatefulWidget {
  const SummaryView({
    super.key,
    required this.content,
    required this.notice,
    required this.onReload,
    this.jobsPoll = const Duration(seconds: 3),
  });

  final StudyContent content;
  final Widget notice;
  final Future<void> Function() onReload;
  final Duration jobsPoll;

  @override
  ConsumerState<SummaryView> createState() => _SummaryViewState();
}

class _SummaryViewState extends ConsumerState<SummaryView> {
  bool _english = true;
  String? _composing;
  Timer? _poll;

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  /// "تجهيز ملخص منظم": queue the job, follow it, reload when it settles.
  Future<void> _compose(String chapterId) async {
    final repo = ref.read(studyRepositoryProvider);
    setState(() => _composing = chapterId);
    try {
      await repo.composeNotes(chapterId);
    } catch (error) {
      if (mounted) {
        setState(() => _composing = null);
        showNlToast(context, apiErrorText(context, error));
      }
      return;
    }
    void check() {
      _poll = Timer(widget.jobsPoll, () async {
        try {
          final jobs = await repo.jobs(widget.content.bookId);
          final job = jobs.where(
            (j) => j.chapterId == chapterId && j.kind == 'medical_notes',
          );
          if (job.isNotEmpty && job.first.settled) {
            await widget.onReload();
            if (mounted) setState(() => _composing = null);
            return;
          }
        } catch (_) {
          // Try again on the next tick.
        }
        if (mounted) check();
      });
    }

    check();
  }

  Future<void> _copyLink() async {
    final env = ref.read(envProvider);
    final url =
        '${env.apiBaseUrl}/books/${widget.content.bookId}/study?tool=explanation';
    await Clipboard.setData(ClipboardData(text: url));
    if (mounted) {
      showNlToast(context, AppLocalizations.of(context).summaryLinkCopied);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final chapters = widget.content.analyzed;
    final uiDirection = Directionality.of(context);
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: kToolbarHeight + 8,
        title: StudyTitle(title: l10n.summaryTitle, book: widget.content.title),
        actions: [
          IconButton(
            tooltip: _english ? l10n.summaryShowAr : l10n.summaryShowEn,
            icon: const Icon(LucideIcons.globe),
            onPressed: () => setState(() => _english = !_english),
          ),
          IconButton(
            tooltip: l10n.summaryCopyLink,
            icon: const Icon(LucideIcons.link),
            onPressed: _copyLink,
          ),
        ],
      ),
      body: Column(
        children: [
          widget.notice,
          Expanded(
            child: chapters.isEmpty
                ? StudyEmpty(
                    title: l10n.summaryEmpty,
                    message: widget.content.isOwner
                        ? l10n.studyEmptyOwner
                        : l10n.summaryEmptyShared,
                  )
                : Directionality(
                    textDirection: _english
                        ? TextDirection.ltr
                        : TextDirection.rtl,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(
                        NlSpace.page,
                        NlSpace.lg,
                        NlSpace.page,
                        NlSpace.xxxl,
                      ),
                      itemCount: chapters.length,
                      separatorBuilder: (_, _) => const Padding(
                        padding: EdgeInsets.symmetric(vertical: NlSpace.xl),
                        child: Divider(),
                      ),
                      itemBuilder: (context, i) => _Chapter(
                        chapter: chapters[i],
                        english: _english,
                        composing: _composing,
                        onCompose: widget.content.isOwner ? _compose : null,
                        uiDirection: uiDirection,
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

String _pages(List<int> pages) {
  if (pages.isEmpty) return '';
  final sorted = {...pages}.toList()..sort();
  return sorted.length == 1
      ? 'p. ${sorted.first}'
      : 'p. ${sorted.first}–${sorted.last}';
}

class _Chapter extends StatelessWidget {
  const _Chapter({
    required this.chapter,
    required this.english,
    required this.composing,
    required this.onCompose,
    required this.uiDirection,
  });

  final StudyChapter chapter;
  final TextDirection uiDirection;
  final bool english;
  final String? composing;
  final ValueChanged<String>? onCompose;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final c = chapter;
    final explanation = english
        ? (c.explanationEn ?? c.explanationAr)
        : (c.explanationAr ?? c.explanationEn);
    final body = english ? NlText.body : NlText.reading;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: AutoDirText(
            c.title,
            style: NlText.display.copyWith(fontSize: 22),
          ),
        ),
        if (c.startPage > 0 && c.endPage > 0)
          Text(
            isolateLtr('pages ${c.startPage}–${c.endPage}'),
            style: NlText.caption,
          ),
        if (c.chapterSummary != null) ...[
          const SizedBox(height: NlSpace.md),
          AutoDirText(
            c.chapterSummary!,
            style: NlText.body.copyWith(
              fontSize: 17,
              fontWeight: FontWeight.w500,
              height: 1.6,
            ),
          ),
        ],
        if (c.notePages.isNotEmpty)
          for (final page in c.notePages)
            _NotePage(page: page, english: english)
        else ...[
          if (c.summarySections.length > 1)
            _Section(
              title: english ? 'Part by part' : 'ملخص كل جزء',
              children: [
                for (final s in c.summarySections)
                  Padding(
                    padding: const EdgeInsets.only(bottom: NlSpace.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          isolateLtr(_pages([s.pageStart, s.pageEnd])),
                          style: NlText.caption.copyWith(
                            color: NlColors.niroDeep,
                          ),
                        ),
                        AutoDirText(s.summary, style: body),
                      ],
                    ),
                  ),
              ],
            ),
          if (explanation != null && explanation.isNotEmpty)
            _Section(
              title: english ? 'Explanation' : 'الشرح',
              children: [
                AutoDirText(explanation, style: body.copyWith(height: 1.7)),
              ],
            ),
          if (onCompose != null) ...[
            const SizedBox(height: NlSpace.lg),
            Directionality(
              textDirection: uiDirection,
              child: Container(
                padding: const EdgeInsets.all(NlSpace.md),
                decoration: BoxDecoration(
                  color: NlColors.niroSoft,
                  borderRadius: BorderRadius.circular(NlRadius.md),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(l10n.summaryComposeBody, style: NlText.secondary),
                    const SizedBox(height: NlSpace.sm),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: NlButton(
                        label: l10n.summaryCompose,
                        icon: LucideIcons.sparkles,
                        kind: NlButtonKind.secondary,
                        loading: composing == c.id,
                        onPressed: composing != null
                            ? null
                            : () => onCompose!(c.id),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
        if (c.keyPoints.isNotEmpty)
          _Section(
            title: '⚡ High-Yield',
            ltr: true,
            children: [
              for (final point in c.keyPoints)
                Padding(
                  padding: const EdgeInsets.only(bottom: NlSpace.sm),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 9, right: 10),
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: NlColors.marker,
                          shape: BoxShape.circle,
                        ),
                      ),
                      Expanded(child: Text(point, style: NlText.body)),
                    ],
                  ),
                ),
            ],
          ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.children,
    this.ltr = false,
  });

  final String title;
  final List<Widget> children;
  final bool ltr;

  @override
  Widget build(BuildContext context) {
    final section = Padding(
      padding: const EdgeInsets.only(top: NlSpace.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              title,
              style: NlText.title.copyWith(color: NlColors.niroDeep),
            ),
          ),
          const SizedBox(height: NlSpace.sm),
          ...children,
        ],
      ),
    );
    return ltr
        ? Directionality(textDirection: TextDirection.ltr, child: section)
        : section;
  }
}

class _NotePage extends StatelessWidget {
  const _NotePage({required this.page, required this.english});

  final NotePage page;
  final bool english;

  @override
  Widget build(BuildContext context) {
    final body = english ? NlText.body : NlText.reading;
    return _Section(
      title: page.title,
      children: [
        if (page.sourcePages.isNotEmpty)
          Text(isolateLtr(_pages(page.sourcePages)), style: NlText.caption),
        if (page.subtitle.isNotEmpty)
          AutoDirText(page.subtitle, style: NlText.secondary),
        for (final block in page.blocks) ...[
          const SizedBox(height: NlSpace.md),
          Container(
            padding: const EdgeInsets.all(NlSpace.md),
            decoration: BoxDecoration(
              color: switch (block.tone) {
                'warning' => NlColors.wrongSoft,
                'high_yield' => NlColors.markerSoft,
                'clinical' => NlColors.correctSoft,
                _ => NlColors.sheet,
              },
              borderRadius: BorderRadius.circular(NlRadius.md),
              border: Border.all(color: NlColors.rule),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AutoDirText(
                  [?_toneIcon[block.tone], block.heading].join(' '),
                  style: NlText.rowLabel,
                ),
                if ((english ? block.bodyEn : block.bodyAr).isNotEmpty ||
                    (english ? block.bodyAr : block.bodyEn).isNotEmpty) ...[
                  const SizedBox(height: 4),
                  AutoDirText(
                    english
                        ? (block.bodyEn.isNotEmpty
                              ? block.bodyEn
                              : block.bodyAr)
                        : (block.bodyAr.isNotEmpty
                              ? block.bodyAr
                              : block.bodyEn),
                    style: body,
                  ),
                ],
                for (final item in block.items)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: AutoDirText('• $item', style: body),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
