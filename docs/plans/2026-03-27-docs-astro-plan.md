# docs-astro Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a minimal Astro Nano docs site at `docs-astro/`, ported from the 12-factor-info-capitalism reference project, with light-only theme and #7bcfff accent.

**Architecture:** Copy-and-strip approach — port reference project files, remove blog/projects/work/dark-mode, add single flat "docs" content collection. Deploy to Cloudflare Pages with bun.

**Tech Stack:** Astro 5, MDX, Tailwind CSS 3, TypeScript, bun, Cloudflare Pages (wrangler)

---

### Task 1: Scaffold project skeleton

**Files:**
- Create: `docs-astro/package.json`
- Create: `docs-astro/astro.config.mjs`
- Create: `docs-astro/tailwind.config.mjs`
- Create: `docs-astro/tsconfig.json`
- Create: `docs-astro/.gitignore`
- Create: `docs-astro/wrangler.toml`

**Step 1: Create `docs-astro/package.json`**

```json
{
  "name": "mindpass-docs",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "deploy:pages": "wrangler pages deploy ./dist"
  },
  "dependencies": {
    "@astrojs/check": "^0.9.4",
    "@astrojs/mdx": "^4.0.2",
    "@astrojs/sitemap": "^3.2.1",
    "@astrojs/tailwind": "^5.1.3",
    "@fontsource/inter": "^5.0.17",
    "@fontsource/lora": "^5.0.16",
    "@tailwindcss/typography": "^0.5.10",
    "astro": "^5.0.5",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.2",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.2"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}
```

**Step 2: Create `docs-astro/astro.config.mjs`**

```javascript
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://docs.mindpass.dev",
  integrations: [mdx(), sitemap(), tailwind()],
});
```

**Step 3: Create `docs-astro/tailwind.config.mjs`**

```javascript
import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
        serif: ["Lora", ...defaultTheme.fontFamily.serif],
      },
      colors: {
        accent: {
          DEFAULT: "#7bcfff",
          hover: "#4ab8f0",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
```

**Step 4: Create `docs-astro/tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "strictNullChecks": true,
    "baseUrl": ".",
    "paths": {
      "@*": ["./src/*"]
    }
  }
}
```

**Step 5: Create `docs-astro/.gitignore`**

```
dist/
.astro/
node_modules/
npm-debug.log*
.env
.env.production
.DS_Store
```

**Step 6: Create `docs-astro/wrangler.toml`**

```toml
name = "mindpass-docs-astro"
compatibility_date = "2026-03-27"
pages_build_output_dir = "./dist"

[env.production]
name = "mindpass-docs-astro"
```

**Step 7: Install dependencies**

Run: `cd docs-astro && bun install`
Expected: Successful install, `bun.lock` created

**Step 8: Commit**

```bash
git add docs-astro/package.json docs-astro/astro.config.mjs docs-astro/tailwind.config.mjs docs-astro/tsconfig.json docs-astro/.gitignore docs-astro/wrangler.toml docs-astro/bun.lock
git commit -m "feat(docs-astro): scaffold astro nano project skeleton"
```

---

### Task 2: Port utility files and type definitions

**Files:**
- Create: `docs-astro/src/env.d.ts`
- Create: `docs-astro/src/types.ts`
- Create: `docs-astro/src/consts.ts`
- Create: `docs-astro/src/lib/utils.ts`

**Step 1: Create `docs-astro/src/env.d.ts`**

```typescript
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
```

**Step 2: Create `docs-astro/src/types.ts`**

Simplified from reference — remove work/projects-specific types, remove socials.

```typescript
// ABOUTME: Type definitions for site metadata
// ABOUTME: Used by consts.ts and layout components

export type Site = {
  NAME: string;
  EMAIL: string;
};

export type Metadata = {
  TITLE: string;
  DESCRIPTION: string;
};
```

**Step 3: Create `docs-astro/src/consts.ts`**

