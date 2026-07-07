'use strict';

// Generates assets/icon.ico — a simple 256x256 32bpp icon (dark tile + accent
// terminal chevron ">_") with no external deps. Run: node scripts/gen-icon.js
const fs = require('fs');
const path = require('path');

const SIZE = 256;
const bg = [0x14, 0x12, 0x12]; // BGR of #12141a-ish
const accent = [0xff, 0x8c, 0x5b]; // BGR of #5b8cff

// BGRA pixel buffer, rows bottom-to-top (BMP convention).
const px = Buffer.alloc(SIZE * SIZE * 4);
function set(x, y, c) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const row = SIZE - 1 - y; // flip vertically
  const i = (row * SIZE + x) * 4;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 0xff;
}

// Fill background with a rounded look (simple square fill here).
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) set(x, y, bg);
}

// Thick line helper.
function line(x0, y0, x1, y1, w, c) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    for (let dx = -w; dx <= w; dx++)
      for (let dy = -w; dy <= w; dy++) set(x + dx, y + dy, c);
  }
}

// Chevron ">"
line(70, 80, 140, 128, 7, accent);
line(140, 128, 70, 176, 7, accent);
// Underscore "_"
line(150, 175, 200, 175, 7, accent);

// --- assemble ICO ---
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type = icon
header.writeUInt16LE(1, 4); // count

const dib = Buffer.alloc(40);
dib.writeUInt32LE(40, 0); // header size
dib.writeInt32LE(SIZE, 4); // width
dib.writeInt32LE(SIZE * 2, 8); // height (image + mask)
dib.writeUInt16LE(1, 12); // planes
dib.writeUInt16LE(32, 14); // bpp
// rest zero (BI_RGB)

const maskRowBytes = Math.ceil(SIZE / 32) * 4;
const mask = Buffer.alloc(maskRowBytes * SIZE); // all zero = fully opaque

const imageData = Buffer.concat([dib, px, mask]);

const dir = Buffer.alloc(16);
dir.writeUInt8(0, 0); // width 0 => 256
dir.writeUInt8(0, 1); // height 0 => 256
dir.writeUInt8(0, 2); // palette
dir.writeUInt8(0, 3); // reserved
dir.writeUInt16LE(1, 4); // planes
dir.writeUInt16LE(32, 6); // bpp
dir.writeUInt32LE(imageData.length, 8); // bytes
dir.writeUInt32LE(6 + 16, 12); // offset

const ico = Buffer.concat([header, dir, imageData]);
const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
console.log('Wrote assets/icon.ico', ico.length, 'bytes');
