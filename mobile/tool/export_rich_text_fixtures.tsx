// Runs the WEB reply renderer's pure parts (components/assistant/
// RichText.tsx: tidySource, parseBlocks, renderInline, textDirection,
// forReading) on sample replies and writes the results as the expected
// values for the Dart port's parity test
// (test/core/ui/rich_text_parity_test.dart). Re-run after changing either:
//   node_modules/.bin/esbuild mobile/tool/export_rich_text_fixtures.tsx \
//     --bundle --platform=node --format=cjs --jsx=automatic \
//     --outfile=<tmp>/rt.cjs
//   node <tmp>/rt.cjs > mobile/test/fixtures/rich_text_web.json
import { renderToStaticMarkup } from "react-dom/server";
import {
  forReading,
  parseBlocks,
  renderInline,
  textDirection,
  tidySource,
} from "../../components/assistant/RichText";

const replies = [
  "## الفكرة الأساسية\nالـ **ACE inhibitor** يقلل تكوين *angiotensin II*.\n\n- يخفض الضغط\n- يحمي الكلى\n  خاصة عند السكري\n- قد يسبب `dry cough`",
  "1. Read the stem\n2. Eliminate wrong options\n3) Pick the best answer",
  "| Drug | Class |\n|---|:---:|\n| Furosemide | Loop |\n| Spironolactone | K-sparing |",
  String.raw`The dose is \(\frac{5}{2}\) mg \times 3 = 7.5 mg, and x^2 + y^{3} \approx 10 \text{ units}.` +
    "\n" +
    String.raw`\[ a \leq b \Rightarrow c \] and \sqrt{x} \pm 1`,
  "```\n" + String.raw`const x = 2 * 3; // \times stays` + "\n```\nبعد الكود → نتيجة",
  "> ملاحظة: WHZ < -3 SD → سوء تغذية شديد\n> راجع الجدول\n\n---\n# Title #",
  "snake_case and 2*3*4 stay plain, but _this_ and *that* are italic; __bold__ too.",
  "**nested `code` inside bold** then plain & <tag> \"quoted\" 'single'",
  "",
  "Line one\nline two\r\nline three",
];

type Block = ReturnType<typeof parseBlocks>[number];
const inlineTexts = (b: Block): string[] => {
  switch (b.kind) {
    case "list":
      return b.items;
    case "table":
      return [...b.header, ...b.rows.flat()];
    case "rule":
      return [];
    default:
      return [b.text];
  }
};

console.log(
  JSON.stringify(
    replies.map(reply => {
      const tidy = tidySource(reply);
      const blocks = parseBlocks(tidy);
      return {
        reply,
        tidy,
        blocks,
        inline: blocks.flatMap(inlineTexts).map(text => ({
          text,
          html: renderToStaticMarkup(<>{renderInline(text)}</>),
          dir: textDirection(text),
          reading: forReading(text),
        })),
      };
    }),
    null,
    1
  )
);
