---
description: Harmoniarr-specific UI skill covering the design system, CSS tokens, component architecture, composable patterns, and layout conventions. Use when building or modifying any Vue component, view, style, or UI feature in Harmoniarr. Covers the --hx- design token system, theme switching, app shell layout, responsive breakpoints, and all CSS primitives.
name: harmoniarr-ui
---
# Harmoniarr UI Skill

Guide for building and modifying the Harmoniarr frontend — a dense ops-console music library manager built with Vue 3 Composition API, Vue Router 5, Express 5, PostgreSQL, and Vite 8.

## When to Use This Skill

- Creating or editing Vue components, views, or composables
- Adding CSS that uses the `--hx-` design token system
- Modifying the app shell, sidebar, topbar, or navigation
- Implementing theme-aware styling (light/dark)
- Building new pages or workspace sections
- Reviewing or fixing layout and responsive issues

## Architecture Overview

```
src/client/
  App.vue              — Root component (just <RouterView />)
  main.js              — App entry point
  router.js            — All routes with guards
  styles.css           — Legacy stylesheet (warm aesthetic)
  design-system.css    — Active design system (ops console v2, loads AFTER styles.css)
  components/          — Reusable components (43 files)
    home/              — Home/dashboard landing sub-components
    media/             — Media/artwork sub-components
  views/               — Page-level route components (35 files)
  composables/         — Vue 3 composables (60 files)
  state/               — Global state stores (session, etc.)
  lib/                 — Utilities (router-scroll, etc.)
  assets/              — Static assets
  workers/             — Web workers
```

## Design System

Harmoniarr uses a CSS custom property design system with the `--hx-` prefix. All tokens are defined in `src/client/design-system.css`.

### Design Philosophy

- **Dense ops console** — information-dense, minimal whitespace, compact controls
- **Dark chrome** — sidebar and topbar are always dark regardless of theme
- **Theme-aware content** — main content area supports light and dark themes
- **8px base grid** — spacing follows a 4px/8px rhythm

### Color Tokens

```
--hx-bg-app          #0e1418       App background (behind everything)
--hx-bg-canvas       #f4f6f8 / #0d1117   Main content background (light/dark)
--hx-bg-surface      #ffffff / #161b22    Card/panel background
--hx-bg-surface-muted  #eef1f4 / #1c2128  Muted surface (hover, toolbar)
--hx-bg-surface-sunken #e6ebef / #10151b  Sunken/inset surface
--hx-bg-sidebar      #0f1820       Sidebar (always dark)
--hx-bg-topbar       #14202a       Topbar (always dark)
--hx-bg-overlay      rgba(...)     Modal/backdrop overlay
```

### Text Tokens

```
--hx-text-strong     Primary text (headings, emphasis)
--hx-text            Default body text
--hx-text-muted      Secondary/helper text
--hx-text-faint      Tertiary/hint text
--hx-text-on-dark    Text on dark backgrounds (sidebar/topbar)
--hx-text-on-dark-muted  Muted text on dark backgrounds
--hx-text-on-dark-faint  Faint text on dark backgrounds
```

### Accent and Semantic Colors

```
--hx-accent          #5eadff       Primary accent (blue)
--hx-accent-strong   #2f86d6       Stronger accent (buttons, CTAs)
--hx-accent-soft     rgba(...)     Soft accent background
--hx-success         #2f9e6b       Success/healthy
--hx-warning         #c08a16       Warning/caution
--hx-danger          #c54545       Error/danger
--hx-info            #5eadff       Informational
```

Each semantic color has a `-soft` variant for background usage (e.g., `--hx-success-soft`).

### Spacing Scale

```
--hx-space-1: 4px    --hx-space-5: 20px
--hx-space-2: 8px    --hx-space-6: 24px
--hx-space-3: 12px   --hx-space-7: 32px
--hx-space-4: 16px   --hx-space-8: 40px
```

### Typography Scale

