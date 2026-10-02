import 'package:flutter/material.dart';

import 'theme.dart';
import 'tokens.dart';

// An AI reply's light Markdown — ported from components/assistant/
// RichText.tsx (tidyMath, tidySource, parseBlocks, the inline tokens,
// textDirection, forReading) and proven identical by
// test/core/ui/rich_text_parity_test.dart on the web code's own output
// (tool/export_rich_text_fixtures.ts). Builds spans directly — model output
// is never interpreted as markup. Each block takes its own direction.

sealed class RichBlock {
  const RichBlock();
}

final class CodeBlock extends RichBlock {
  const CodeBlock(this.text);
  final String text;
}

final class HeadingBlock extends RichBlock {
  const HeadingBlock(this.level, this.text);
  final int level;
  final String text;
}

final class ListBlock extends RichBlock {
  const ListBlock(this.ordered, this.items);
  final bool ordered;
  final List<String> items;
}

final class TableBlock extends RichBlock {
  const TableBlock(this.header, this.rows);
  final List<String> header;
  final List<List<String>> rows;
}

final class QuoteBlock extends RichBlock {
  const QuoteBlock(this.text);
  final String text;
}

final class RuleBlock extends RichBlock {
  const RuleBlock();
}

final class ParagraphBlock extends RichBlock {
  const ParagraphBlock(this.text);
  final String text;
}

final _bullet = RegExp(r'^\s*[-*•]\s+(.*)$');
final _numbered = RegExp(r'^\s*\d+[.)]\s+(.*)$');
final _heading = RegExp(r'^\s{0,3}(#{1,4})\s+(.*)$');
final _tableRow = RegExp(r'^\s*\|.*\|\s*$');
final _tableDivider = RegExp(
  r'^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$',
);
final _fence = RegExp(r'^\s*```');
final _rule = RegExp(r'^\s*(---+|\*\*\*+|___+)\s*$');
final _quote = RegExp(r'^\s*>\s?');

final _latexSymbols = <(RegExp, String)>[
  (RegExp(r'\\times(?![a-zA-Z])'), '×'),
  (RegExp(r'\\cdot(?![a-zA-Z])'), '·'),
  (RegExp(r'\\div(?![a-zA-Z])'), '÷'),
  (RegExp(r'\\approx(?![a-zA-Z])'), '≈'),
  (RegExp(r'\\neq?(?![a-zA-Z])'), '≠'),
  (RegExp(r'\\leq?(?![a-zA-Z])'), '≤'),
  (RegExp(r'\\geq?(?![a-zA-Z])'), '≥'),
  (RegExp(r'\\pm(?![a-zA-Z])'), '±'),
  (RegExp(r'\\(?:rightarrow|to)(?![a-zA-Z])'), '→'),
  (RegExp(r'\\Rightarrow(?![a-zA-Z])'), '⇒'),
  (RegExp(r'\\leftarrow(?![a-zA-Z])'), '←'),
  (RegExp(r'\\infty(?![a-zA-Z])'), '∞'),
  (RegExp(r'\\Delta(?![a-zA-Z])'), 'Δ'),
  (RegExp(r'\\alpha(?![a-zA-Z])'), 'α'),
  (RegExp(r'\\beta(?![a-zA-Z])'), 'β'),
  (RegExp(r'\\mu(?![a-zA-Z])'), 'μ'),
  (RegExp(r'\\pi(?![a-zA-Z])'), 'π'),
  (RegExp(r'\\theta(?![a-zA-Z])'), 'θ'),
  (RegExp(r'\\%'), '%'),
];

String _sub(String text, RegExp pattern, String Function(Match m) replace) =>
    text.replaceAllMapped(pattern, replace);

String tidyMath(String line) {
  var text = line
      .replaceAll(RegExp(r'\\\[|\\\]|\$\$'), '')
      .replaceAll(RegExp(r'\\\(|\\\)'), '')
      .replaceAll(RegExp(r'\\(?:left|right)(?![a-zA-Z])'), '');
  for (var pass = 0; pass < 3; pass++) {
    text = _sub(
      text,
      RegExp(r'\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}'),
      (m) => '(${m[1]})/(${m[2]})',
    );
    text = _sub(text, RegExp(r'\\sqrt\{([^{}]*)\}'), (m) => '√(${m[1]})');
    text = _sub(
      text,
      RegExp(
        r'\\(?:text|mathrm|mathbf|textbf|operatorname|mathit)\{([^{}]*)\}',
      ),
      (m) => m[1]!,
    );
  }
  for (final (pattern, symbol) in _latexSymbols) {
    text = text.replaceAll(pattern, symbol);
  }
  text = text
      .replaceAll(RegExp(r'\\[,;: ]'), ' ')
      .replaceAll(RegExp(r'\\!'), '')
      .replaceAll(RegExp(r'\^\{?2\}?(?![\d{])'), '²')
      .replaceAll(RegExp(r'\^\{?3\}?(?![\d{])'), '³');
  text = _sub(text, RegExp(r'\^\{([^{}]*)\}'), (m) => '^${m[1]}');
  text = _sub(text, RegExp(r'_\{([^{}]*)\}'), (m) => '_${m[1]}');
  return _sub(text, RegExp(r'(\S) {2,}'), (m) => '${m[1]} ');
}

