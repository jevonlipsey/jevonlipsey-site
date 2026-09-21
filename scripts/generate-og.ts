// renders public/og.png from an inline svg template.
// uses @resvg/resvg-js so the card stays fully editable in-repo.
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "og.png",
);
const WIDTH = 1200;
const HEIGHT = 630;
const BG = "#0a0a0a";
const INK = "#fafafa";
const MUTED = "#a1a1aa";
const DIM = "#71717a";
const LINE = "#27272a";

// ---- content & toggles ----
const eyebrow = "JEVON LIPSEY — HUMAN-ROBOT INTERACTION";
const subline = "ph.d. researcher · colorado school of mines · mirrorlab";
const tags = "social robotics · neurosymbolic ai · computational redistricting";

// 🎛️ Toggle these whenever you want to show/hide lines!
const SHOW_SUBLINE = true;
const SHOW_TAGS = false; // Safe to turn true/false without breaking layout

// Build the dynamic footer group elements
const footerLines: string[] = [];
if (SHOW_SUBLINE) {
  footerLines.push(
    `<text x="0" y="0" font-family="Menlo, Monaco, monospace" font-size="22" fill="${MUTED}">${subline}</text>`,
  );
}
if (SHOW_TAGS) {
  const yOffset = SHOW_SUBLINE ? 40 : 0;
  footerLines.push(
    `<text x="0" y="${yOffset}" font-family="Menlo, Monaco, monospace" font-size="20" fill="${DIM}">${tags}</text>`,
  );
}

const shapes = [
  // Background & Header
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>`,
  `<rect x="80" y="90" width="${WIDTH - 160}" height="2" fill="${LINE}"/>`,
  `<text x="80" y="65" font-family="Menlo, Monaco, monospace" font-size="20" fill="${MUTED}" letter-spacing="3">${eyebrow}</text>`,
  `<text x="${WIDTH - 80}" y="65" font-family="Menlo, Monaco, monospace" font-size="20" fill="${DIM}" text-anchor="end">@jevonlipsey</text>`,

  // Main Title ("jevon lipsey.")
  `<text x="78" y="270" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="168" font-weight="700" fill="${INK}" letter-spacing="-4">jevon</text>`,
  `<text x="78" y="440" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="168" font-weight="700" fill="${INK}" letter-spacing="-4">lipsey<tspan fill="${MUTED}">.</tspan></text>`,

  // Footer Group: Anchored cleanly at Y=525. Whether tags are on or off, it never shifts the title above.
  `<g transform="translate(80, 525)">
     ${footerLines.join("\n     ")}
   </g>`,
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${shapes.join("")}</svg>`;

const resvg = new Resvg(svg, { font: { loadSystemFonts: true } });
const png = resvg.render().asPng();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${Buffer.byteLength(png)} bytes)`);
