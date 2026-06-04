# Feedback & Empty-State Convention Design (Phase 9)

> Phase 9 of the platform UI consolidation effort. Builds on the Phase 8
> `OperationStatusBadge` + unified add-to-monitored work
> ([OPERATION_STATUS_BADGE_AND_ADD_ARTIST_AFFORDANCE_DESIGN.md](OPERATION_STATUS_BADGE_AND_ADD_ARTIST_AFFORDANCE_DESIGN.md)).
> Where Phase 8 unified *status* presentation behind one badge primitive, Phase 9
> unifies *feedback* (toasts) and *empty-state affordances* behind one contract
> each.

## 1. Scope

Two consolidations, both client-only:

1. **Toast / feedback convention** — the add flow, request flow, and monitoring
   surfaces each emitted toasts with slightly different copy and severity rules,
   and the renderer announced every toast identically. Define a single feedback
   contract: severity → persistence, severity → ARIA role, de-duplication, and an
   optional action link. Route every surface through it.
2. **Empty-state & affordance audit** — `EmptyState` supported only a
   *navigational* CTA (`ctaTo` → `RouterLink`). Five call sites attempted an
   *action* CTA (`cta-label` + `@cta-click`) that the component never declared or
   rendered, leaving the buttons completely dead. Make `EmptyState` the single
   empty-state primitive supporting both affordances behind one accessible
   pattern.

## 2. Research (May 2026)

