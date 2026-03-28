# docs-astro: Astro Nano Documentation Site

## Overview

Create `docs-astro/` as a minimal, flat-structured documentation site using Astro Nano. Ported from the reference project at `12-factor-info-capitalism`, stripped down to a single "docs" content collection for quickstart + tutorial content.

## Approach

Copy-and-strip from the reference astro-nano project:
- Remove blog/projects/work collections → single flat `docs` collection
- Remove dark mode → light-only theme
- Swap stone palette → `#7bcfff` accent on white background
- Keep Mona Sans + Atkinson typography, staggered fade-in animations
- Use `bun` instead of `pnpm`
- Deploy to Cloudflare Pages

## Project Structure

```
docs-astro/
├── src/
│   ├── components/          # Header, Footer, ArrowCard, Container, etc.
│   ├── layouts/
│   │   └── PageLayout.astro
│   ├── pages/
│   │   ├── index.astro      # Landing page — intro + ArrowCard links to docs
│   │   └── docs/
│   │       └── [...slug].astro  # Dynamic doc pages
│   ├── content/
│   │   ├── config.ts        # Single "docs" collection
│   │   └── docs/            # Flat markdown files
│   ├── styles/
│   │   └── global.css       # Light-only theme, #7bcfff accent
│   ├── lib/
│   │   └── utils.ts
│   └── consts.ts
├── public/                  # Fonts, favicon, logo
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── wrangler.toml
├── package.json
└── .gitignore
```

## Content Collection Schema

Single `docs` collection:
- `title` (string, required)
- `description` (string, required)
- `date` (date, required)
- `order` (number, required — controls sequencing)
- `draft` (boolean, optional)

## Theme & Styling

- **Typography:** Mona Sans (sans), Atkinson (body/reading)
- **Background:** white (#ffffff) or light gray (#fafafa)
- **Text:** dark gray (#1c1917 / stone-900)
- **Accent:** #7bcfff, hover ~#4ab8f0
- **Animations:** Staggered fade-in `.animate` class
- **Layout:** Container max-width ~640px (max-w-screen-sm)
- **No dark mode**

## Pages

**Homepage:** Site title, one-line description, flat ordered list of docs as ArrowCards.

**Doc page:** Title, date, reading time, rendered content, prev/next navigation, back button.

## Deployment

Cloudflare Pages via `wrangler.toml`, build output `./dist/`.

## Removed from Reference

- Dark mode (toggle, CSS, localStorage)
- Blog, projects, work collections and pages
- RSS feed, robots.txt generators
- Social links section
- ESLint config