/// tidyMath on every line outside ``` code blocks.
String tidySource(String source) {
  var inCode = false;
  return source
      .split('\n')
      .map((line) {
        if (_fence.hasMatch(line)) {
          inCode = !inCode;
          return line;
        }
        return inCode ? line : tidyMath(line);
      })
      .join('\n');
}

List<String> _splitRow(String line) => line
    .trim()
    .replaceFirst(RegExp(r'^\|'), '')
    .replaceFirst(RegExp(r'\|$'), '')
    .split('|')
    .map((c) => c.trim())
    .toList();

List<RichBlock> parseBlocks(String source) {
  final lines = source.replaceAll(RegExp(r'\r\n?'), '\n').split('\n');
  final blocks = <RichBlock>[];
  var paragraph = <String>[];
  void flush() {
    if (paragraph.isNotEmpty) {
      blocks.add(ParagraphBlock(paragraph.join('\n')));
      paragraph = [];
    }
  }

  for (var i = 0; i < lines.length; i++) {
    final line = lines[i];
    if (_fence.hasMatch(line)) {
      flush();
      final code = <String>[];
      i++;
      while (i < lines.length && !_fence.hasMatch(lines[i])) {
        code.add(lines[i]);
        i++;
      }
      blocks.add(CodeBlock(code.join('\n')));
      continue;
    }
    if (line.trim().isEmpty) {
      flush();
      continue;
    }
    if (_rule.hasMatch(line)) {
      flush();
      blocks.add(const RuleBlock());
      continue;
    }
    final heading = _heading.firstMatch(line);
    if (heading != null) {
      flush();
      blocks.add(
        HeadingBlock(
          heading[1]!.length,
          heading[2]!.replaceFirst(RegExp(r'\s#+\s*$'), ''),
        ),
      );
      continue;
    }
    if (_tableRow.hasMatch(line) &&
        _tableDivider.hasMatch(i + 1 < lines.length ? lines[i + 1] : '')) {
      flush();
      final header = _splitRow(line);
      final rows = <List<String>>[];
      i += 2;
      while (i < lines.length && _tableRow.hasMatch(lines[i])) {
        rows.add(_splitRow(lines[i]));
        i++;
      }
      i--;
      blocks.add(TableBlock(header, rows));
      continue;
    }
    final bullet = _bullet.firstMatch(line);
    final numbered = bullet == null ? _numbered.firstMatch(line) : null;
    if (bullet != null || numbered != null) {
      flush();
      final ordered = numbered != null;
      final items = <String>[(bullet ?? numbered)![1]!];
      while (i + 1 < lines.length) {
        final next = lines[i + 1];
        final match = (ordered ? _numbered : _bullet).firstMatch(next);
        if (match != null) {
          items.add(match[1]!);
          i++;
        } else if (RegExp(r'^\s{2,}\S').hasMatch(next) &&
            !_bullet.hasMatch(next)) {
          items[items.length - 1] += '\n${next.trim()}';
          i++;
        } else {
          break;
        }
      }
      blocks.add(ListBlock(ordered, items));
      continue;
    }
    if (_quote.hasMatch(line)) {
      flush();
      final quote = [line.replaceFirst(_quote, '')];
      while (i + 1 < lines.length && _quote.hasMatch(lines[i + 1])) {
        quote.add(lines[i + 1].replaceFirst(_quote, ''));
        i++;
      }
      blocks.add(QuoteBlock(quote.join('\n')));
      continue;
    }
    paragraph.add(line);
  }
  flush();
  return blocks;
}

// **bold**, *italic* / _italic_ (whole words only), `code`.
final _inline = RegExp(
  r'(`[^`\n]+`|\*\*[^*\n]+?\*\*|__[^_\n]+?__|(?<![\w*])\*(?!\s)[^*\n]+?(?<!\s)\*(?![\w*])|(?<![\w_])_(?!\s)[^_\n]+?(?<!\s)_(?![\w_]))',
);

enum InlineKind { text, code, strong, em }

/// One inline piece; [children] only for strong (which nests).
final class InlineToken {
  const InlineToken(this.kind, this.text, [this.children = const []]);
  final InlineKind kind;
  final String text;
  final List<InlineToken> children;
}

