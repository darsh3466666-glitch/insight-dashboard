
## Goal

Bring the existing `customer-retention-whisperer` dashboard (uploaded zip) into this project and reskin it using the **Flip7** design system from the uploaded design file. Keep all structure, data, sections, buttons, options, and behaviors identical — change **only** colors, typography, and visual styling.

## Approach

### 1. Import project source
Extract the zip and copy into the current project (excluding `.git`, `node_modules`, config files that would clash):
- `src/routes/*` (executive, sales, collections, customers, activity-analysis, stagnation, reports, index, __root)
- `src/components/*` (AppShell, KpiCard, Section, StatusBadge, ThemeToggle, all shadcn ui/)
- Any data/lib/hooks the routes depend on
- `package.json` deps (recharts, etc.) — install via bun add

Keep the current project's TanStack Start bootstrap (`router.tsx`, `start.ts`, `server.ts`, `vite.config.ts`) intact. Regenerate `routeTree.gen.ts` automatically via the plugin.

### 2. Apply Flip7 design system to `src/styles.css`

Replace the current oklch neutral tokens with Flip7's palette (converted to hex/oklch):
- `--background` → Surface Base `#EFF8F7`
- `--card` → `#FFFFFF` with cream `#FFF8E7` variant for inputs
- `--primary` → Teal `#2BA8A2` (+ `--primary-light` `#3CC4BD`, `--primary-dark` `#1E8C86`)
- `--accent` → Gold `#FFD23F` (for CTAs, highlights, first-place)
- `--destructive` / warning → Coral `#EF6C4A`
- `--info` → Sky Blue `#5DADE2` (Flip7 bonus / info)
- `--success` → `#27AE60`
- Add glow shadow tokens: `--shadow-card` (teal 10%), `--shadow-teal-glow`, `--shadow-coral-glow`, `--shadow-accent-glow`, `--shadow-sky-glow`
- Radius scale bumped to match Flip7 (md 16px, lg 24px, xl 32px, pill 999px)
- Chart palette: teal, gold, coral, sky-blue, cream-dark

### 3. Typography
Load a display font pair via `<link>` in `__root.tsx` head:
- Display / headings: **Fraunces** or **Archivo Black** (extra-bold, wide letter-spacing to echo Flip7's retro packaging feel)
- Body: **Manrope** (clean, matches the modern warmth)
- Apply generous letter-spacing (0.04–0.06em) on headings, uppercase for section titles
- Register in `@theme` as `--font-display` and `--font-sans`

### 4. Component reskin (visual only, no behavior/markup changes)

- **Buttons**: pill radius, gold gradient primary with soft gloss + gold-glow shadow; secondary teal outline; hover uses `-light` variants; active scale 0.97
- **Cards / KpiCard**: white background, 24px radius, teal-tinted shadow, 6px colored left accent bar (teal default, gold for highlighted KPIs, coral for negative/alert deltas)
- **StatusBadge**: pill shape, colored background tints (teal / gold / coral / sky-blue) with dark text
- **Section titles**: extra-bold, wide-tracked, 3px dashed teal bottom border
- **Tables / list rows**: cream `#FFF8E7` alt row tint, teal hover
- **Recharts**: axis + grid in muted teal; series colors follow palette; tooltip uses cream card with teal border
- **AppShell / nav**: teal top bar or cream sidebar with gold active indicator (keep same nav items and layout)
- **ThemeToggle**: keep, dark mode remaps tokens to deep teal `#1E8C86` background with cream text (kept subtle — not core focus since Flip7 is light-first)

### 5. Guardrails (what does NOT change)
- No changes to routes, page structure, KPIs shown, chart types, filters, buttons present, options, copy, or data logic
- No new sections, no removed sections
- No changed navigation items or URLs
- `/executive` and all other pages render the exact same information architecture as the source

### 6. Verification
- Build succeeds; run through `/`, `/executive`, `/sales`, `/collections`, `/customers`, `/activity-analysis`, `/stagnation`, `/reports`
- Capture screenshots via Playwright of `/executive` to confirm the reskin looks like Flip7 (teal + gold + coral, pill buttons, colored glows, dashed section dividers) while all cards/buttons/filters remain present

## Technical notes
- Tailwind v4: tokens live in `@theme inline` block in `src/styles.css`; utilities like `bg-primary`, `text-accent`, `shadow-card` regenerate from tokens
- Fonts loaded via `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` in root head — never `@import` in CSS
- Any `text-white` / `bg-black` / hex literals found in imported routes will be swapped to semantic tokens
- Recharts colors read from CSS vars (`var(--chart-1)` … `var(--chart-5)`)
