# lula brand assets

The final identity is an edge-to-edge orange wave field: six broad bands sweep
from lower left toward upper right, with gentle gradation across the brand's
peach-to-burnt-orange palette. There are no dark corners or detached ribbons.

`approved-concept.png` preserves the final selected concept.
`public/favicon.svg` is the clean production vector adaptation. It contains
only vector paths and gradients, with no embedded image or font dependency.

Run `npm run icons` to regenerate:

- `public/pwa-64x64.png`, `pwa-192x192.png`, and `pwa-512x512.png`.
- `public/maskable-icon-512x512.png` and `apple-touch-icon-180x180.png`.
- `public/favicon.ico`, containing 16/32/48px frames.
- `docs/brand/icon-mono.svg`, `logo-lockup.svg`, and `icon-preview.png`.

All shipped PNGs are opaque, square, and full bleed. Devices apply their own
corner masks. The wave pattern intentionally extends beyond the safe circle;
its identifying curves remain visible inside circle, squircle, and rounded
square masks. No text or small foreground symbol can be clipped.

Brand-only assets:

- `logo-wordmark.svg`: lowercase IBM Plex Sans Bold 700, outlined paths,
  zero tracking, orange for dark backgrounds.
- `logo-lockup.svg`: the full-color wave tile and outlined wordmark, with a
  half-tile gap and at least half-tile outer clear space. The tile's center
  aligns with the wordmark's x-height center.
- `icon-mono.svg`: the central wave band isolated as a single orange silhouette
  on a transparent 512-unit canvas. A one-ink adaptation of the final design.
- `icon-preview.png`: large icon, actual 16/40/64px samples, three device masks,
  and the final lockup.

The final selection supersedes the original brief's dark icon background,
three-color limit, discrete-gradation-only rule, and node/line geometry.
The app theme and splash background remain `#111316`; the icon itself is orange.
Wordmarks for light backgrounds should use `#c2410c`. Rectangular viewBoxes
preserve the wordmark and lockup proportions; icon SVGs use `0 0 512 512`.

Validation: the icon command checks PNG dimensions, full opacity, and the ICO
frame sizes. Small-size and mask previews were visually inspected. Both
`npm run icons` and `npm run build` succeed; Vite reports a bundle-size warning.
