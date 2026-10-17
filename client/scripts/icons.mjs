// Generates the PWA icons in public/ from the pixel adventurer (same sprite
// as components/Avatar.jsx). No dependency: PNGs are encoded by hand.
// Run: node scripts/icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SPRITE = [
  '................',
  '.....KKKKKK.....',
  '....KHHHHHHK....',
  '....KHHHHHHK....',
  '....KSSSSSSK....',
  '....KSESSESK....',
  '....KSSSSSSK....',
  '.....KSSSSK.....',
  '....KGGGGGGK....',
  '...KGGGYYGGGK...',
  '..KSKGGGGGGKSK..',
  '..KSKGGGGGGKSK..',
  '...K.KBBBBK.K...',
  '.....KBBBBK.....',
  '.....KB..BK.....',
  '.....KK..KK.....',
];
const COLORS = { K: '#0F0E0D', H: '#5C7A3A', S: '#E8B98A', E: '#1C1B19', Y: '#F2B24C', B: '#4A4842', G: '#9BD15A' };
const BG = '#1C1B19';
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// The sprite fills `fill` of the icon (maskable icons keep it in the 80 % safe zone).
function pixels(size, fill) {
  const cell = Math.floor((size * fill) / 16);
  const off = Math.floor((size - cell * 16) / 2);
  const buf = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x - off) / cell);
      const sy = Math.floor((y - off) / cell);
      const c = x >= off && y >= off && sx < 16 && sy < 16 ? SPRITE[sy][sx] : '.';
      buf.set(rgb(c === '.' ? BG : COLORS[c]), (y * size + x) * 3);
    }
  }
  return buf;
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, fill) {
  const px = pixels(size, fill);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;                                        // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" rx="2" fill="${BG}"/>${
  SPRITE.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${COLORS[c]}"/>`))).join('')}</svg>\n`;

const out = new URL('../public/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), png(192, 0.84));
writeFileSync(new URL('icon-512.png', out), png(512, 0.84));
writeFileSync(new URL('icon-maskable-512.png', out), png(512, 0.66));
writeFileSync(new URL('apple-touch-icon.png', out), png(180, 0.8));
writeFileSync(new URL('favicon.svg', out), svg);
console.log('icons written to public/');
