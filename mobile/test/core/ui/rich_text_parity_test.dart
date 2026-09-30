import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/ui/rich_text.dart';

/// The reply renderer must parse exactly like the web's
/// components/assistant/RichText.tsx — expected values are that code's own
/// output (tool/export_rich_text_fixtures.tsx).
Object? blockJson(RichBlock b) => switch (b) {
  CodeBlock(:final text) => {'kind': 'code', 'text': text},
  HeadingBlock(:final level, :final text) => {
    'kind': 'heading',
    'level': level,
    'text': text,
  },
  ListBlock(:final ordered, :final items) => {
    'kind': 'list',
    'ordered': ordered,
    'items': items,
  },
  TableBlock(:final header, :final rows) => {
    'kind': 'table',
    'header': header,
    'rows': rows,
  },
  QuoteBlock(:final text) => {'kind': 'quote', 'text': text},
  RuleBlock() => {'kind': 'rule'},
  ParagraphBlock(:final text) => {'kind': 'paragraph', 'text': text},
};

// renderToStaticMarkup's escaping.
String esc(String s) => s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');

String html(List<InlineToken> tokens) => tokens.map((t) {
  return switch (t.kind) {
    InlineKind.text => esc(t.text),
    InlineKind.code => '<code>${esc(t.text)}</code>',
    InlineKind.strong => '<strong>${html(t.children)}</strong>',
    InlineKind.em => '<em>${esc(t.text)}</em>',
  };
}).join();

void main() {
  final cases = (jsonDecode(
    File('test/fixtures/rich_text_web.json').readAsStringSync(),
  ) as List).cast<Map<String, Object?>>();

  test('fixtures exist', () => expect(cases, hasLength(10)));

  for (final (i, c) in cases.indexed) {
    test('reply $i', () {
      final tidy = tidySource(c['reply']! as String);
      expect(tidy, c['tidy']);
      expect(parseBlocks(tidy).map(blockJson).toList(), c['blocks']);
      for (final inline
          in (c['inline']! as List).cast<Map<String, Object?>>()) {
        final text = inline['text']! as String;
        expect(html(parseInline(text)), inline['html'], reason: text);
        expect(
          richDirection(text) == TextDirection.rtl ? 'rtl' : 'ltr',
          inline['dir'],
          reason: text,
        );
        expect(forReading(text), inline['reading'], reason: text);
      }
    });
  }
}
