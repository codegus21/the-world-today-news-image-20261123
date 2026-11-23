// THE WORLD TODAY — Monday 23 November 2026.
// A newspaper front page drawn entirely in code: a pixel buffer, a small
// hand-built 5x7 bitmap font, and a hand-rolled PNG encoder (zlib deflate
// + manual PNG chunks). Node 22 standard library only, no network, and the
// same bytes on every run.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const W = 1024;
const H = 1024;

// ---- palette ------------------------------------------------------------
const PAPER: RGB = [246, 241, 227];
const INK: RGB = [18, 18, 18];
const RED: RGB = [158, 27, 27];
const BLUE: RGB = [29, 78, 137];
const GREY: RGB = [90, 86, 76];
const LIGHT: RGB = [232, 226, 208];
type RGB = [number, number, number];

// ---- pixel buffer -------------------------------------------------------
const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function setPix(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) setPix(i, j, c);
}

function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
}

// ---- PNG encoder --------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- 5x7 bitmap font (hand-built, one row per number, bit 4 = left pixel) --
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31],
  "3": [30, 1, 1, 14, 1, 1, 30],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  ":": [0, 12, 12, 0, 12, 12, 0],
  ";": [0, 12, 12, 0, 12, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 6, 4, 0, 4],
  "-": [0, 0, 0, 14, 0, 0, 0],
  "—": [0, 0, 0, 31, 0, 0, 0],
  "–": [0, 0, 0, 14, 0, 0, 0],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "’": [4, 4, 8, 0, 0, 0, 0],
  '"': [10, 10, 10, 0, 0, 0, 0],
  "“": [10, 10, 10, 0, 0, 0, 0],
  "”": [10, 10, 10, 0, 0, 0, 0],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "/": [1, 1, 2, 4, 8, 16, 16],
  "%": [25, 25, 2, 4, 8, 19, 19],
  $: [4, 15, 20, 14, 5, 30, 4],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "+": [0, 4, 4, 14, 4, 4, 0],
  "=": [0, 0, 14, 0, 14, 0, 0],
  "*": [0, 4, 21, 14, 21, 4, 0],
  "•": [0, 4, 14, 14, 14, 4, 0],
};

function glyph(ch: string): number[] {
  return FONT[ch.toUpperCase()] ?? FONT[" "]!;
}

// Draw one line of text. Returns the width in pixels.
function drawText(x: number, y: number, text: string, s: number, c: RGB, bold = false): number {
  let cx = x;
  for (const ch of text) {
    const g = glyph(ch);
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if ((g[r]! >> (4 - col)) & 1) {
          fillRect(cx + col * s, y + r * s, s, s, c);
          if (bold) fillRect(cx + col * s + 1, y + r * s, s, s, c);
        }
      }
    }
    cx += 6 * s;
  }
  return cx - x - s;
}

function textWidth(text: string, s: number): number {
  return text.length * 6 * s - s;
}

function drawCentred(y: number, text: string, s: number, c: RGB, bold = false): void {
  drawText(Math.round((W - textWidth(text, s)) / 2), y, text, s, c, bold);
}

// Greedy word wrap to a maximum pixel width. Returns the lines.
function wrap(text: string, s: number, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, s) <= maxW || !cur) cur = trial;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draw wrapped text; returns the y just below the last line.
function drawWrapped(x: number, y: number, text: string, s: number, maxW: number, c: RGB, bold = false): number {
  const lh = 7 * s + (s >= 2 ? 3 : 2);
  for (const line of wrap(text, s, maxW)) {
    drawText(x, y, line, s, c, bold);
    y += lh;
  }
  return y;
}

// ---- globe emblem -------------------------------------------------------
function drawGlobe(cx: number, cy: number, r: number, c: RGB): void {
  // Circle outline, equator and meridian ellipses, plotted point by point.
  for (let a = 0; a < 360; a += 1) {
    const t = (a * Math.PI) / 180;
    const ox = Math.round(cx + r * Math.cos(t));
    const oy = Math.round(cy + r * Math.sin(t));
    fillRect(ox, oy, 2, 2, c);
    fillRect(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * 0.34 * Math.sin(t)), 2, 2, c);
    fillRect(Math.round(cx + r * 0.34 * Math.cos(t)), Math.round(cy + r * Math.sin(t)), 2, 2, c);
    // A tilted land band, to suggest continents without drawing any map.
    if (a % 3 === 0) {
      const lx = Math.round(cx + (r - 8) * Math.cos(t + 0.6));
      const ly = Math.round(cy + (r - 8) * Math.sin(t + 0.6) * 0.8);
      if ((lx - cx) * (lx - cx) + (ly - cy) * (ly - cy) < (r - 6) * (r - 6)) fillRect(lx, ly, 3, 3, c);
    }
  }
}

