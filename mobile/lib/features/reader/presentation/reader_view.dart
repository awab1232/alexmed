import 'dart:async';

import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/pdf_range_source.dart';
import '../domain/pdf_marks.dart';

/// Selected text on one page, with its rectangles already in the stored
/// highlight form (page-width units, top-left origin).
final class ReaderSelection {
  const ReaderSelection({
    required this.pageNumber,
    required this.text,
    required this.rects,
  });

  final int pageNumber;
  final String text;
  final List<MarkRect> rects;
}

typedef SearchMatch = ({int page, String snippet});

/// What the reader screen can ask of the rendering layer.
abstract class ReaderViewController {
  Future<void> goToPage(int page);
  Future<void> clearSelection();

  /// The web's search: first occurrence per page, with a short snippet.
  Future<List<SearchMatch>> search(String query);
}

/// Everything the rendering layer needs; the screen owns the rest.
class ReaderViewConfig {
  const ReaderViewConfig({
    required this.source,
    required this.sourceName,
    required this.initialPage,
    required this.gesturesEnabled,
    required this.selectionEnabled,
    required this.onReady,
    required this.onPageChanged,
    required this.onSelection,
    required this.pageOverlay,
    required this.onRetry,
  });

  final PdfRangeSource source;
  final String sourceName;
  final int initialPage;

  /// Pan / zoom — off while drawing or erasing.
  final bool gesturesEnabled;
  final bool selectionEnabled;
  final void Function(ReaderViewController controller, int pageCount) onReady;
  final ValueChanged<int> onPageChanged;
  final ValueChanged<ReaderSelection?> onSelection;

  /// Marks layer for one page, sized to the page as shown.
  final Widget Function(int pageNumber, Size pageSize) pageOverlay;
  final VoidCallback onRetry;
}

typedef ReaderViewBuilder = Widget Function(ReaderViewConfig config);

/// The real renderer: PDFium (pdfrx) over the range source — pages render
/// lazily as they come into view, pinch / double-tap zoom, vertical
/// scrolling, native text selection.
Widget pdfrxReaderView(ReaderViewConfig config) =>
    _PdfrxReaderView(config: config);

class _PdfrxReaderView extends StatefulWidget {
  const _PdfrxReaderView({required this.config});
  final ReaderViewConfig config;

  @override
  State<_PdfrxReaderView> createState() => _PdfrxReaderViewState();
}

class _PdfrxReaderViewState extends State<_PdfrxReaderView>
    implements ReaderViewController {
  final _controller = PdfViewerController();
  late final PdfDocumentRef _ref = PdfDocumentRefCustom(
    fileSize: widget.config.source.size,
    read: widget.config.source.read,
    sourceName: widget.config.sourceName,
  );
  int _selectionSeq = 0;

  PdfDocument get _doc => _controller.document;

  @override
  Future<void> goToPage(int page) => _controller.goToPage(pageNumber: page);

  @override
  Future<void> clearSelection() =>
      _controller.textSelectionDelegate.clearTextSelection();

  @override
  Future<List<SearchMatch>> search(String query) async {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    final matches = <SearchMatch>[];
    for (final page in _doc.pages) {
      try {
        final text = (await page.loadStructuredText()).fullText;
        final at = text.toLowerCase().indexOf(q);
        if (at < 0) continue;
        final start = (at - 30).clamp(0, text.length);
        final end = (at + q.length + 30).clamp(0, text.length);
        matches.add((
          page: page.pageNumber,
          snippet:
              '${start > 0 ? '…' : ''}${text.substring(start, end).replaceAll('\n', ' ')}…',
        ));
      } catch (_) {
        // One page failing to give its text doesn't stop the search.
      }
    }
    return matches;
  }

  Future<void> _selectionChanged(PdfTextSelection selection) async {
    final seq = ++_selectionSeq;
    if (!selection.hasSelectedText) {
      widget.config.onSelection(null);
      return;
    }
    final ranges = await selection.getSelectedTextRanges();
    if (!mounted || seq != _selectionSeq || ranges.isEmpty) return;
    // One page at a time, like a highlight (the first page of the range).
    final pageNumber = ranges.first.pageNumber;
    final page = _doc.pages[pageNumber - 1];
    final onPage = ranges.where((r) => r.pageNumber == pageNumber);
    final rects = <MarkRect>[];
    final text = StringBuffer();
    for (final range in onPage) {
      text.write(range.text);
      for (final f in range.enumerateFragmentBoundingRects()) {
        final b = f.bounds;
        rects.add(
          markRectFromPdf(
            left: b.left,
            top: b.top,
            right: b.right,
            bottom: b.bottom,
            pageWidth: page.width,
            pageHeight: page.height,
          ),
        );
      }
    }
    widget.config.onSelection(
      ReaderSelection(
        pageNumber: pageNumber,
        text: text.toString().trim(),
        rects: mergeLineRects(rects),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final config = widget.config;
    final l10n = AppLocalizations.of(context);
    return PdfViewer(
      _ref,
      controller: _controller,
      initialPageNumber: config.initialPage,
      params: PdfViewerParams(
        backgroundColor: NlColors.paper,
        margin: 8,
        sizeDelegateProvider: const PdfViewerSizeDelegateProviderLegacy(
          maxScale: 6,
        ),
        panEnabled: config.gesturesEnabled,
        scaleEnabled: config.gesturesEnabled,
        pageDropShadow: const BoxShadow(
          color: Color(0x22000000),
          blurRadius: 6,
          offset: Offset(0, 2),
        ),
        onViewerReady: (document, controller) =>
            config.onReady(this, document.pages.length),
        onPageChanged: (page) {
          if (page != null) config.onPageChanged(page);
        },
        textSelectionParams: PdfTextSelectionParams(
          enabled: config.selectionEnabled,
          onTextSelectionChange: (s) => unawaited(_selectionChanged(s)),
        ),
        pageOverlaysBuilder: (context, rect, page) => [
          Positioned.fill(
            child: config.pageOverlay(page.pageNumber, rect.size),
          ),
        ],
        loadingBannerBuilder: (context, loaded, total) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: NlSpace.md),
              Text(l10n.readerOpening, style: NlText.secondary),
            ],
          ),
        ),
        errorBannerBuilder: (context, error, stack, ref) => NlErrorView(
          error: error is Exception ? error : Exception(error),
          onRetry: config.onRetry,
        ),
      ),
    );
  }
}
