// Generates the PWA icons into public/icons/ with no dependencies:
// a yellow night bus seen from the front, under a moon.
//   node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
const BG = [11, 13, 26];
const SKY = [26, 22, 60];
const BUS = [255, 209, 102];
const DARK = [20, 20, 30];
const GLASS = [60, 70, 130];
const LIGHT = [255, 245, 200];
const MOON = [240, 236, 210];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
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
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

/** Colour at unit coordinates (0..1). `pad` shrinks the artwork for the maskable safe zone. */
function sample(u, v, pad) {
  const x = (u - pad) / (1 - 2 * pad);
  const y = (v - pad) / (1 - 2 * pad);
  // Moon (crescent).
  if (inCircle(x, y, 0.8, 0.17, 0.09) && !inCircle(x, y, 0.84, 0.14, 0.08)) return MOON;
  // Bus body.
  if (inRoundRect(x, y, 0.18, 0.28, 0.82, 0.86, 0.08)) {
    if (inRoundRect(x, y, 0.25, 0.34, 0.75, 0.38, 0.015)) return DARK; // destination sign
    if (inRoundRect(x, y, 0.24, 0.42, 0.76, 0.62, 0.04)) return GLASS; // windscreen
    if (inCircle(x, y, 0.3, 0.74, 0.045) || inCircle(x, y, 0.7, 0.74, 0.045)) return LIGHT;
    if (y > 0.8) return DARK; // bumper
    return BUS;
  }
  // Wheels.
  if (y > 0.84 && y < 0.92 && ((x > 0.24 && x < 0.34) || (x > 0.66 && x < 0.76))) return DARK;
  // Sky gradient behind.
  const t = Math.min(1, Math.max(0, v));
  return BG.map((c, i) => Math.round(c + (SKY[i] - c) * t));
}

function render(size, pad) {
  const ss = 3; // supersampling for smooth edges
  const buf = Buffer.alloc(size * size * 3);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size, pad);
          for (let i = 0; i < 3; i++) acc[i] += c[i];
        }
      }
      for (let i = 0; i < 3; i++) buf[(py * size + px) * 3 + i] = Math.round(acc[i] / (ss * ss));
    }
  }
  return png(size, buf);
}

mkdirSync(OUT, { recursive: true });
const icons = [
  ['icon-192.png', 192, 0.04],
  ['icon-512.png', 512, 0.04],
  // Maskable: artwork inside the central 80 % safe zone.
  ['icon-maskable-512.png', 512, 0.12],
  ['apple-touch-icon-180.png', 180, 0.06],
  ['favicon-64.png', 64, 0],
];
for (const [name, size, pad] of icons) {
  writeFileSync(new URL(name, OUT), render(size, pad));
  console.log(`wrote public/icons/${name}`);
}