// ---- the day's stories --------------------------------------------------
// Every story below was reported on Monday 23 November 2026 (Asia-Pacific
// morning editions and wires). Headline + one factual deck line each.
interface Story {
  h: string;
  d: string;
}
interface Section {
  name: string;
  stories: Story[];
}

const LEAD_HEAD = ["NO DEAL ON FOSSIL FUELS", "AS LONGEST COP ENDS IN FAILURE"];
const LEAD_DECK =
  "The Antalya Pact falls: the EU refuses a deal that never names fossil fuels.";

const COLUMNS: Section[][] = [
  [
    {
      name: "WORLD",
      stories: [
        { h: "UN KEEPS TALKING ON KILLER ROBOTS", d: "Nations extend talks on lethal AI arms; no ban." },
        { h: "DEMOCRATS SEAL HISTORIC HOUSE WIN", d: "At least 258 seats, the most since 1992." },
        { h: "FBI CRIME DATABASE HACKED", d: "Trump confirms a breach of the crime database." },
        { h: "MEXICO NABS FBI MOST-WANTED BOSS", d: "'El Chapo Isidro' captured; 11 die in Sinaloa." },
        { h: "THOUSANDS MARCH IN LISBON", d: "Living costs fuel anger in the capital's streets." },
      ],
    },
    {
      name: "EUROPE",
      stories: [
        { h: "14 MISSING AFTER DRONE HITS KYIV FLATS", d: "A Russian drone struck a building in Kyiv region." },
        { h: "RUSSIAN SHIP STILL BURNING OFF FINLAND", d: "Cargo vessel ablaze after an attack at sea." },
        { h: "UKRAINE PUSHES BACK NEAR SUMY", d: "Pro-Russia channels report a retreat near Sumy." },
        { h: "NATO FOR DONBAS? US ENVOYS FLOAT DEAL", d: "Membership floated in exchange for the Donbas." },
        { h: "POLAND: RUSSIA TRIED TO KILL RAPPER", d: "Moscow twice targeted a Ukrainian-US rapper." },
        { h: "AUSTRALIA REBUKES US OVER AUKUS", d: "Canberra condemns budget office comments on AUKUS." },
      ],
    },
  ],
  [
    {
      name: "GULF & ENERGY",
      stories: [
        { h: "IRAN HITS US BASES IN BAHRAIN", d: "Two hurt; Tehran claims Patriot radars were hit." },
        { h: "HOUTHI MISSILES AT SAUDI ARABIA DOWNED", d: "Coalition says it downed missiles fired westward." },
        { h: "MORE TANKERS HIT NEAR HORMUZ", d: "UKMTO reports a tanker incident off Oman." },
        { h: "IRAN READIES TANKERS TO TEST BLOCKADE", d: "Tehran calls the US blockade 'an act of war'." },
        { h: "BRENT HOLDS NEAR $92 ON GULF FEARS", d: "Oil steadies as Gulf shipping stays at risk." },
        { h: "PAKISTAN HOPES FOR US-IRAN DEAL", d: "Foreign minister warns against a prolonged war." },
      ],
    },
    {
      name: "ASIA-PACIFIC",
      stories: [
        { h: "NEPAL PM MEETS MODI IN DELHI", d: "Balendra Shah holds talks on a state visit." },
        { h: "INDIA'S RS 4,000-CRORE PUSH IN ARUNACHAL", d: "Amit Shah launches projects in the border state." },
        { h: "SEOUL MINISTER QUITS OVER AI CHEATING", d: "Education chief quits in an AI exam scandal." },
        { h: "JAVA FACTORY SEARCH RESUMES TODAY", d: "24 body bags removed; dozens still missing." },
        { h: "MYANMAR CALLS ASEAN MOVE 'UNFAIR'", d: "Army-backed government hits back at the bloc." },
        { h: "MALAYSIA BACKS UN, OIC ON MYANMAR", d: "Kuala Lumpur to coordinate after the ICJ ruling." },
      ],
    },
  ],
  [
    {
      name: "AMERICAS & TECH",
      stories: [
        { h: "US PRESSES NVIDIA OVER CHINA CHIPS", d: "Bessent seeks answers on the firm's China sales." },
        { h: "NVIDIA ROW: AIDE TIED TO CHIP NETWORK", d: "Alice Huang tied to a secret chip diversion route." },
        { h: "US CLEARED 900,000 AI CHIPS FOR CHINA", d: "Nearly a million Nvidia and AMD chips approved." },
      ],
    },
    {
      name: "MARKETS",
      stories: [
        { h: "FUTURES BOUNCE AS ASIA BRACES", d: "Nasdaq futures up 2%; Japan shut for a holiday." },
        { h: "GOLD NEAR $3,515 AFTER BRUTAL WEEK", d: "Bitcoin slides toward $55,000 as selling drags on." },
      ],
    },
    {
      name: "SCIENCE & SPACE",
      stories: [
        { h: "ARIANE 64 TO LAUNCH AMAZON LEO TODAY", d: "Lift-off 11:09 UTC with broadband satellites." },
      ],
    },
    {
      name: "SPORT",
      stories: [
        { h: "LIVERPOOL 4-0 MAN UTD", d: "Pochettino's debut ends in a rout at Anfield." },
        { h: "INDIA'S RECORD 720/9 IN WELLINGTON", d: "Visitors pile up a record Test total in Wellington." },
        { h: "ANUPAMA KEEPS WORLD SNOOKER CROWN", d: "Indian star defends her women's world title." },
      ],
    },
  ],
];