```
--hx-font-sans: "Inter", "IBM Plex Sans", "Segoe UI", system-ui, sans-serif
--hx-font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace
--hx-text-xs:   0.72rem    --hx-text-md:  1rem
--hx-text-sm:   0.82rem    --hx-text-lg:  1.15rem
--hx-text-base: 0.92rem    --hx-text-xl:  1.4rem
                            --hx-text-2xl: 1.75rem
```

### Border and Radius

```
--hx-border-subtle   rgba(...)  Lightest borders
--hx-border                     Default borders
--hx-border-strong              Strong emphasis borders
--hx-border-on-dark             Borders on dark chrome
--hx-border-on-dark-strong      Strong borders on dark chrome

--hx-radius-xs: 4px   --hx-radius-md: 10px
--hx-radius-sm: 6px   --hx-radius-lg: 14px
                      --hx-radius-pill: 999px
```

### Shadow Scale

```
--hx-shadow-sm   Subtle elevation (cards)
--hx-shadow-md   Medium elevation (dropdowns)
--hx-shadow-lg   High elevation (modals, menus)
```

### Layout Constants

```
--hx-topbar-height:         56px
--hx-sidebar-width:         220px
--hx-sidebar-width-collapsed: 64px
--hx-bottom-nav-height:     60px
```

## Theme System

Themes are controlled via `data-theme` attribute on `<html>`:

- **System preference**: `prefers-color-scheme: dark` applies dark tokens when no `data-theme` is set
- **User override**: `data-theme="dark"` or `data-theme="light"` overrides system preference
- **Sidebar/topbar**: Always use dark-chrome tokens regardless of theme

```css
/* Check current theme in JS */
document.documentElement.getAttribute('data-theme')

/* Theme is managed by the useTheme composable */
```

## App Shell Layout

The app uses a CSS Grid shell defined by `.hx-app`:

```
+------------------+----------------------------------------+
|    TOPBAR        |         TOPBAR (brand/search/actions)   |
|    brand col     |         content columns                 |
+------------------+----------------------------------------+
|    SIDEBAR       |         MAIN CONTENT                    |
|    (nav links)   |         (.hx-main)                      |
|                  |         scrollable vertically            |
+------------------+----------------------------------------+
```

### Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| `> 960px` | Full sidebar (220px) + main |
| `641–960px` | Collapsed sidebar (64px, icons only) |
| `<= 640px` | No sidebar, bottom nav bar, hamburger drawer |

### Shell Classes

```html
<div class="hx-app">
  <header class="hx-topbar">...</header>
  <nav class="hx-sidebar">...</nav>
  <main class="hx-main">
    <div class="hx-page">
      <div class="hx-page-header">...</div>
      <!-- content -->
    </div>
  </main>
</div>
```

## CSS Primitives

### Cards

```html
<div class="hx-card">
  <div class="hx-card-header">
    <div>
      <h3 class="hx-card-title">Title</h3>
      <p class="hx-card-subtitle">Description</p>
    </div>
    <div class="hx-card-actions">...</div>
  </div>
  <div class="hx-card-body">...</div>
  <div class="hx-card-body is-flush">...</div> <!-- No padding -->
</div>
```

### Buttons

```html
<button class="hx-btn">Default</button>
<button class="hx-btn" data-variant="primary">Primary</button>
<button class="hx-btn" data-variant="ghost">Ghost</button>
<button class="hx-btn" data-variant="danger">Danger</button>
<button class="hx-btn hx-btn-icon">Icon only</button>
```

### Pills (Status Indicators)

```html
<span class="hx-pill">Default</span>
<span class="hx-pill" data-tone="success">Healthy</span>
<span class="hx-pill" data-tone="warning">Warning</span>
<span class="hx-pill" data-tone="danger">Error</span>
<span class="hx-pill" data-tone="info">Info</span>
<span class="hx-pill" data-tone="upcoming">Upcoming</span>
```

### Stat Blocks

