// Exports Niro — the web app's in-house vector character
// (components/niro/NiroCharacter.tsx) — as static SVG files for the Flutter
// app, so both clients show exactly the same art. Re-run after changing the
// web component:
//
//   node_modules/.bin/esbuild mobile/tool/export_niro_svgs.tsx --bundle \
//     --platform=node --format=cjs --jsx=automatic --outfile=<tmp>/niro.cjs
//   node <tmp>/niro.cjs mobile/assets/niro
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import NiroCharacter from "@/components/niro/NiroCharacter";
import { NIRO_EXPRESSIONS } from "@/lib/niro";

const outDir = process.argv[2];
if (!outDir) throw new Error("usage: node niro.cjs <outDir>");
mkdirSync(outDir, { recursive: true });

// React's useId() ids («:R1:») aren't valid XML ids for every SVG renderer.
function cleanIds(svg: string): string {
  return svg.replace(/:(r|R)([0-9a-z]+):/g, "niro-$2");
}

function write(name: string, element: React.ReactElement) {
  const svg = cleanIds(renderToStaticMarkup(element)).replace(
    /^<svg /,
    '<svg xmlns="http://www.w3.org/2000/svg" '
  );
  writeFileSync(
    join(outDir, `${name}.svg`),
    `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`
  );
  console.log(name, svg.length);
}

for (const expression of NIRO_EXPRESSIONS) {
  write(`niro-${expression}`, <NiroCharacter expression={expression} />);
}
write("niro-avatar", <NiroCharacter expression="normal" crop="head" />);
