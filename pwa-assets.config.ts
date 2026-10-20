import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#111316' } },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#111316' } },
  },
  images: ['public/favicon.svg'],
});
