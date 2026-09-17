# FX Replay — Brand Kit

The single source of truth for the FX Replay visual identity: logo, color, and type.
Everything here is generated from the design-system reference files in `source/`.

## What's in this folder

```
Brand Kit/
├── README.md              ← you are here
├── brand-kit.html         ← open in any browser: the visual brand kit (logo, colors, fonts)
├── logos/                 ← the marks, as SVG
│   ├── FXReplayLogo.svg   ← primary wordmark
│   ├── isotypeBlack.svg   ← isotype (play arrow) — black, for light backgrounds
│   └── isotypeWhite.svg   ← isotype — white, for dark backgrounds
├── tokens/                ← for engineers
│   ├── tokens.css         ← CSS custom properties (import once, use var(--token))
│   └── tokens.json        ← W3C-style design tokens (Style Dictionary / Tailwind codegen)
└── source/                ← original design-system reference exports
    ├── Color Tokens.pdf
    └── Typography.pdf
```

## The essentials

**Brand color** — Electric Blue `#0260FD`
**Ground** — dark-first, `dark-900` `#030303`
**Headings** — Lato (400 · 700 · 900)
**Body / UI** — Nunito Sans (400 · 600 · 700)

## How to use it

- **Designers / anyone:** open `brand-kit.html` to browse the marks, copy any hex, and see the fonts.
- **Engineers:** import `tokens/tokens.css` and reference the **semantic** tokens in product
  code — `var(--bg-primary)`, `var(--text-primary)`, `var(--border-brand)` — never the raw
  primitives (`dark-900`) and never hard-coded hex. Semantic tokens alias primitives, so
  re-theming is a one-line change.

## Colors, in two tiers

- **Primitives** (44) — the raw palette; the only place literal hex lives.
- **Semantic** (60) — purpose-named aliases that point at primitives
  (background, border, text, button, icon, banner, card). Build with these.

## Open questions for design

- `btn-bg-primary-disabled` points at `blue-950`, which isn't defined in the primitive
  scale (it stops at `blue-900` `#012054`). Add `blue-950` or repoint the token.
- `card-bg-translucent` = `dark-900` at 60% — implemented as `color-mix()` in `tokens.css`.

---
_Brand Kit v1 · colors + font families. No type-scale/sizing is enforced here by design._
