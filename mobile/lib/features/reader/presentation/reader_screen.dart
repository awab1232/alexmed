import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../library/data/library_models.dart' show bookDisplayTitle;
import '../data/pdf_range_source.dart';
import '../data/reader_repository.dart';
import '../domain/pdf_marks.dart';
import 'ai_sheets.dart';
import 'marks_controller.dart';
import 'marks_overlay.dart';
import 'reader_view.dart';

/// Last page read per book for this app session — reopening a book without
/// a target page continues there.
final readerPositionProvider = NotifierProvider<_Positions, Map<String, int>>(
  _Positions.new,
);

class _Positions extends Notifier<Map<String, int>> {
  @override
  Map<String, int> build() => {};
  void set(String bookId, int page) => state = {...state, bookId: page};
}

/// Overridable in tests (the real one renders with PDFium).
final readerViewBuilderProvider = Provider<ReaderViewBuilder>(
  (ref) => pdfrxReaderView,
);

/// The original PDF, natively (the web's app/books/[bookId]/read +
/// components/PdfViewer.tsx): lazy page rendering over byte ranges, pinch
/// and double-tap zoom, go to page, search, the تضليل / قلم / ممحاة layer
/// saved per page, and «اسأل Niro» about a selection or the page.
class ReaderScreen extends ConsumerStatefulWidget {
  const ReaderScreen({super.key, required this.bookId, this.initialPage});

  final String bookId;

