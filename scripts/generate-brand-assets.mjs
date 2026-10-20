import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.resolve('@vite-pwa/assets-generator'));
const sharp = require('sharp');
const source = await readFile('public/favicon.svg', 'utf8');
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>`;
// Isolate the central wave as a one-ink silhouette using the master's boundaries.
const upper = source.match(/id="wave-upper" d="([^"]+)"/)[1];
const lower = source.match(/id="wave-lower" d="([^"]+)"/)[1];
const mono = `<path d="${upper} ${lower}" fill="#ff6a2b" fill-rule="evenodd"/>`;
await writeFile('docs/brand/icon-mono.svg', svg(mono));
const wordmark = await readFile('docs/brand/logo-wordmark.svg','utf8');
const word = wordmark.match(/<g[\s\S]*<\/g>/)[0];
// 100-unit full-color tile, 50-unit gap and minimum 50-unit outer clear space.
// Wordmark x-height center aligns to the mark's center.
await writeFile('docs/brand/logo-lockup.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 451 216">
  <svg x="50" y="58" width="100" height="100" viewBox="0 0 512 512">${source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>
  <g transform="translate(200 50.7) scale(.12)">${word}</g>
</svg>\n`);
const layers = [];
for (const [size,x,y] of [[280,32,40],[16,352,48],[40,400,48],[64,472,48]]) {
  layers.push({input:await sharp(Buffer.from(source)).resize(size,size).png().toBuffer(),left:x,top:y});
}
for (const [shape,x] of [['circle',352],['squircle',512],['round',672]]) {
  const mask = shape==='circle' ? '<circle cx="64" cy="64" r="64" fill="white"/>' :
    shape==='squircle' ? '<path d="M64 0C119 0 128 9 128 64S119 128 64 128 0 119 0 64 9 0 64 0Z" fill="white"/>' :
    '<rect width="128" height="128" rx="28" fill="white"/>';
  layers.push({input:await sharp(Buffer.from(source)).resize(128,128).composite([{input:Buffer.from(`<svg width="128" height="128">${mask}</svg>`),blend:'dest-in'}]).png().toBuffer(),left:x,top:160});
}
layers.push({input:await sharp('docs/brand/logo-lockup.svg').resize(760).png().toBuffer(),left:40,top:330});
await sharp({create:{width:852,height:690,channels:4,background:'#252a2f'}}).composite(layers).png().toFile('docs/brand/icon-preview.png');
// This full-bleed pattern intentionally extends beyond every device mask.
for (const [name,size] of [
  ['pwa-64x64.png',64], ['pwa-192x192.png',192], ['pwa-512x512.png',512],
  ['maskable-icon-512x512.png',512], ['apple-touch-icon-180x180.png',180],
]) {
  const image=sharp(`public/${name}`);
  const metadata=await image.metadata();
  const stats=await image.stats();
  if(metadata.width!==size || metadata.height!==size || !stats.isOpaque)
    throw new Error(`Invalid dimensions or transparency: ${name}`);
}
const ico=await readFile('public/favicon.ico');
const sizes=Array.from({length:ico.readUInt16LE(4)},(_,i)=>ico[6+i*16]);
if(sizes.join(',')!=='16,32,48') throw new Error('ICO must contain 16/32/48px frames.');
console.log('Brand assets generated; PNG dimensions, opacity, and ICO frames verified.');