```html
<div class="hx-stat-grid">
  <div class="hx-stat">
    <span class="hx-stat-label">LABEL</span>
    <span class="hx-stat-value">1,234</span>
    <span class="hx-stat-meta">Meta info</span>
  </div>
</div>
```

### Tables

```html
<div class="hx-table-wrap">
  <div class="hx-table-toolbar">
    <span class="hx-table-toolbar-meta">10 items</span>
    <!-- filter controls -->
  </div>
  <div class="hx-table-scroll">
    <table class="hx-table">
      <thead><tr><th>Col</th></tr></thead>
      <tbody><tr><td>Data</td></tr></tbody>
    </table>
  </div>
</div>
```

### Forms

```html
<div class="hx-form-row">
  <div class="hx-field">
    <label class="hx-field-label">Label</label>
    <input class="hx-input" />
  </div>
</div>
```

Also available: `.hx-select`, `.hx-textarea`

### Tabs

```html
<div class="hx-tabbar-wrap">
  <div class="hx-tabbar">
    <a class="hx-tab router-link-exact-active">Tab 1</a>
    <a class="hx-tab">Tab 2 <span class="hx-tab-count">3</span></a>
  </div>
</div>
```

Use the `useTabbarOverflow` composable to add scroll-fade indicators.

### Empty States

```html
<div class="hx-empty">
  <h3 class="hx-empty-title">No items found</h3>
  <p class="hx-empty-copy">Description of what to do next.</p>
</div>
```

### Skeleton Loaders

```html
<div class="hx-skeleton-stack">
  <div class="hx-skeleton"></div>
  <div class="hx-skeleton" data-size="lg"></div>
  <div class="hx-skeleton" data-size="sm"></div>
</div>
```

### Sidebar Navigation

```html
<nav class="hx-sidebar">
  <div class="hx-sidebar-nav">
    <span class="hx-sidebar-section-label">Section</span>
    <a class="hx-sidebar-link router-link-active">
      <span class="hx-sidebar-link-icon"><!-- SVG --></span>
      <span class="hx-sidebar-link-label">Label</span>
      <span class="hx-sidebar-link-badge" data-tone="warning">3</span>
    </a>
    <div class="hx-sidebar-divider"></div>
  </div>
  <div class="hx-sidebar-footer">...</div>
</nav>
```

## Vue Component Conventions

### Component Structure

Single-file components (`.vue`) with `<template>`, `<script setup>`, and optionally `<style scoped>`:

```vue
<template>
  <div class="hx-card">
    ...
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSomeComposable } from '../composables/useSomeComposable.js';
</script>
```

### Composable Pattern

Composables are in `src/client/composables/` and follow the `use*.js` naming convention:

```js
import { ref, readonly } from 'vue';

export function useFeature() {
  const data = ref(null);
  const loading = ref(false);

  async function fetch() {
    loading.value = true;
    // ...
    loading.value = false;
  }

  return { data: readonly(data), loading: readonly(loading), fetch };
}
```

Key composables:
- `useTheme` — Theme switching
- `useBreakpoint` — Responsive breakpoint detection
- `useTabbarOverflow` — Scroll-fade for tab bars
- `useToast` — Toast notifications
- `useAsyncResource` — Async data fetching pattern
- `useSession` / `sessionStore` — Auth state

### View Pattern

Views are page-level components mounted by the router. They typically:
- Use the `.hx-page` wrapper (provided by `AppShell`)
- Include a `.hx-page-header` with title and actions
- Use composables for data fetching
- Delegate to child components for UI sections

```vue
<template>
  <div class="hx-page-header">
    <div>
      <h1 class="hx-page-title">Page Title</h1>
      <p class="hx-page-subtitle">Description</p>
    </div>
    <div class="hx-page-actions">
      <button class="hx-btn" data-variant="primary">Action</button>
    </div>
  </div>
  <!-- Content grid -->
</template>

<script setup>
import { useFeature } from '../composables/useFeature.js';
const { data, loading } = useFeature();
</script>
```

### Workspace Pattern

Settings and Activity use a workspace layout with sub-navigation:

```
views/
  SettingsWorkspaceView.vue     — Parent layout with nav
  SettingsGeneralView.vue       — Child content
  SettingsConnectionsView.vue   — Child content
  ...
```

The workspace parent renders a `.settings-nav-list` grid of links and a `<RouterView />` for child content. This is registered in `router.js` as nested routes.

## CSS Conventions

### Naming

- Design system classes use the `.hx-` prefix (e.g., `.hx-card`, `.hx-btn`, `.hx-pill`)
- Legacy classes from the original stylesheet are preserved (e.g., `.panel-dark`, `.panel-light`, `.pill`, `.pill-row`)
- The design system (`design-system.css`) overrides legacy classes to match the ops console aesthetic

### Styling Approach

- **No Tailwind, no CSS-in-JS, no CSS Modules** — plain CSS files
- `styles.css` loads first (legacy), then `design-system.css` overrides
- New components should use `.hx-` prefixed classes exclusively
- Avoid `<style scoped>` when possible — prefer global `.hx-` primitives
- If scoped styles are needed, keep them minimal

### Adding New CSS

1. Check if an existing `.hx-` primitive covers the pattern
2. If not, add new primitives to `design-system.css` with the `.hx-` prefix
3. Use CSS custom properties for any theme-dependent values
4. Test in both light and dark themes
5. Test at all three breakpoints (>960px, 641-960px, <=640px)

## Route Structure

| Route | View | Description |
|---|---|---|
| `/app` | DashboardView | Main dashboard |
| `/app/onboarding` | OnboardingView | Setup wizard |
| `/app/discover` | DiscoverView | Music discovery |
| `/app/library` | LibraryView | Library browser |
| `/app/search` | SearchView | Search interface |
| `/app/requests` | RequestMusicView | Request music |
| `/app/artists/:mbid` | ArtistDetailView | Artist detail |
| `/app/activity/*` | ActivityWorkspaceView | Activity sub-routes |
| `/app/settings/*` | SettingsWorkspaceView | Settings sub-routes |
| `/login` | LoginView | Authentication |
| `/bootstrap` | BootstrapSetupView | Initial setup |

## State Management

No Vuex/Pinia. State is managed through:
- **Composables** — Local component state via `ref()`/`reactive()`
- **`state/session.js`** — Global session/auth store (plain JS module)
- **Route guards** — Auth and role-based access in `router.js`

Roles: `admin`, `operator`, `requester`. Requesters have restricted route access.

## Build and Dev Commands

```bash
npm run build:client     # Build Vue client with Vite
npm run build:server     # Build Express server
npm run build            # Build both
npm run start            # Run production server
npm run lint:client      # Lint Vue/JS client code
npm run test:client      # Run client tests
npm run test:browser     # Run browser (Playwright) tests
```

## Common Patterns

### Status Indicator with Dot

```html
<span class="hx-pill" data-tone="success">
  <span class="hx-pill-dot"></span>
  Healthy
</span>
```

### Toolbar with Filters

```html
<div class="hx-table-toolbar">
  <span class="hx-table-toolbar-meta">Showing 10 of 42</span>
  <div class="ops-filter-bar">
    <button class="ops-filter-tab" data-active>All</button>
    <button class="ops-filter-tab">Active</button>
  </div>
</div>
```

### Sticky Save Bar

```html
<div class="settings-save-bar">
  <span class="hx-text-muted">Unsaved changes</span>
  <button class="hx-btn" data-variant="primary">Save</button>
</div>
```

## Checklist for New Components

- [ ] Uses `.hx-` design tokens and primitives
- [ ] Works in both light and dark themes
- [ ] Responsive at all three breakpoints
- [ ] Uses existing composables for data fetching
- [ ] Follows `<script setup>` pattern
- [ ] Touch targets >= 44px on mobile
- [ ] Semantic HTML with proper ARIA attributes
- [ ] No inline styles — use CSS custom properties
- [ ] Skeleton loading states for async data
- [ ] Empty state when no data is available