  /// Open at this page (a source-page link); otherwise where the student
  /// left off this session, or page 1.
  final int? initialPage;

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen>
    with WidgetsBindingObserver {
  ReaderBook? _book;
  PdfRangeSource? _source;
  Object? _error;
  bool _missingFile = false;
  int _attempt = 0;

  ReaderViewController? _view;
  int _pageCount = 0;
  int _page = 1;
  late final int _startPage =
      widget.initialPage ??
      ref.read(readerPositionProvider)[widget.bookId] ??
      1;

  MarkTool _tool = MarkTool.browse;
  String _highlightColor = highlightColors.first.value;
  String _penColor = penColors.first.value;
  ReaderSelection? _selection;
  late final MarksController _marks;

  ReaderRepository get _repo => ref.read(readerRepositoryProvider);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Captured now: the last save can run after the screen is gone.
    final repo = _repo;
    final bookId = widget.bookId;
    _marks = MarksController(
      save: (page, marks) => repo.saveMarks(bookId, page, marks),
    );
    _open();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _marks.dispose();
    _source?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      unawaited(_marks.flushAll().catchError((_) {}));
    }
  }

  Future<void> _open() async {
    _source?.dispose();
    setState(() {
      _error = null;
      _missingFile = false;
      _source = null;
      _view = null;
      _attempt++;
    });
    try {
      final book = await _repo.book(widget.bookId);
      if (book == null) {
        if (mounted) setState(() => _missingFile = true);
        return;
      }
      final source = _repo.source(book);
      await source.open();
      if (!mounted) {
        source.dispose();
        return;
      }
      setState(() {
        _book = book;
        _source = source;
      });
      // Marks load alongside; the page shows without waiting for them.
      unawaited(
        _repo.marks(widget.bookId).then(_marks.load).catchError((Object _) {}),
      );
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  void _onPage(int page) {
    if (page == _page) return;
    setState(() => _page = page);
    ref.read(readerPositionProvider.notifier).set(widget.bookId, page);
  }

  void _setTool(MarkTool tool) {
    unawaited(HapticFeedback.selectionClick());
    setState(() => _tool = _tool == tool ? MarkTool.browse : tool);
    if (_tool == MarkTool.pen || _tool == MarkTool.eraser) {
      unawaited(_view?.clearSelection());
    }
  }

  void _highlightSelection() {
    final s = _selection;
    if (s == null || s.rects.isEmpty) return;
    _marks.update(
      s.pageNumber,
      (current) => current.copyWith(
        highlights: addPdfHighlight(
          current.highlights,
          PdfHighlight(id: newMarkId(), color: _highlightColor, rects: s.rects),
        ),
      ),
    );
    unawaited(_view?.clearSelection());
    setState(() => _selection = null);
  }

  Future<void> _goTo() async {
    final l10n = AppLocalizations.of(context);
    final page = await showGoToPageDialog(
      context,
      current: _page,
      count: _pageCount,
      title: l10n.readerGoTo,
    );
    if (page != null) await _view?.goToPage(page);
  }

  Future<void> _search() async {
    final view = _view;
    if (view == null) return;
    final page = await showReaderSearch(context, view);
    if (page != null) await view.goToPage(page);
  }

  void _ask({ReaderSelection? selection}) {
    final book = _book;
    if (book == null) return;
    showAskSelectionSheet(
      context,
      bookId: book.id,
      fileName: book.fileName,
      pageNumber: selection?.pageNumber ?? _page,
      selectedText: selection?.text ?? '',
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final book = _book;
    final source = _source;
    final title = book == null
        ? l10n.bookSource
        : bookDisplayTitle(book.fileName);

    Widget body;
    if (_missingFile) {
      body = NlEmptyState(
        title: l10n.readerNoFile,
        message: l10n.readerNoFileHint,
        expression: NiroExpression.shocked,
      );
    } else if (_error != null) {
      body = NlErrorView(error: _error!, onRetry: _open);
    } else if (source == null) {
      body = Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: NlSpace.md),
            Text(l10n.readerOpening, style: NlText.secondary),
          ],
        ),
      );
    } else {
      final drawing = _tool == MarkTool.pen || _tool == MarkTool.eraser;
      body = KeyedSubtree(
        key: ValueKey(_attempt),
        child: ref.watch(readerViewBuilderProvider)(
          ReaderViewConfig(
            source: source,
            sourceName: 'book:${widget.bookId}',
            initialPage: _startPage,
            gesturesEnabled: !drawing,
            selectionEnabled: !drawing,
            onReady: (view, count) {
              _view = view;
              if (mounted) {
                setState(() {
                  _pageCount = count;
                  _page = _startPage.clamp(1, count);
                });
              }
            },
            onPageChanged: _onPage,
            onSelection: (s) {
              if (mounted) setState(() => _selection = s);
            },
            onRetry: _open,
            pageOverlay: (page, size) => ListenableBuilder(
              listenable: _marks,
              builder: (_, _) => MarksOverlay(
                marks: _marks.marksOf(page),
                tool: _tool,
                penColor: _penColor,
                onChange: (change) => _marks.update(page, change),
              ),
            ),
          ),
        ),
      );
    }

    return PopScope(
      onPopInvokedWithResult: (_, _) =>
          unawaited(_marks.flushAll().catchError((_) {})),
      child: Scaffold(
        backgroundColor: NlColors.paper,
        appBar: AppBar(
          titleSpacing: 0,
          title: Text(
            isolate(title),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: NlText.rowLabel,
          ),
          actions: [
            if (_pageCount > 0)
              TextButton(
                onPressed: _goTo,
                child: Text(
                  isolateLtr('$_page / $_pageCount'),
                  style: NlText.rowLabel.copyWith(fontSize: 15),
                  semanticsLabel: l10n.readerPageOf(_page, _pageCount),
                ),
              ),
            IconButton(
              tooltip: l10n.readerSearch,
              icon: const Icon(LucideIcons.search),
              onPressed: _view == null ? null : _search,
            ),
            IconButton(
              tooltip: l10n.readerAskPage,
              icon: const Icon(LucideIcons.sparkles),
              onPressed: _book == null ? null : () => _ask(),
            ),
          ],
        ),
        body: Column(
          children: [
            Expanded(child: body),
            if (_selection != null && _tool != MarkTool.pen)
              _SelectionBar(
                highlightColor: _highlightColor,
                onHighlight: _highlightSelection,
                onAsk: () => _ask(selection: _selection),
              ),
          ],
        ),
        bottomNavigationBar: source == null
            ? null
            : ListenableBuilder(
                listenable: _marks,
                builder: (_, _) => _Toolbar(
                  tool: _tool,
                  highlightColor: _highlightColor,
                  penColor: _penColor,
                  saveState: _marks.state,
                  onTool: _setTool,
                  onHighlightColor: (c) => setState(() => _highlightColor = c),
                  onPenColor: (c) => setState(() => _penColor = c),
                ),
              ),
      ),
    );
  }
}

