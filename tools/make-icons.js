/*
 * Generates the app icons as PNGs with no dependencies (Node's zlib only).
 *   node tools/make-icons.js
 * Draws two fanned playing cards (red heart behind, black spade in front) on green felt.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');

// ---------- Minimal PNG encoder ----------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Shapes (math coords: x right, y up, icon spans -1..1) ----------
function roundRectSDF(x, y, hw, hh, r) {
  const qx = Math.abs(x) - (hw - r);
  const qy = Math.abs(y) - (hh - r);
  const ox = Math.max(qx, 0); const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}
function inHeart(x, y) { // classic implicit heart, point at the bottom
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0;
}
function inSpade(x, y) { // upside-down heart plus a flared stem
  if (inHeart(x * 1.0, -(y - 0.25))) return true;
  if (y < -0.2 && y > -1.55) {
    const t = (-0.2 - y) / 1.35;           // 0 at top of stem, 1 at base
    const hw = 0.09 + 0.42 * t * t;
    return Math.abs(x) <= hw;
  }
  return false;
}
function toLocal(x, y, cx, cy, deg) {
  const a = -deg * Math.PI / 180;
  const dx = x - cx; const dy = y - cy;
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
}

const FELT_IN = [36, 138, 84]; const FELT_OUT = [9, 52, 30];
const WHITE = [253, 252, 248]; const EDGE = [200, 196, 186];
const RED = [208, 36, 58]; const BLACK = [21, 23, 28];
const CARD = { hw: 0.34, hh: 0.47, r: 0.075 };

function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function drawCard(col, x, y, cx, cy, deg, pips) {
  const [lx, ly] = toLocal(x, y, cx, cy, deg);
  // soft shadow
  const sd = roundRectSDF(lx - 0.02, ly + 0.035, CARD.hw, CARD.hh, CARD.r);
  if (sd < 0.06) col = mix(col, [0, 0, 0], 0.35 * Math.min(1, (0.06 - sd) / 0.06));
  const d = roundRectSDF(lx, ly, CARD.hw, CARD.hh, CARD.r);
  if (d > 0) return col;
  col = d > -0.012 ? EDGE : WHITE;
  for (const p of pips) {
    const px = (lx - p.x) / p.s; const py = (ly - p.y) / p.s;
    if (p.shape(px, py)) return p.color;
  }
  return col;
}

function shade(x, y, scale) {
  // background felt
  const rr = Math.min(1, Math.hypot(x, y + 0.2) / 1.35);
  let col = mix(FELT_IN, FELT_OUT, rr);
  x /= scale; y /= scale;
  col = drawCard(col, x, y, -0.2, 0.02, 14, [
    { shape: inHeart, x: -0.19, y: 0.28, s: 0.085, color: RED },
    { shape: inHeart, x: -0.04, y: -0.1, s: 0.18, color: RED },
  ]);
  col = drawCard(col, x, y, 0.19, -0.02, -9, [
    { shape: inSpade, x: -0.2, y: 0.3, s: 0.075, color: BLACK },
    { shape: inSpade, x: 0.02, y: 0.02, s: 0.2, color: BLACK },
  ]);
  return col;
}

function render(size, scale) {
  const SS = 4; // 4x4 supersampling for smooth edges
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0; let g = 0; let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ((px + (sx + 0.5) / SS) / size) * 2 - 1;
          const y = 1 - ((py + (sy + 0.5) / SS) / size) * 2;
          const c = shade(x, y, scale);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (py * size + px) * 4;
      const n = SS * SS;
      buf[i] = Math.round(r / n); buf[i + 1] = Math.round(g / n); buf[i + 2] = Math.round(b / n); buf[i + 3] = 255;
    }
  }
  return encodePNG(size, buf);
}

fs.mkdirSync(OUT, { recursive: true });
const jobs = [
  ['favicon-32.png', 32, 1.12],
  ['apple-touch-icon.png', 180, 1.0],
  ['icon-192.png', 192, 1.0],
  ['icon-512.png', 512, 1.0],
  ['icon-maskable-512.png', 512, 0.78], // content kept inside the maskable safe zone
];
for (const [name, size, scale] of jobs) {
  fs.writeFileSync(path.join(OUT, name), render(size, scale));
  console.log('wrote icons/' + name);
}
