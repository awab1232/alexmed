// The web's match-game rules (lib/match-game.ts) — client-side on the web
// too (no server endpoint), so they are ported here and proven identical by
// test/features/match/match_parity_test.dart, which runs against the web
// code's own output (tool/export_match_fixtures.ts) with the same
// deterministic random source.

typedef RandomSource = double Function();

final class MatchPair {
  const MatchPair({
    required this.id,
    required this.prompt,
    required this.answer,
  });

  final String id;
  final String prompt;
  final String answer;
}

enum TileKind { prompt, answer }

final class MatchTile {
  const MatchTile({
    required this.id,
    required this.pairId,
    required this.text,
    required this.kind,
  });

  final String id;
  final String pairId;
  final String text;
  final TileKind kind;
}

/// Tiles are small — long card text doesn't fit.
const _maxPromptChars = 90;
const _maxAnswerChars = 70;

/// Each wrong match adds a one-second penalty, like Quizlet.
const mismatchPenalty = Duration(seconds: 1);

List<T> _shuffle<T>(List<T> items, RandomSource random) {
  final copy = [...items];
  for (var i = copy.length - 1; i > 0; i--) {
    final j = (random() * (i + 1)).floor();
    final t = copy[i];
    copy[i] = copy[j];
    copy[j] = t;
  }
  return copy;
}

final _spaces = RegExp(r'\s+');
String _clean(String text) => text.replaceAll(_spaces, ' ').trim();

List<MatchPair> buildMatchPairs(
  List<({String id, String questionEn, String answerEn})> cards,
  List<({String id, String en, String ar})> terms, {
  int count = 6,
  required RandomSource random,
}) {
  final seen = <String>{};
  final pairs = <MatchPair>[];
  void add(String id, String prompt, String answer) {
    final key = prompt.toLowerCase();
    final answerKey = 'a:${answer.toLowerCase()}';
    if (prompt.isEmpty ||
        answer.isEmpty ||
        seen.contains(key) ||
        seen.contains(answerKey)) {
      return;
    }
    seen
      ..add(key)
      ..add(answerKey);
    pairs.add(MatchPair(id: id, prompt: prompt, answer: answer));
  }

  for (final card in _shuffle(cards, random)) {
    if (pairs.length >= count) break;
    final prompt = _clean(card.questionEn);
    final answer = _clean(card.answerEn);
    if (prompt.length <= _maxPromptChars && answer.length <= _maxAnswerChars) {
      add('card-${card.id}', prompt, answer);
    }
  }
  for (final term in _shuffle(terms, random)) {
    if (pairs.length >= count) break;
    final en = _clean(term.en);
    final ar = _clean(term.ar);
    if (en.length <= _maxPromptChars && ar.length <= _maxAnswerChars) {
      add('term-${term.id}', en, ar);
    }
  }
  return pairs;
}

List<MatchTile> buildMatchTiles(
  List<MatchPair> pairs, {
  required RandomSource random,
}) => _shuffle([
  for (final pair in pairs) ...[
    MatchTile(
      id: '${pair.id}:p',
      pairId: pair.id,
      text: pair.prompt,
      kind: TileKind.prompt,
    ),
    MatchTile(
      id: '${pair.id}:a',
      pairId: pair.id,
      text: pair.answer,
      kind: TileKind.answer,
    ),
  ],
], random);

/// Two tapped tiles match when they are the two halves of the same pair.
bool isMatch(MatchTile a, MatchTile b) => a.pairId == b.pairId && a.id != b.id;