class _SelectionBar extends StatelessWidget {
  const _SelectionBar({
    required this.highlightColor,
    required this.onHighlight,
    required this.onAsk,
  });

  final String highlightColor;
  final VoidCallback onHighlight;
  final VoidCallback onAsk;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      color: NlColors.sheet,
      padding: const EdgeInsets.symmetric(
        horizontal: NlSpace.page,
        vertical: NlSpace.sm,
      ),
      child: Row(
        children: [
          Expanded(
            child: NlButton(
              label: l10n.readerHighlight,
              icon: LucideIcons.highlighter,
              kind: NlButtonKind.secondary,
              expand: true,
              onPressed: onHighlight,
            ),
          ),
          const SizedBox(width: NlSpace.sm),
          Expanded(
            child: NlButton(
              label: l10n.readerAskSelection,
              icon: LucideIcons.sparkles,
              kind: NlButtonKind.marker,
              expand: true,
              onPressed: onAsk,
            ),
          ),
        ],
      ),
    );
  }
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.tool,
    required this.highlightColor,
    required this.penColor,
    required this.saveState,
    required this.onTool,
    required this.onHighlightColor,
    required this.onPenColor,
  });

  final MarkTool tool;
  final String highlightColor;
  final String penColor;
  final SaveState saveState;
  final ValueChanged<MarkTool> onTool;
  final ValueChanged<String> onHighlightColor;
  final ValueChanged<String> onPenColor;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final tools = [
      (MarkTool.highlight, LucideIcons.highlighter, l10n.readerToolHighlight),
      (MarkTool.pen, LucideIcons.penLine, l10n.readerToolPen),
      (MarkTool.eraser, LucideIcons.eraser, l10n.readerToolEraser),
    ];
    final colors = switch (tool) {
      MarkTool.highlight => highlightColors,
      MarkTool.pen => penColors,
      _ => null,
    };
    final saveText = switch (saveState) {
      SaveState.saving => l10n.readerSaving,
      SaveState.saved => l10n.readerSaved,
      SaveState.error => l10n.readerSaveFailed,
      SaveState.idle => null,
    };
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: NlColors.sheet,
        border: Border(top: BorderSide(color: NlColors.rule)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: NlSpace.md,
            vertical: NlSpace.xs,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (colors != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: NlSpace.xs),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (final c in colors)
                        _Swatch(
                          color: c.value,
                          label: c.label,
                          selected:
                              c.value ==
                              (tool == MarkTool.pen
                                  ? penColor
                                  : highlightColor),
                          onTap: () => tool == MarkTool.pen
                              ? onPenColor(c.value)
                              : onHighlightColor(c.value),
                        ),
                    ],
                  ),
                ),
              Row(
                children: [
                  for (final (t, icon, label) in tools)
                    _ToolButton(
                      icon: icon,
                      label: label,
                      selected: tool == t,
                      onTap: () => onTool(t),
                    ),
                  const Spacer(),
                  if (saveText != null)
                    Text(
                      saveText,
                      style: NlText.caption.copyWith(
                        color: saveState == SaveState.error
                            ? NlColors.wrong
                            : NlColors.ink3,
                      ),
                    ),
                ],
              ),
              if (tool != MarkTool.browse)
                Text(
                  switch (tool) {
                    MarkTool.highlight => l10n.readerHintHighlight,
                    MarkTool.pen => l10n.readerHintPen,
                    _ => l10n.readerHintEraser,
                  },
                  style: NlText.caption,
                  textAlign: TextAlign.center,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ToolButton extends StatelessWidget {
  const _ToolButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsetsDirectional.only(end: NlSpace.xs),
    child: Semantics(
      button: true,
      selected: selected,
      label: label,
      child: Tooltip(
        message: label,
        child: InkWell(
          borderRadius: BorderRadius.circular(NlRadius.md),
          onTap: onTap,
          child: Container(
            width: 52,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? NlColors.ink : null,
              borderRadius: BorderRadius.circular(NlRadius.md),
            ),
            child: Icon(
              icon,
              size: 20,
              color: selected ? Colors.white : NlColors.ink2,
            ),
          ),
        ),
      ),
    ),
  );
}