const MARGIN = 28;
const COL_W = 304;
const GUT = 14;
const COL_X = [MARGIN, MARGIN + COL_W + GUT, MARGIN + 2 * (COL_W + GUT)];

function drawSectionHeader(x: number, y: number, name: string): number {
  fillRect(x, y, COL_W, 24, INK);
  drawText(x + 8, y + 5, name, 2, PAPER, true);
  return y + 30;
}

function drawStory(x: number, y: number, s: Story): number {
  // Red square bullet, then a bold headline and a plain deck line.
  fillRect(x, y + 2, 8, 8, RED);
  let ny = drawWrapped(x + 14, y, s.h, 2, COL_W - 14, INK, true);
  ny = drawWrapped(x + 14, ny + 1, s.d, 1, COL_W - 14, GREY);
  return ny + 6;
}

// ---- compose the front page ---------------------------------------------
function compose(): void {
  // Masthead: globe, title, red date box.
  drawGlobe(72, 58, 40, BLUE);
  drawText(132, 30, "THE WORLD TODAY", 7, INK, true);
  fillRect(872, 22, 124, 78, RED);
  drawText(906, 30, "23", 5, PAPER, true);
  drawText(910, 68, "NOV 2026", 1, PAPER, true);
  hline(MARGIN, 116, W - 2 * MARGIN, INK, 3);
  drawCentred(128, "MONDAY, 23 NOVEMBER 2026", 2, INK, true);
  drawCentred(150, "33 STORIES FROM EVERY REGION - ONE DAY, ONE PAGE", 1, GREY);
  hline(MARGIN, 168, W - 2 * MARGIN, INK, 1);

  // Lead story: COP31.
  let y = 182;
  drawText(MARGIN, y, "CLIMATE - COP31 COLLAPSES IN ANTALYA", 2, RED, true);
  y += 30;
  for (const line of LEAD_HEAD) {
    drawText(MARGIN, y, line, 4, INK, true);
    y += 34;
  }
  y = drawWrapped(MARGIN, y + 2, LEAD_DECK, 2, W - 2 * MARGIN, INK);
  hline(MARGIN, y + 8, W - 2 * MARGIN, INK, 3);

  // Three columns of sections.
  let colTop = y + 14;
  let deepest = colTop;
  COLUMNS.forEach((sections, ci) => {
    let cy = colTop;
    const x = COL_X[ci]!;
    for (const sec of sections) {
      cy = drawSectionHeader(x, cy, sec.name);
      for (const st of sec.stories) cy = drawStory(x, cy, st);
      cy += 2;
    }
    if (cy > deepest) deepest = cy;
  });

  // Footer.
  hline(MARGIN, 996, W - 2 * MARGIN, INK, 2);
  drawCentred(1006, "THE WORLD TODAY - MONDAY 23 NOVEMBER 2026 - EVERY STORY REPORTED TODAY", 1, GREY);
  if (deepest > 990) console.error("WARNING: columns run to y=" + deepest);
  else console.error("columns end at y=" + deepest);
}

function main(): void {
  compose();
  const out = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(out, { recursive: true });
  writeFileSync(out + "/entry.png", encodePng());
}

main();