```typescript
// ABOUTME: Site-wide constants and metadata
// ABOUTME: Centralizes configuration for all pages

import type { Site, Metadata } from "@types";

export const SITE: Site = {
  NAME: "mindpass",
  EMAIL: "contact@mindpass.dev",
};

export const HOME: Metadata = {
  TITLE: "Docs",
  DESCRIPTION: "mindpass documentation — quickstart guides and tutorials.",
};

export const DOCS: Metadata = {
  TITLE: "Documentation",
  DESCRIPTION: "Guides and tutorials for using mindpass.",
};
```

**Step 4: Create `docs-astro/src/lib/utils.ts`**

Port from reference, remove `dateRange` (work-collection-specific).

```typescript
// ABOUTME: Shared utility functions for class merging, date formatting, and reading time
// ABOUTME: Used across components and pages

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date) {
  return Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export function readingTime(html: string) {
  const textOnly = html.replace(/<[^>]+>/g, "");
  const wordCount = textOnly.split(/\s+/).length;
  const readingTimeMinutes = ((wordCount / 200) + 1).toFixed();
  return `${readingTimeMinutes} min read`;
}
```

**Step 5: Commit**

```bash
git add docs-astro/src/
git commit -m "feat(docs-astro): add type definitions, constants, and utilities"
```

---

### Task 3: Port and adapt components (light-only, #7bcfff accent)

**Files:**
- Create: `docs-astro/src/styles/global.css`
- Create: `docs-astro/src/components/Container.astro`
- Create: `docs-astro/src/components/Head.astro`
- Create: `docs-astro/src/components/Header.astro`
- Create: `docs-astro/src/components/Footer.astro`
- Create: `docs-astro/src/components/Link.astro`
- Create: `docs-astro/src/components/ArrowCard.astro`
- Create: `docs-astro/src/components/BackToPrev.astro`
- Create: `docs-astro/src/components/BackToTop.astro`
- Create: `docs-astro/src/components/FormattedDate.astro`
- Create: `docs-astro/src/layouts/PageLayout.astro`

**Step 1: Create `docs-astro/src/styles/global.css`**

Strip all `dark:` variants. Replace `bg-stone-100` with white. Replace accent references with `#7bcfff`.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  overflow-y: scroll;
  color-scheme: light;
}

html,
body {
  @apply size-full;
}

body {
  @apply font-sans antialiased;
  @apply flex flex-col;
  @apply bg-white;
  @apply text-black/50;
}

header {
  @apply fixed top-0 left-0 right-0 z-50 py-5;
  @apply bg-white/75;
  @apply backdrop-blur-sm saturate-200;
}

main {
  @apply flex-1 py-32;
}

footer {
  @apply py-5 text-sm;
}

article {
  @apply max-w-full prose prose-img:mx-auto prose-img:my-auto;
  @apply prose-headings:font-semibold prose-p:font-serif;
  @apply prose-headings:text-black;
}

@layer utilities {
  article a {
    @apply font-sans text-current underline underline-offset-2;
    @apply decoration-black/15;
    @apply transition-colors duration-300 ease-in-out;
  }
  article a:hover {
    @apply text-black;
    @apply decoration-black/25;
  }
}

.animate {
  @apply opacity-0 translate-y-3;
  @apply transition-all duration-700 ease-out;
}

.animate.show {
  @apply opacity-100 translate-y-0;
}

html #back-to-top {
  @apply opacity-0 pointer-events-none;
}

html.scrolled #back-to-top {
  @apply opacity-100 pointer-events-auto;
}
```

**Step 2: Create `docs-astro/src/components/Container.astro`**

```astro
---
---

<div class="mx-auto max-w-screen-sm px-5">
  <slot />
</div>
```

**Step 3: Create `docs-astro/src/components/Head.astro`**

Port from reference, remove dark mode script logic (theme toggle, preloadTheme, toggleTheme). Keep animate, onScroll, scrollToTop, backToPrev.

```astro
---
import "../styles/global.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/600.css";
import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff2";
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff2";
import lora400 from "@fontsource/lora/files/lora-latin-400-normal.woff2";
import lora600 from "@fontsource/lora/files/lora-latin-600-normal.woff2";