class _Swatch extends StatelessWidget {
  const _Swatch({
    required this.color,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String color;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: label,
    child: InkResponse(
      onTap: onTap,
      radius: 24,
      child: SizedBox(
        width: 44,
        height: 40,
        child: Center(
          child: Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: markColor(color),
              shape: BoxShape.circle,
              border: Border.all(
                color: selected ? NlColors.ink : NlColors.rule,
                width: selected ? 3 : 1,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/// «الانتقال إلى صفحة»: a number between 1 and [count].
Future<int?> showGoToPageDialog(
  BuildContext context, {
  required int current,
  required int count,
  required String title,
}) {
  final l10n = AppLocalizations.of(context);
  final input = TextEditingController(text: '$current');
  return showDialog<int>(
    context: context,
    builder: (context) {
      int? parse() {
        final n = int.tryParse(input.text.trim());
        return n == null || n < 1 || n > count ? null : n;
      }

      return StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(title),
          content: TextField(
            controller: input,
            autofocus: true,
            keyboardType: TextInputType.number,
            textDirection: TextDirection.ltr,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) {
              final n = parse();
              if (n != null) Navigator.of(context).pop(n);
            },
            decoration: InputDecoration(
              helperText: l10n.readerPageRange(count),
              errorText: input.text.isNotEmpty && parse() == null
                  ? l10n.readerPageRange(count)
                  : null,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(l10n.actionCancel),
            ),
            FilledButton(
              onPressed: parse() == null
                  ? null
                  : () => Navigator.of(context).pop(parse()),
              child: Text(l10n.readerGo),
            ),
          ],
        ),
      );
    },
  );
}

/// Search in the PDF's text (the web's search): results by page; a tap
/// returns the page to open.
Future<int?> showReaderSearch(BuildContext context, ReaderViewController view) {
  final l10n = AppLocalizations.of(context);
  return showNlSheet<int>(
    context,
    title: l10n.readerSearch,
    builder: (context) => _SearchSheet(view: view),
  );
}

class _SearchSheet extends StatefulWidget {
  const _SearchSheet({required this.view});
  final ReaderViewController view;

  @override
  State<_SearchSheet> createState() => _SearchSheetState();
}

class _SearchSheetState extends State<_SearchSheet> {
  final _input = TextEditingController();
  List<SearchMatch>? _matches;
  bool _searching = false;

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _run() async {
    if (_input.text.trim().isEmpty) return;
    setState(() => _searching = true);
    final matches = await widget.view.search(_input.text);
    if (mounted) {
      setState(() {
        _matches = matches;
        _searching = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final matches = _matches;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _input,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => _run(),
          decoration: InputDecoration(
            hintText: l10n.readerSearchHint,
            prefixIcon: const Icon(LucideIcons.search, size: 18),
          ),
        ),
        const SizedBox(height: NlSpace.sm),
        if (_searching)
          const LinearProgressIndicator(minHeight: 3)
        else if (matches != null && matches.isEmpty)
          Padding(
            padding: const EdgeInsets.all(NlSpace.md),
            child: Text(l10n.readerNoMatches, style: NlText.secondary),
          )
        else if (matches != null)
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: matches.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) => ListTile(
                title: Text(l10n.quizPage(matches[i].page)),
                subtitle: AutoDirText(
                  matches[i].snippet,
                  style: NlText.caption,
                  maxLines: 2,
                ),
                onTap: () => Navigator.of(context).pop(matches[i].page),
              ),
            ),
          ),
      ],
    );
  }
}
