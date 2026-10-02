import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/features/exam_focus/data/exam_focus_models.dart';
import 'package:nirolearn/features/exam_focus/domain/exam_focus_text.dart';

/// Expected values come from the WEB code itself
/// (tool/export_exam_focus_fixtures.ts → test/fixtures/exam_focus_web.json).
void main() {
  final fixtures = jsonDecode(
    File('test/fixtures/exam_focus_web.json').readAsStringSync(),
  ) as Map<String, Object?>;

  group('splitHighlights matches the web', () {
    for (final raw in fixtures['highlights']! as List) {
      final c = raw as Map<String, Object?>;
      test('"${c['text']}"', () {
        final expected = [
          for (final s in c['segments']! as List)
            (
              text: (s as Map)['text'] as String,
              highlight: s['highlight'] as bool,
            ),
        ];
        expect(splitHighlights(c['text']! as String), expected);
      });
    }
  });

  group('pagesLabel matches the web', () {
    for (final raw in fixtures['pages']! as List) {
      final c = raw as Map<String, Object?>;
      test('${c['pages']}', () {
        expect(
          pagesLabel([for (final p in c['pages']! as List) p as int]),
          c['label'],
        );
      });
    }
  });

  test('filter chips: only present categories, in priority order', () {
    final filters = visibleCategoryFilters({
      'definition': 3,
      'emergency': 1,
      'numbers': 0,
      'high_yield': 5,
    });
    expect(filters.map((f) => f.category), [
      'emergency',
      'high_yield',
      'definition',
    ]);
    expect(categoryInfo('unknown').label, 'High Yield');
  });

  test('stripBullet removes one leading bullet only', () {
    expect(stripBullet('• 15 mg/kg'), '15 mg/kg');
    expect(stripBullet('- a - b'), 'a - b');
    expect(stripBullet('no bullet'), 'no bullet');
  });
}