import { ClientRouter } from "astro:transitions";
import { SITE } from "@consts";

interface Props {
  title: string;
  description: string;
  image?: string;
}

const canonicalURL = new URL(Astro.url.pathname, Astro.site);

const { title, description, image = "/og-image.png" } = Astro.props;
---

<!-- Global Metadata -->
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="generator" content={Astro.generator} />

<!-- Font preloads -->
<link rel="preload" href={inter400} as="font" type="font/woff2" crossorigin />
<link rel="preload" href={inter600} as="font" type="font/woff2" crossorigin />
<link rel="preload" href={lora400} as="font" type="font/woff2" crossorigin />
<link rel="preload" href={lora600} as="font" type="font/woff2" crossorigin />

<!-- Canonical URL -->
<link rel="canonical" href={canonicalURL} />

<!-- Primary Meta Tags -->
<title>{title}</title>
<meta name="title" content={title} />
<meta name="description" content={description} />

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website" />
<meta property="og:url" content={Astro.url} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={new URL(image, Astro.url)} />

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image" />
<meta property="twitter:url" content={Astro.url} />
<meta property="twitter:title" content={title} />
<meta property="twitter:description" content={description} />
<meta property="twitter:image" content={new URL(image, Astro.url)} />

<ClientRouter />

<script>
  import type { TransitionBeforeSwapEvent } from "astro:transitions/client";
  document.addEventListener("astro:before-swap", (e) =>
    [
      ...(e as TransitionBeforeSwapEvent).newDocument.head.querySelectorAll(
        'link[as="font"]'
      ),
    ].forEach((link) => link.remove())
  );
</script>

