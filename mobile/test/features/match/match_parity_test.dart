import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/features/match/domain/match_game.dart';

/// The web tool's deterministic generator (mulberry32), in 32-bit math.
RandomSource mulberry32(int seed) {
  var a = seed & 0xFFFFFFFF;
  int imul(int x, int y) => (x * y) & 0xFFFFFFFF;
  return () {
    a = (a + 0x6d2b79f5) & 0xFFFFFFFF;
    var t = a;
    t = imul(t ^ (t >> 15), t | 1);
    t = (t ^ ((t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF;
    return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296;
  };
}

/// Expected values come from the WEB code (lib/match-game.ts) itself —
/// tool/export_match_fixtures.ts → test/fixtures/match_web.json.
void main() {
  final fixture = jsonDecode(
    File('test/fixtures/match_web.json').readAsStringSync(),
  ) as Map<String, Object?>;
  final cards = [
    for (final c in fixture['cards']! as List)
      (
        id: (c as Map)['id'] as String,
        questionEn: c['questionEn'] as String,
        answerEn: c['answerEn'] as String,
      ),
  ];
  final terms = [
    for (final t in fixture['terms']! as List)
      (
        id: (t as Map)['id'] as String,
        en: t['en'] as String,
        ar: t['ar'] as String,
      ),
  ];

  for (final raw in fixture['cases']! as List) {
    final c = raw as Map<String, Object?>;
    test('seed ${c['seed']}: same pairs and tile order as the web', () {
      final random = mulberry32(c['seed']! as int);
      final pairs = buildMatchPairs(
        cards.take(c['cardCount']! as int).toList(),
        terms,
        count: c['count']! as int,
        random: random,
      );
      final tiles = buildMatchTiles(pairs, random: random);
      expect(
        [
          for (final p in pairs) [p.id, p.prompt, p.answer],
        ],
        [
          for (final p in c['pairs']! as List)
            [(p as Map)['id'], p['prompt'], p['answer']],
        ],
      );
      expect(
        [
          for (final t in tiles) [t.id, t.pairId, t.text, t.kind.name],
        ],
        [
          for (final t in c['tiles']! as List)
            [(t as Map)['id'], t['pairId'], t['text'], t['kind']],
        ],
      );
    });
  }

  test('isMatch: two halves of the same pair only', () {
    final pairs = buildMatchPairs(cards, terms, random: mulberry32(3));
    final tiles = buildMatchTiles(pairs, random: mulberry32(4));
    final first = tiles.first;
    final partner = tiles.firstWhere(
      (t) => t.pairId == first.pairId && t.id != first.id,
    );
    final other = tiles.firstWhere((t) => t.pairId != first.pairId);
    expect(isMatch(first, partner), isTrue);
    expect(isMatch(first, first), isFalse);
    expect(isMatch(first, other), isFalse);
  });
}
