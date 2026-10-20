# lula — App icon & logo brief

_Handoff for a design agent · 2026-10-20_

> **Final selection · 2026-10-20:** The owner approved the full-bleed orange
> wave field, with broad adjoining bands and gentle gradation filling the
> entire icon. The production source is `public/favicon.svg`; see
> [README.md](README.md) for assets and regeneration.
> This selection supersedes the dark icon ground, node-tree recommendation,
> three-color limit, discrete-gradation-only rule, and line geometry below.
> Device masks crop the continuous pattern; no separate foreground symbol
> needs a safe-zone inset. The remainder is the original brief.

## 1. What this is for

**lula** (lula.today) is a personal, offline-first task app, installed mainly as a **home-screen PWA on iPhone**, with a desktop browser as the second device. Its owner has trouble reading small text, so the whole UI is built for **high contrast, large scale and extreme clarity**. The icon must follow the same rules: bold, simple, and legible at 16px.

**Hierarchy the app is built around:** Inbox → **Realms** (kinds of work, e.g. Work, Home, Health) → Projects → Tasks → Steps. Realms are drawn in the UI as a **node tree** (a root node with lines branching to child nodes), not folders. That motif is the strongest candidate for the mark.

**Personality:** calm, direct, a little playful. Inspired by the visual language of overworld.vg (dark ground, one hot orange accent, flat surfaces, IBM Plex Sans). Use it as a mood reference only: do **not** copy Overworld's logo, wordmark or any of its artwork.

## 2. Deliverables

| File (in `public/`) | Size | Notes |
|---|---|---|
| `favicon.svg` | viewBox `0 0 512 512` | **Master source.** All PNGs are generated from it. Must read at 16px. |
| `pwa-64x64.png` | 64 × 64 | Generated |
| `pwa-192x192.png` | 192 × 192 | Generated; Android home screen / install prompt |
| `pwa-512x512.png` | 512 × 512 | Generated; splash / store-quality |
| `maskable-icon-512x512.png` | 512 × 512 | Generated with a `#111316` full-bleed background; see safe zone below |
| `apple-touch-icon-180x180.png` | 180 × 180 | Generated, **opaque** `#111316` background; iOS applies its own corner mask |
| `favicon.ico` | 16 / 32 / 48 | Generated |

Also wanted, kept in `docs/brand/` (not shipped):

- `logo-wordmark.svg`: the "lula" wordmark alone.
- `logo-lockup.svg`: mark + wordmark, side by side.
- `icon-mono.svg`: a single-color (`#ff6a2b` or `currentColor`) version of the mark for future uses.

**Regenerating the PNGs:** replace `public/favicon.svg`, then run `npm run icons` (uses `pwa-assets.config.ts`, preset `minimal2023Preset`, background `#111316` for apple and maskable). Don't hand-edit the PNGs. The manifest in `vite.config.ts` already lists them and uses `theme_color` / `background_color` `#111316`.

## 3. Color

Use these exact values. The icon lives mostly on the **dark** palette.

### Core (dark theme, the default)

| Role | Hex | Use in the icon |
|---|---|---|
| Ground | `#111316` | Icon background (also the PWA theme and background color) |
| Surface | `#181b1f` | Optional inner panel |
| Surface 2 | `#252a2f` | Optional subtle shapes |
| Line strong | `#4a535d` | Connector lines, if neutral |
| Foreground | `#f4f6f8` | Wordmark on dark, highlights |
| **Accent (orange)** | **`#ff6a2b`** | **Primary mark color.** 6:1 contrast on the ground |
| Accent deep | `#e8501e` | Shading / second tone of orange |
| Accent darker | `#c2410c` | Third tone; also the accent in light mode |

### Orange ramp (for multi-tone or "swish" treatments)

`#ffb98a` → `#ffa36b` → `#ff8a4c` → `#ff7a3a` → **`#ff6a2b`** → `#e8501e` → `#c2410c`

The app's task-completed animation sweeps slanted bars in exactly these shades, so a multi-bar orange motif ties the icon to that moment.

### Light theme (for the wordmark on light backgrounds only)

| Role | Hex |
|---|---|
| Ground | `#f7f7f5` |
| Foreground | `#0d0f12` |
| Accent | `#c2410c` (5:1 on light ground; use this instead of `#ff6a2b` on white) |

### Realm palette (secondary; optional accents only)

Users color their realms with these 12 hues. A mark that shows a few child nodes may use 2–3 of them, but **orange must stay dominant**.

| Ember `#ff6a2b` | Amber `#f5b83d` | Lemon `#e6d450` | Lime `#9ed85a` |
|---|---|---|---|
| **Jade `#3fcf8e`** | **Teal `#2ec4b6`** | **Sky `#4cc2ff`** | **Cobalt `#6b8cff`** |
| **Purple `#9d7bff`** | **Orchid `#d07cf0`** | **Rose `#ff6fa8`** | **Coral `#f2667a`** |

