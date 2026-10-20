import { createRequire } from 'node:module';

// Reuse the image encoders installed with the PWA asset generator.
const require = createRequire(import.meta.resolve('@vite-pwa/assets-generator'));
const sharp = require('sharp');
const { sharpsToIco } = require('sharp-ico');

await sharpsToIco([sharp('public/favicon.svg')], 'public/favicon.ico', {
  sizes: [16, 32, 48],
});
console.log('Generated favicon.ico (16, 32, 48px)');