<script is:inline>
  function init() {
    onScroll();
    animate();

    const backToTop = document.getElementById("back-to-top");
    backToTop?.addEventListener("click", (event) => scrollToTop(event));

    const backToPrev = document.getElementById("back-to-prev");
    backToPrev?.addEventListener("click", () => window.history.back());

    document.addEventListener("scroll", onScroll);
  }

  function animate() {
    const animateElements = document.querySelectorAll(".animate");
    animateElements.forEach((element, index) => {
      setTimeout(() => {
        element.classList.add("show");
      }, index * 150);
    });
  }

  function onScroll() {
    if (window.scrollY > 0) {
      document.documentElement.classList.add("scrolled");
    } else {
      document.documentElement.classList.remove("scrolled");
    }
  }

  function scrollToTop(event) {
    event.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  document.addEventListener("DOMContentLoaded", () => init());
  document.addEventListener("astro:after-swap", () => init());
</script>
```

**Step 4: Create `docs-astro/src/components/Header.astro`**

Simplified — just site name link, single "docs" nav item.

```astro
---
import Container from "@components/Container.astro";
import Link from "@components/Link.astro";
import { SITE } from "@consts";
---

<header>
  <Container>
    <div class="flex flex-wrap gap-y-2 justify-between">
      <Link href="/" underline={false}>
        <div class="font-semibold">
          {SITE.NAME}
        </div>
      </Link>
      <nav class="flex gap-1">
        <Link href="/docs">
          docs
        </Link>
      </nav>
    </div>
  </Container>
</header>
```

**Step 5: Create `docs-astro/src/components/Footer.astro`**

Remove theme toggle buttons entirely. Keep copyright and back-to-top.

```astro
---
import Container from "@components/Container.astro";
import { SITE } from "@consts";
import BackToTop from "@components/BackToTop.astro";
---

<footer class="animate">
  <Container>
    <div class="relative">
      <div class="absolute right-0 -top-20">
        <BackToTop />
      </div>
    </div>
    <div class="flex justify-between items-center">
      <div>
        &copy; {new Date().getFullYear()} {`|`} {SITE.NAME}
      </div>
    </div>
  </Container>
</footer>
```

**Step 6: Create `docs-astro/src/components/Link.astro`**

Strip dark: variants.

```astro
---
import { cn } from "@lib/utils";

type Props = {
  href: string;
  external?: boolean;
  underline?: boolean;
};

const { href, external, underline = true, ...rest } = Astro.props;
---

<a
  href={href}
  target={external ? "_blank" : "_self"}
  class={cn(
    "inline-block decoration-black/15 hover:decoration-black/25 text-current hover:text-black transition-colors duration-300 ease-in-out",
    underline && "underline underline-offset-2"
  )}
  {...rest}
>
  <slot />
</a>
```

**Step 7: Create `docs-astro/src/components/ArrowCard.astro`**

Adapt for "docs" collection. Strip dark: variants. Use accent color for hover.

```astro
---
import type { CollectionEntry } from "astro:content";

type Props = {
  entry: CollectionEntry<"docs">;
};

const { entry } = Astro.props;
---

<a
  href={`/docs/${entry.slug}`}
  class="relative group flex flex-nowrap py-3 px-4 pr-10 rounded-lg border border-black/15 hover:bg-accent/10 hover:text-black transition-colors duration-300 ease-in-out"
>
  <div class="flex flex-col flex-1 truncate">
    <div class="font-semibold">
      {entry.data.title}
    </div>
    <div class="text-sm">
      {entry.data.description}
    </div>
  </div>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    class="absolute top-1/2 right-2 -translate-y-1/2 size-5 stroke-2 fill-none stroke-current"
  >
    <line
      x1="5" y1="12" x2="19" y2="12"
      class="translate-x-3 group-hover:translate-x-0 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-in-out"
    />
    <polyline
      points="12 5 19 12 12 19"
      class="-translate-x-1 group-hover:translate-x-0 transition-transform duration-300 ease-in-out"
    />
  </svg>
</a>
```

**Step 8: Create `docs-astro/src/components/BackToPrev.astro`**

Strip dark: variants.

```astro
---
type Props = {
  href: string;
};

const { href } = Astro.props;
---

<a
  href={href}
  class="relative group w-fit flex pl-7 pr-3 py-1.5 flex-nowrap rounded border border-black/15 hover:bg-accent/10 hover:text-black transition-colors duration-300 ease-in-out"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    class="absolute top-1/2 left-2 -translate-y-1/2 size-4 stroke-2 fill-none stroke-current"
  >
    <line
      x1="5" y1="12" x2="19" y2="12"
      class="translate-x-2 group-hover:translate-x-0 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-in-out"
    />
    <polyline
      points="12 5 5 12 12 19"
      class="translate-x-1 group-hover:translate-x-0 transition-transform duration-300 ease-in-out"
    />
  </svg>
  <div class="text-sm">
    <slot />
  </div>
</a>
```

**Step 9: Create `docs-astro/src/components/BackToTop.astro`**

Strip dark: variants.

```astro
<button
  id="back-to-top"
  class="relative group w-fit flex pl-8 pr-3 py-1.5 flex-nowrap rounded border border-black/15 hover:bg-accent/10 hover:text-black transition-colors duration-300 ease-in-out"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    class="absolute top-1/2 left-2 -translate-y-1/2 size-4 stroke-2 fill-none stroke-current rotate-90"
  >
    <line
      x1="5" y1="12" x2="19" y2="12"
      class="translate-x-2 group-hover:translate-x-0 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-in-out"
    />
    <polyline
      points="12 5 5 12 12 19"
      class="translate-x-1 group-hover:translate-x-0 transition-transform duration-300 ease-in-out"
    />
  </svg>
  <div class="text-sm">
    Back to top
  </div>
</button>
```

**Step 10: Create `docs-astro/src/components/FormattedDate.astro`**

Unchanged from reference.

```astro
---
interface Props {
  date: Date;
}

const { date } = Astro.props;
---

<time datetime={date.toISOString()}>
  {
    date.toLocaleDateString("en-us", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }
</time>
```

**Step 11: Create `docs-astro/src/layouts/PageLayout.astro`**

Unchanged from reference.

```astro
---
import Head from "@components/Head.astro";
import Header from "@components/Header.astro";
import Footer from "@components/Footer.astro";
import { SITE } from "@consts";

type Props = {
  title: string;
  description: string;
};

const { title, description } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <Head title={`${title} | ${SITE.NAME}`} description={description} />
  </head>
  <body>
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

**Step 12: Commit**

```bash
git add docs-astro/src/styles/ docs-astro/src/components/ docs-astro/src/layouts/
git commit -m "feat(docs-astro): port components and styles with light-only theme"
```

---

### Task 4: Create docs content collection and pages

**Files:**
- Create: `docs-astro/src/content/config.ts`
- Create: `docs-astro/src/content/docs/01-quickstart.md` (placeholder)
- Create: `docs-astro/src/pages/index.astro`
- Create: `docs-astro/src/pages/docs/index.astro`
- Create: `docs-astro/src/pages/docs/[...slug].astro`

**Step 1: Create `docs-astro/src/content/config.ts`**

```typescript
// ABOUTME: Defines the docs content collection schema
// ABOUTME: Single flat collection for quickstart and tutorial content

import { defineCollection, z } from "astro:content";

const docs = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    order: z.number(),
    draft: z.boolean().optional(),
  }),
});

export const collections = { docs };
```

**Step 2: Create placeholder doc `docs-astro/src/content/docs/01-quickstart.md`**

```markdown
---
title: "Quickstart"
description: "Get up and running with mindpass in under 5 minutes."
date: 2026-03-27
order: 1
---

# Quickstart

Get up and running with mindpass.

## Install

\`\`\`bash
npm install mindpass
\`\`\`

## Usage

Coming soon.
```

**Step 3: Create `docs-astro/src/pages/index.astro`**

Homepage with intro text and flat list of docs as ArrowCards.

```astro
---
import { getCollection } from "astro:content";
import Container from "@components/Container.astro";
import PageLayout from "@layouts/PageLayout.astro";
import ArrowCard from "@components/ArrowCard.astro";
import { HOME } from "@consts";

const docs = (await getCollection("docs"))
  .filter((doc) => !doc.data.draft)
  .sort((a, b) => a.data.order - b.data.order);
---

<PageLayout title={HOME.TITLE} description={HOME.DESCRIPTION}>
  <Container>
    <div class="space-y-16">
      <section>
        <h4 class="animate font-semibold text-black">
          mindpass
        </h4>
        <article class="space-y-4">
          <p class="animate">
            Agent payment SDK for the multi-protocol payment economy. Quickstart guides and tutorials to get you building.
          </p>
        </article>
      </section>

      <section class="animate space-y-4">
        <h5 class="font-semibold text-black">
          Guides
        </h5>
        <ul class="flex flex-col gap-4">
          {docs.map((doc) => (
            <li>
              <ArrowCard entry={doc} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  </Container>
</PageLayout>
```

**Step 4: Create `docs-astro/src/pages/docs/index.astro`**

Redirects to homepage (all docs listed there).

```astro
---
return Astro.redirect("/");
---
```

**Step 5: Create `docs-astro/src/pages/docs/[...slug].astro`**

Individual doc page with prev/next navigation.

```astro
---
import { type CollectionEntry, getCollection } from "astro:content";
import PageLayout from "@layouts/PageLayout.astro";
import Container from "@components/Container.astro";
import FormattedDate from "@components/FormattedDate.astro";
import { readingTime } from "@lib/utils";
import BackToPrev from "@components/BackToPrev.astro";

export async function getStaticPaths() {
  const docs = (await getCollection("docs"))
    .filter((doc) => !doc.data.draft)
    .sort((a, b) => a.data.order - b.data.order);
  return docs.map((doc, index) => ({
    params: { slug: doc.slug },
    props: {
      doc,
      prevDoc: index > 0 ? docs[index - 1] : null,
      nextDoc: index < docs.length - 1 ? docs[index + 1] : null,
    },
  }));
}

type Props = {
  doc: CollectionEntry<"docs">;
  prevDoc: CollectionEntry<"docs"> | null;
  nextDoc: CollectionEntry<"docs"> | null;
};

const { doc, prevDoc, nextDoc } = Astro.props;
const { Content } = await doc.render();
---

<PageLayout title={doc.data.title} description={doc.data.description}>
  <Container>
    <div class="animate">
      <BackToPrev href="/">
        Back to home
      </BackToPrev>
    </div>
    <div class="space-y-1 my-10">
      <div class="animate flex items-center gap-1.5">
        <div class="font-base text-sm">
          <FormattedDate date={doc.data.date} />
        </div>
        &bull;
        <div class="font-base text-sm">
          {readingTime(doc.body)}
        </div>
      </div>
      <div class="animate text-2xl font-semibold text-black">
        {doc.data.title}
      </div>
    </div>
    <article class="animate">
      <Content />
    </article>
    <div class="animate mt-12 pt-8 border-t border-black/10">
      <div class="flex flex-wrap gap-4 justify-between items-center">
        <div class="flex-1 min-w-0">
          {prevDoc && (
            <a
              href={`/docs/${prevDoc.slug}`}
              class="group flex items-center gap-2 text-sm hover:text-black transition-colors"
            >
              <svg
                class="w-4 h-4 group-hover:-translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <div class="flex flex-col">
                <span class="text-xs opacity-75">Previous</span>
                <span class="font-medium">{prevDoc.data.title}</span>
              </div>
            </a>
          )}
        </div>
        <div class="flex-1 min-w-0 text-right">
          {nextDoc && (
            <a
              href={`/docs/${nextDoc.slug}`}
              class="group flex items-center justify-end gap-2 text-sm hover:text-black transition-colors"
            >
              <div class="flex flex-col">
                <span class="text-xs opacity-75">Next</span>
                <span class="font-medium">{nextDoc.data.title}</span>
              </div>
              <svg
                class="w-4 h-4 group-hover:translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  </Container>
</PageLayout>
```

**Step 6: Commit**

```bash
git add docs-astro/src/content/ docs-astro/src/pages/
git commit -m "feat(docs-astro): add docs collection, pages, and placeholder content"
```

---

### Task 5: Add static assets and verify build

**Files:**
- Create: `docs-astro/public/favicon.svg` (copy the mindpass icon SVG)

**Step 1: Copy favicon**

```bash
cp /Users/pureicis/dev/inf-minds/docs/static/img/icon-dark.svg docs-astro/public/favicon.svg
```

**Step 2: Run the build**

Run: `cd docs-astro && bun run build`
Expected: Successful build with output in `dist/`

**Step 3: Preview locally**

Run: `cd docs-astro && bun run preview`
Expected: Site loads at localhost:4321 with light theme, #7bcfff accent favicon, Inter/Lora fonts, staggered animations, quickstart doc accessible

**Step 4: Fix any build errors**

Address any TypeScript or Astro compilation errors found during build.

**Step 5: Commit**

```bash
git add docs-astro/public/
git commit -m "feat(docs-astro): add favicon and verify build"
```

---

### Task 6: Final verification and cleanup

**Step 1: Verify all pages render**

- Homepage shows site title, intro, and ArrowCard linking to quickstart
- `/docs/01-quickstart` renders with title, date, reading time, content
- Prev/next navigation works (only "next" on first doc, only "prev" on last)
- Back button navigates home
- Back-to-top appears on scroll
- Staggered animations play on page load

**Step 2: Verify styling**

- Light-only theme (no dark mode flicker)
- Inter font on headings, Lora on body text
- #7bcfff accent visible on hover states
- Clean white background

**Step 3: Commit any final fixes**

```bash
git add docs-astro/
git commit -m "chore(docs-astro): final cleanup and verification"
```