List<InlineToken> parseInline(String text) {
  final out = <InlineToken>[];
  var last = 0;
  for (final match in _inline.allMatches(text)) {
    final token = match[0]!;
    if (match.start > last) {
      out.add(InlineToken(InlineKind.text, text.substring(last, match.start)));
    }
    if (token.startsWith('`')) {
      out.add(
        InlineToken(InlineKind.code, token.substring(1, token.length - 1)),
      );
    } else if (token.startsWith('**') || token.startsWith('__')) {
      final inner = token.substring(2, token.length - 2);
      out.add(InlineToken(InlineKind.strong, inner, parseInline(inner)));
    } else {
      out.add(InlineToken(InlineKind.em, token.substring(1, token.length - 1)));
    }
    last = match.end;
  }
  if (last < text.length) {
    out.add(InlineToken(InlineKind.text, text.substring(last)));
  }
  return out;
}

final _arabicScript = RegExp(r'\p{Script=Arabic}', unicode: true);

/// Any Arabic in a line makes it read right-to-left, even when it starts
/// with an English term; pure-English lines stay LTR (the web's rule for
/// AI replies).
TextDirection richDirection(String text) =>
    _arabicScript.hasMatch(text) ? TextDirection.rtl : TextDirection.ltr;

/// Arrows point the reading way in a right-to-left line.
String forReading(String text) => richDirection(text) == TextDirection.rtl
    ? text.replaceAll('→', '←').replaceAll('⇒', '⇐')
    : text;

/// Renders an AI reply.
class NlRichText extends StatelessWidget {
  const NlRichText(this.text, {super.key, this.color = NlColors.ink});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final blocks = parseBlocks(tidySource(text));
    final base = NlText.body.copyWith(color: color, height: 1.7);
    final children = <Widget>[];
    for (final block in blocks) {
      children.add(switch (block) {
        CodeBlock(:final text) => Container(
          width: double.infinity,
          padding: const EdgeInsets.all(NlSpace.md),
          decoration: BoxDecoration(
            color: NlColors.paper,
            borderRadius: BorderRadius.circular(NlRadius.sm),
          ),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Text(
              text,
              textDirection: TextDirection.ltr,
              style: base.copyWith(fontFamily: 'monospace', fontSize: 13.5),
            ),
          ),
        ),
        HeadingBlock(:final level, :final text) => _para(
          forReading(text),
          base.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: switch (level) {
              1 => 19,
              2 => 17.5,
              _ => 16,
            },
          ),
        ),
        ListBlock(:final ordered, :final items) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (i, item) in items.indexed)
              Directionality(
                textDirection: richDirection(item),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 22,
                        child: Text(ordered ? '${i + 1}.' : '•', style: base),
                      ),
                      Expanded(child: _para(forReading(item), base)),
                    ],
                  ),
                ),
              ),
          ],
        ),
        TableBlock(:final header, :final rows) => Directionality(
          textDirection: richDirection(
            [...header, ...rows.expand((r) => r)].join(' '),
          ),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Table(
              defaultColumnWidth: const IntrinsicColumnWidth(),
              border: TableBorder.all(color: NlColors.rule),
              children: [
                TableRow(
                  decoration: const BoxDecoration(color: NlColors.paper),
                  children: [
                    for (final cell in header)
                      _cell(cell, base.copyWith(fontWeight: FontWeight.w600)),
                  ],
                ),
                for (final row in rows)
                  TableRow(
                    children: [
                      for (var c = 0; c < header.length; c++)
                        _cell(c < row.length ? row[c] : '', base),
                    ],
                  ),
              ],
            ),
          ),
        ),
        QuoteBlock(:final text) => Container(
          padding: const EdgeInsetsDirectional.only(start: NlSpace.md),
          decoration: const BoxDecoration(
            border: BorderDirectional(
              start: BorderSide(color: NlColors.ruleStrong, width: 3),
            ),
          ),
          child: _para(forReading(text), base.copyWith(color: NlColors.ink2)),
        ),
        RuleBlock() => const Divider(height: NlSpace.lg),
        ParagraphBlock(:final text) => _para(forReading(text), base),
      });
    }
    return SelectionArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, child) in children.indexed) ...[
            if (i > 0) const SizedBox(height: NlSpace.sm),
            child,
          ],
        ],
      ),
    );
  }

  static Widget _cell(String text, TextStyle style) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    child: Text.rich(TextSpan(children: inlineSpans(text, style))),
  );

  static Widget _para(String text, TextStyle style) => Text.rich(
    TextSpan(children: inlineSpans(text, style)),
    textDirection: richDirection(text),
    textAlign: TextAlign.start,
  );
}

List<InlineSpan> inlineSpans(String text, TextStyle style) => [
  for (final token in parseInline(text))
    switch (token.kind) {
      InlineKind.text => TextSpan(text: token.text, style: style),
      InlineKind.code => TextSpan(
        text: token.text,
        style: style.copyWith(
          fontFamily: 'monospace',
          backgroundColor: NlColors.paper,
        ),
      ),
      InlineKind.strong => TextSpan(
        children: inlineSpans(
          token.text,
          style.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
      InlineKind.em => TextSpan(
        text: token.text,
        style: style.copyWith(fontStyle: FontStyle.italic),
      ),
    },
];
