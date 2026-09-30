// Runs the WEB match-game rules (lib/match-game.ts) with a deterministic
// random source and writes the results as the expected values for the Dart
// port's parity test (test/features/match/match_parity_test.dart). The same
// generator (mulberry32) is implemented in the test. Re-run after changing
// either side:
//   node_modules/.bin/esbuild mobile/tool/export_match_fixtures.ts \
//     --bundle --platform=node --format=cjs \
//     --outfile=node_modules/.cache/mg.cjs
//   node node_modules/.cache/mg.cjs > mobile/test/fixtures/match_web.json
import { buildMatchPairs, buildMatchTiles } from "../../lib/match-game";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cards = [
  { id: "c1", questionEn: "What is the antidote for heparin?", answerEn: "Protamine sulfate" },
  { id: "c2", questionEn: "  Loop   diuretic example? ", answerEn: "Furosemide" },
  { id: "c3", questionEn: "What is the antidote for heparin?", answerEn: "Protamine" },
  { id: "c4", questionEn: "Long question ".repeat(10), answerEn: "Too long to fit" },
  { id: "c5", questionEn: "Normal blood pH?", answerEn: "7.35–7.45" },
  { id: "c6", questionEn: "First-line for anaphylaxis?", answerEn: "IM adrenaline" },
  { id: "c7", questionEn: "Vitamin for scurvy?", answerEn: "Vitamin C" },
  { id: "c8", questionEn: "Short", answerEn: "A".repeat(80) },
  { id: "c9", questionEn: "Most common site of ectopic pregnancy?", answerEn: "Ampulla" },
];
const terms = [
  { id: "t1", en: "Hypokalaemia", ar: "نقص البوتاسيوم" },
  { id: "t2", en: "Furosemide", ar: "فوروسيميد" },
  { id: "t3", en: "Tachycardia", ar: "تسرع القلب" },
];

const cases = [
  { seed: 1, count: 6, cards, terms },
  { seed: 42, count: 6, cards, terms },
  { seed: 7, count: 3, cards: cards.slice(0, 3), terms },
  { seed: 99, count: 6, cards: [], terms },
];

console.log(
  JSON.stringify(
    {
      cards,
      terms,
      cases: cases.map(c => {
        const random = mulberry32(c.seed);
        const pairs = buildMatchPairs(c.cards, c.terms, c.count, random);
        const tiles = buildMatchTiles(pairs, random);
        return {
          seed: c.seed,
          count: c.count,
          cardCount: c.cards.length,
          pairs,
          tiles,
        };
      }),
    },
    null,
    2
  )
);
