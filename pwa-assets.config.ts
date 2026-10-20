import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#111316' } },
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#111316' } },
  },
  images: ['public/favicon.svg'],
});
