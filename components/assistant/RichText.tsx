import { Fragment, type ReactNode } from "react";

// Renders an assistant reply's light Markdown (what chat models naturally
// write): headings, **bold**, *italic*, `code`, fenced code blocks, bullet
// and numbered lists, simple pipe tables and paragraphs. Builds React
// elements directly — no HTML strings, so model output can never inject
// markup. Anything it doesn't recognise stays plain text. Every block gets
// dir="auto" so Arabic and English lines each align naturally.

type Block =
  | { kind: "code"; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "quote"; text: string }
  | { kind: "rule" }
  | { kind: "paragraph"; text: string };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}(#{1,4})\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

// Models often answer math in LaTeX (\[ … \], \frac{a}{b}, \times, \text{…})
// even when asked not to; there's no math renderer here, so turn the common
// commands into readable Unicode instead of showing backslash soup.
const LATEX_SYMBOLS: [RegExp, string][] = [
  [/\\times(?![a-zA-Z])/g, "×"],
  [/\\cdot(?![a-zA-Z])/g, "·"],
  [/\\div(?![a-zA-Z])/g, "÷"],
  [/\\approx(?![a-zA-Z])/g, "≈"],
  [/\\neq?(?![a-zA-Z])/g, "≠"],
  [/\\leq?(?![a-zA-Z])/g, "≤"],
  [/\\geq?(?![a-zA-Z])/g, "≥"],
  [/\\pm(?![a-zA-Z])/g, "±"],
  [/\\(?:rightarrow|to)(?![a-zA-Z])/g, "→"],
  [/\\Rightarrow(?![a-zA-Z])/g, "⇒"],
  [/\\leftarrow(?![a-zA-Z])/g, "←"],
  [/\\infty(?![a-zA-Z])/g, "∞"],
  [/\\Delta(?![a-zA-Z])/g, "Δ"],
  [/\\alpha(?![a-zA-Z])/g, "α"],
  [/\\beta(?![a-zA-Z])/g, "β"],
  [/\\mu(?![a-zA-Z])/g, "μ"],
  [/\\pi(?![a-zA-Z])/g, "π"],
  [/\\theta(?![a-zA-Z])/g, "θ"],
  [/\\%/g, "%"],
];

export function tidyMath(line: string): string {
  let text = line
    .replace(/\\\[|\\\]|\$\$/g, "")
    .replace(/\\\(|\\\)/g, "")
    .replace(/\\(?:left|right)(?![a-zA-Z])/g, "");
  for (let pass = 0; pass < 3; pass++) {
    text = text
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
      .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
      .replace(
        /\\(?:text|mathrm|mathbf|textbf|operatorname|mathit)\{([^{}]*)\}/g,
        "$1"
      );
  }
  for (const [pattern, symbol] of LATEX_SYMBOLS) {
    text = text.replace(pattern, symbol);
  }
  return text
    .replace(/\\[,;: ]/g, " ")
    .replace(/\\!/g, "")
    .replace(/\^\{?2\}?(?![\d{])/g, "²")
    .replace(/\^\{?3\}?(?![\d{])/g, "³")
    .replace(/\^\{([^{}]*)\}/g, "^$1")
    .replace(/_\{([^{}]*)\}/g, "_$1")
    // Collapse the gaps left behind (not leading indentation, which marks
    // list-item continuations).
    .replace(/(\S) {2,}/g, "$1 ");
}

// tidyMath on every line outside ``` code blocks.
export function tidySource(source: string): string {
  let inCode = false;
  return source
    .split("\n")
    .map(line => {
      if (/^\s*```/.test(line)) {
        inCode = !inCode;
        return line;
      }
      return inCode ? line : tidyMath(line);
    })
    .join("\n");
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map(cell => cell.trim());
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flush();
      blocks.push({ kind: "rule" });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        text: heading[2].replace(/\s#+\s*$/, ""),
      });
      continue;
    }
    if (TABLE_ROW.test(line) && TABLE_DIVIDER.test(lines[i + 1] ?? "")) {
      flush();
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      i--;
      blocks.push({ kind: "table", header, rows });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flush();
      const ordered = !!numbered;
      const items: string[] = [(bullet ?? numbered)![1]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        const match = (ordered ? NUMBERED : BULLET).exec(next);
        if (match) {
          items.push(match[1]);
          i++;
        } else if (/^\s{2,}\S/.test(next) && !BULLET.test(next)) {
          // Indented continuation of the previous item.
          items[items.length - 1] += `\n${next.trim()}`;
          i++;
        } else {
          break;
        }
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flush();
      const quote = [line.replace(/^\s*>\s?/, "")];
      while (i + 1 < lines.length && /^\s*>\s?/.test(lines[i + 1])) {
        quote.push(lines[i + 1].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", text: quote.join("\n") });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}

// **bold**, *italic* / _italic_ (whole words only), `code`.
const INLINE =
  /(`[^`\n]+`|\*\*[^*\n]+?\*\*|__[^_\n]+?__|(?<![\w*])\*(?!\s)[^*\n]+?(?<!\s)\*(?![\w*])|(?<![\w_])_(?!\s)[^_\n]+?(?<!\s)_(?![\w_]))/g;

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    if (token.startsWith("`")) {
      out.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      out.push(<strong key={key++}>{renderInline(token.slice(2, -2))}</strong>);
    } else {
      out.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function withLineBreaks(text: string) {
  const lines = text.split("\n");
  return lines.map((line, index) => (
    <Fragment key={index}>
      {renderInline(line)}
      {index < lines.length - 1 && <br />}
    </Fragment>
  ));
}

export default function RichText({ text }: { text: string }) {
  const blocks = parseBlocks(tidySource(text));
  return (
    <div className="rich-text">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "code":
            return (
              <pre key={index} dir="ltr">
                <code>{block.text}</code>
              </pre>
            );
          case "heading":
            return (
              <p
                key={index}
                dir="auto"
                className={`rich-heading is-h${Math.min(block.level, 3)}`}
              >
                {renderInline(block.text)}
              </p>
            );
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag key={index} dir="auto">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{withLineBreaks(item)}</li>
                ))}
              </Tag>
            );
          }
          case "table":
            return (
              <div key={index} className="rich-table-wrap">
                <table dir="auto">
                  <thead>
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex}>{renderInline(cell)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{renderInline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "quote":
            return (
              <blockquote key={index} dir="auto">
                {withLineBreaks(block.text)}
              </blockquote>
            );
          case "rule":
            return <hr key={index} />;
          default:
            return (
              <p key={index} dir="auto">
                {withLineBreaks(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
