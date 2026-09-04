# orbit. Design System

Single source of truth for the UI of both the web app (`app/`) and the desktop app (`desktop/`).
Identity is fixed and must not change: the `orbit.` wordmark, `public/brand/orbit-mark.svg`, Inter (IBM Plex Sans Arabic for RTL), Lucide icons, and the palette in `BRAND-BOOK.md`.

## 1. Where things live

| Layer | File | Purpose |
| --- | --- | --- |
| Tokens | `app/globals.css` (`:root`, `.dark`) | Colors, radius, shadows, type, layout |
| shadcn bridge | `app/globals.css` (`@theme inline`) | Maps tokens to `components/ui/*` |
| Component classes | `app/globals.css` (`.o-*`) | Shell, cards, stats, chips, tables, forms |
| React primitives | `components/orbit/primitives.tsx` | `Btn`, `Card`, `StatCard`, `Chip`, `Tile`, `Table`, `EmptyState` … |
| Shell | `components/orbit/shell.tsx` | `AppShell`, `ThemeToggle`, `LangToggle` |
| Charts | `components/orbit/charts.tsx` | `StepLines`, `Bars`, `Donut`, `Legend` (recharts) |
| Theme state | `lib/theme.ts` | `useTheme()` — dark/light + EN/AR, persisted |

Import everything from `@/components/orbit`.

## 2. Tokens

### Color
| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--primary` | `#6358E8` | same | Primary action, selection, chart series 1 |
| `--primary-soft` | `#EEEDFF` | `#26244A` | Selected states, icon tiles |
| `--bg` | `#F6F7FB` | `#11111A` | Page background |
| `--surface` | `#FFFFFF` | `#1A1A27` | Cards, sidebar, inputs |
| `--surface-2` | `#FBFBFD` | `#20202E` | Inner tiles inside cards |
| `--surface-3` | `#F1F1F6` | `#262636` | Active nav, hover |
| `--text` / `--text-2` / `--muted` / `--muted-2` | ink scale | inverted | Heading / body / captions / axis |
| `--line` | `#E8E8EF` | `#2C2C3B` | 1px borders |
| `--green` `--coral` `--sky` `--orange` | brand | same | Status and data accents, each has a `-soft` background |
| `--ai-gradient` | lavender → sky | deep | AI actions only (`o-btn-ai`) |

Rule: violet is reserved for actions, selection and the first chart series. Status uses green/coral/orange/sky.

### Shape and elevation
- `--radius` 14px cards, `--radius-sm` 10px buttons and inputs, `--radius-xs` 8px chips, `--radius-lg` 22px modals.
- `--shadow-card` on every card. `--shadow-primary` only under primary buttons.
- Borders are always 1px `--line`.

### Type
- Body 13px / 1.45. Page title 26px 700 tracking -0.9px. Card title 17px 700. Stat value 26px 700.
- Captions 11 to 12px in `--muted`. Section labels 10px uppercase tracked 1.1px.
- Numbers keep Inter tabular defaults. Arabic falls back to IBM Plex Sans Arabic via `[dir=rtl]`.

### Layout
- Sidebar 236px sticky. Topbar 72px sticky, blurred `--bg`. Content padding 32px, grid gap 16px.
- Grids: `o-grid-4` stats, `o-grid-main` (1.6fr 1fr 1fr) chart row, `o-grid-wide` (1.25fr 1.25fr 1fr) second row.
- Breakpoints: 1280 (two columns), 1000 (compact sidebar), 720 (mobile, sidebar hidden).

## 3. Components

| Component | Class | Notes |
| --- | --- | --- |
| `AppShell` | `o-app o-sidebar o-topbar o-page` | Sidebar nav groups, workspace switcher, user, search, bell, AI button |
| `PageHead` | `o-page-head` | Title with ✦ spark, subtitle, right-aligned actions |
| `Btn` | `o-btn-{primary,secondary,ghost,ai,text}` | 40px tall, `size="sm"` 34px |
| `StatCard` | `o-stat` | Icon tile + label + inner tile with value and `Trend` chip |
| `Card` / `CardHead` | `o-card` | Title 17px, optional subtitle, optional right action |
| `Tile` | `o-tile` | Top Automations style: title, big number, meta row, progress |
| `Insight` | `o-insight` | AI Insights style row |
| `Chip` | `o-chip.{tone}` | Status: green Active, violet Scheduled, neutral Completed |
| `Table` | `o-table` | Muted header row on `--surface-2`, 1px row dividers |
| `EmptyState` | `o-empty` | Used whenever a module has no real data |
| `StepLines` / `Bars` / `Donut` | `o-chart` | recharts, tokens via CSS vars, custom `o-tooltip` |

## 4. Theme

`useTheme()` toggles `.dark` on `<html>`, sets `color-scheme`, `dir` and `lang`, and persists to localStorage (`orbit-theme`, `orbit-lang`). Every color in the app must come from a token so the toggle covers all surfaces, including shadcn components through the `@theme inline` bridge.

## 5. Data rule

The design system ships no fake numbers. Charts and tables render `EmptyState` until a connected source (Agent Reach, Gmail, CRM records) returns real rows. See `AGENT_REACH_INTEGRATION.md`.