> **MCP status:** Tavily search remained unavailable this phase ("Invalid API
> key"). Corroboration was gathered via the GitHub MCP tools against
> `w3c/aria-practices` (ARIA Authoring Practices Guide) and `vuejs/docs`.

### ARIA live regions (W3C ARIA APG)

- `role="alert"` carries an **implicit** `aria-live="assertive"` and
  `aria-atomic="true"`. Assistive technology interrupts the user to announce it.
  Intended for **critical, time-sensitive** messages — i.e. errors and warnings.
- `role="status"` carries an **implicit** `aria-live="polite"`. The announcement
  waits for a pause. Intended for **advisory / non-critical** updates — i.e.
  success and info.
- A toast/notification region should be a labelled wrapper; each notification
  carries its own live semantics via `role`. Stacking a blanket
  `aria-live="polite"` on the container *and* `role="status"` on every item
  flattens errors to polite announcements — the exact pre-Phase-9 defect.

### Vue component conventions (`vuejs/docs`)

- Events a component emits should be declared with `defineEmits` so the
  component's contract is explicit and the template `$emit` calls are validated.
- Conditional affordances are best expressed as a single `v-if/v-else-if/v-else`
  ladder in the template rather than divergent per-call-site markup.

## 3. Findings (pre-Phase-9 state)

### Toast drift

- `useToast.push` auto-dismissed **every** tone after a fixed `4000ms`, including
  errors — contradicting the documented "errors persist until dismissed" rule.
- `ToastStack.vue` rendered the container with `aria-live="polite"` and **every**
  item with `role="status"`, so error toasts were never announced assertively.
- No de-duplication: repeated identical feedback stacked up.
- No action affordance: feedback could not offer a "View" / "Retry" link.

### Dead empty-state CTAs

`EmptyState` only rendered its action block when `ctaTo || $slots.cta`. These
five sites passed only `cta-label` + `@cta-click`, so the button **never
rendered** and the handler **never fired**:

| Site | Intended action |
| --- | --- |
| `components/home/OperatorHomePanel.vue` (error state) | Retry → `refreshAll` |
| `views/LibraryView.vue` (load error) | Retry → `refreshAll` |
| `views/LibraryView.vue` (filtered empty) | Clear filters → `clearAll` |
| `views/MissingView.vue` (filtered empty) | Clear filters → `clearAll` |
| `views/MyRequestsView.vue` (filtered empty) | Clear filters → `clearAll` |

## 4. Design

### 4.1 Feedback convention — `lib/toast-feedback.js`

A new framework-agnostic module holds the pure rules so they are unit-testable
without mounting Vue:

- `resolveToastDuration(tone, explicitDurationMs)` — explicit numeric override
  wins (clamped to ≥ 0); otherwise **errors persist** (`0`) and every other tone
  auto-dismisses (`DEFAULT_TOAST_DURATION_MS = 4000`).
- `resolveToastRole(tone)` — `error`/`warning` → `'alert'` (assertive);
  `success`/`info` → `'status'` (polite).
- `isDuplicateToast(toasts, tone, message)` — identical tone + message detection.

`useToast.js` composes these:

- `push(tone, message, { durationMs, action })` now derives its duration from
  `resolveToastDuration`, **de-duplicates** identical tone + message (returns the
  existing toast id), and carries an optional `action: { label, onClick }` on the
  toast shape. The public `success` / `error` / `info` / `warning` / `dismiss`
  API is unchanged — every existing caller keeps working.

`ToastStack.vue`:

- The container is a labelled `role="region"` **without** a blanket `aria-live`.
- Each item's role is `:role="resolveToastRole(toast.tone)"` so errors/warnings
  announce assertively and success/info politely.
- Renders an optional action button (`hx-toast__action`) before the dismiss
  button; activating it runs the handler then dismisses the toast.

### 4.2 Empty-state affordance — `EmptyState.vue`

- Declares `defineEmits(['cta-click'])`.
- Adds a `ctaVariant` prop (default `'primary'`) for the action button.
- The action block renders for `ctaTo || ctaLabel || $slots.cta`, branching:
  - `ctaTo` → `<RouterLink>` (navigational affordance) — unchanged.
  - `ctaLabel` (no `ctaTo`) → `<button type="button" @click="$emit('cta-click')">`
    (action affordance) — **new**, fixes all five dead sites with zero call-site
    changes.
  - otherwise → `cta` slot.

## 5. Security

Both changes are client-only and presentational.

- No new endpoints, requests, or data flows are introduced. Action handlers
  (`refreshAll`, `clearAll`, custom `onClick`) are existing in-view functions —
  no new privilege or surface.
- Toast messages render as text (`{{ message }}`) — no `v-html`, no injection
  vector. The dismiss/action SVGs are static and `aria-hidden`.
- De-duplication reduces DOM churn under feedback bursts.
- Net result is an **accessibility correctness improvement** (errors now
  announced assertively; previously-dead controls now operable), not a new
  attack surface.

## 6. Files changed

| File | Change |
| --- | --- |
| `src/client/lib/toast-feedback.js` | **New.** Pure feedback-convention helpers. |
| `src/client/composables/useToast.js` | Compose convention; add dedupe + action. |
| `src/client/components/ToastStack.vue` | Tone → ARIA role; render action button. |
| `src/client/components/EmptyState.vue` | `cta-click` emit + action-button affordance + `ctaVariant`. |
| `test/client/toast-feedback-contract.test.js` | **New.** 7 tests. |
| `test/client/empty-state-affordance-contract.test.js` | **New.** 5 tests. |
| `docs/FEEDBACK_AND_EMPTY_STATE_CONVENTION_DESIGN.md` | **New.** This document. |

The five empty-state call sites required **no edits** — they were already wired
for the affordance the component now provides.

## 7. Validation

- `node --test test/client/toast-feedback-contract.test.js test/client/empty-state-affordance-contract.test.js` — 11/11 pass.
- ESLint over changed files — clean.
- `scripts/check-copyright.js`, `check:test-hygiene`, full `npm test` — see commit.

## 8. Pros / cons & final recommendation stack

### Toast / feedback convention

| Option | Pros | Cons |
| --- | --- | --- |
| **A. Pure `toast-feedback.js` lib + enhanced `useToast`/`ToastStack` (chosen)** | One persistence rule; correct `alert`/`status` roles; dedupe; optional actions; pure helpers unit-testable; backward-compatible API | Slightly larger toast shape |
| B. Per-call options at every site | No new file | Convention lives in callers' heads; drift returns |
| C. External toast library | Feature-rich | New dependency, supply-chain + bundle cost, restyle churn |

### Empty-state affordance

| Option | Pros | Cons |
| --- | --- | --- |
| **A. One `EmptyState` primitive supporting nav + action CTAs (chosen)** | Fixes all five dead CTAs with zero call-site churn; one accessible pattern | One emit + small template branch |
| B. Fix each site ad-hoc | Localized | Re-introduces divergence; misses the root cause |

**Final recommendation stack:** `lib/toast-feedback.js` (pure convention) +
backward-compatible `useToast` (dedupe, persistence, optional action) +
tone-aware `ToastStack` (`alert`/`status`) + `EmptyState` dual-affordance CTA
(`ctaTo` link / `ctaLabel` action button). Client-only, no new dependency, no new
surface.

## 9. Three high-value future areas

1. **Operation ledger & ignore-list lifecycle** *(carried from Phase 8)* — the
   heaviest remaining item: retention/pruning policy, export, and
   backup/restore for the operation-run ledger and the artist/release ignore
   lists, including audit semantics and schema/migration design.
2. **Shared loading / skeleton convention** — loading states are still ad-hoc
   (spinners vs. inline text vs. nothing). Define one skeleton/loading primitive
   with consistent `aria-busy`/announce semantics, mirroring how status (Phase 8)
   and feedback (Phase 9) were unified.
3. **Unified confirm / destructive-action dialog** — cancel-request,
   clear-filters, delete, and reassign each confirm (or fail to confirm)
   differently. Define one confirm-dialog primitive with a consistent
   destructive-vs-safe affordance, focus management, and `role="alertdialog"`
   semantics, routing all destructive actions through it.