## 4. Typography (wordmark)

- **Typeface:** IBM Plex Sans (SIL Open Font License), **Bold 700**. Use 600 only if 700 feels heavy at large sizes.
- **Case:** always lowercase: **lula**. Never "Lula" or "LULA".
- **Color:** `#ff6a2b` on dark, `#c2410c` on light. White `#f4f6f8` is allowed on an orange field.
- **Tracking:** 0 to −1%. Don't widen it.
- **Outline the text** in delivered SVGs so they don't depend on the font being installed.
- **In the app today:** the sidebar and login show "lula" as live text at 36px, Bold, `#ff6a2b`. A wordmark SVG must look the same when it replaces that text.

## 5. The mark: shape and geometry

### Direction (recommended): node tree

A **root node** with a short spine and **two or three child nodes** on elbow connectors, the same visual language as the Realms screen. For reference, the UI draws:

- **Root:** a ring in orange with a solid orange center dot (ring : dot ≈ 3 : 1).
- **Realm (child):** a solid filled circle with a ring around it: a 3px gap in the ground color, then a 2px ring in the same color.
- **Project (grandchild):** a hollow circle.
- **Connectors:** right-angle elbows (spine down, then out to the child), at a uniform stroke weight.
- **UI size ratios:** root 22 : realm 18 : project 12.

For the icon, **simplify**: one root plus two or three children. Drop the grandchildren and the double rings below 64px.

### Alternative directions (acceptable)

1. **Swish bars:** three to five slanted (−24°) rounded bars in the orange ramp, sweeping left to right. Echoes the completion animation; the current placeholder icon is an upright version of this.
2. **Monogram "l":** a heavy lowercase Plex-style "l" in orange with a single node dot at its foot.

### Grid and sizes (on a 512 canvas)

- **Canvas:** 512 × 512. Background `#111316`, **full bleed** (no transparent corners). The OS applies its own rounding on iOS and Android, so don't pre-round the outer edge for the PWA PNGs. The current `favicon.svg` uses `rx=112` because browsers show it unmasked; keep that only in the SVG favicon if you want rounded corners in browser tabs.
- **Maskable safe zone:** keep all meaningful content inside a **centered circle of 410px diameter** (radius 40% of the canvas). Treat **352 × 352 centered** as the comfortable live area.
- **Minimum stroke weight:** **40px** at 512 (renders ~1.25px at 16px). Connector lines 40–48px; node rings 40px or more.
- **Minimum gap between shapes:** 32px at 512.
- **Node sizes at 512:** root around 150–170px across, children around 100–120px. No element smaller than 64px across.
- **Optical center:** the mark's visual weight may sit 8–16px above true center.
- **Corners:** match the app (3–6px radius on UI rectangles). At 512 that means bars, if any, use roughly a 20px radius; lines use round caps and joins.

### Lockup (mark + wordmark)

- **Layout:** mark on the left, wordmark on the right, vertically centered on the wordmark's x-height.
- **Gap:** 0.5 × mark height.
- **Clear space:** at least 0.5 × mark height on every side.
- **Minimum sizes:** mark 16px; wordmark 20px cap height; lockup 120px wide.

## 6. Must-pass checks

- [ ] Recognizable at **16 × 16** (browser tab) and **40 × 40** (iOS Spotlight and search results), with no hairlines and no detail that disappears.
- [ ] Reads on both a black and a white phone wallpaper. The opaque `#111316` tile is what guarantees this.
- [ ] Orange is the dominant color; at most 3 colors in total in the icon itself.
- [ ] Passes a **maskable** preview (e.g. maskable.app) with circle, squircle and rounded-square masks without cropping the mark.
- [ ] No text in the app icon other than an optional single "l"; the wordmark is a separate asset.
- [ ] No gradients except the discrete orange-ramp bars of the swish direction. Flat fills otherwise.
- [ ] Does not resemble Overworld's logo or any other existing brand mark.
- [ ] SVGs are clean: no embedded rasters, no fonts (outlined text), colors as hex fills, `viewBox="0 0 512 512"`.
- [ ] After replacing `public/favicon.svg`, `npm run icons` regenerates every PNG without errors, and `npm run build` succeeds.

## 7. Don'ts

- Don't use folder shapes. The app deliberately moved away from folders to nodes.
- Don't use thin outline-only icons, drop shadows, glows, glass or 3D effects.
- Don't place orange text on orange, or `#ff6a2b` on white (it fails contrast; use `#c2410c`).
- Don't capitalize the name.
