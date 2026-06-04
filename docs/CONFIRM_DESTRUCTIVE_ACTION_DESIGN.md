# Unified Confirm / Destructive-Action Dialog Design

Status: Implemented (Phase 11)
Scope: Vue 3 client (`src/client`)
Related: `docs/FEEDBACK_AND_EMPTY_STATE_CONVENTION_DESIGN.md` (Phase 9 — toast/empty-state convention)

## 1. Problem

Confirmation of significant and irreversible actions was fragmented:

- A presentational `ConfirmDialog.vue` and a stateful `useConfirmDialog.js`
  composable both existed, but **no call site used the composable**. Instead,
  `OperationsView.vue`, `ImportCandidateApplyPanel.vue`, and
  `ImportCandidateDetailPanel.vue` each re-implemented the gating logic
  (`matches` / `canConfirm` / `buttonEnabled`) and the `v-model` wiring inline.
  This duplicated logic and let the behaviour drift between screens.
- Several genuinely destructive actions had **no confirmation at all** and fired
  immediately on click:
  - Cancel a media request — `RequestMusicView.vue` and `RequestDetailView.vue`.
  - Bulk-cancel selected requests — `RequestMusicView.vue`.
  - Remove a user from the ignore list — `ActivityIgnoredView.vue`.
- The dialog markup was missing `aria-describedby`, so the explanatory message
  was not programmatically associated with the dialog for assistive technology.

## 2. Research (current best practices, May 2026)

Sources were located and read through the GitHub MCP (the Tavily MCP remained
unavailable — "Invalid API key" — so it was not relied upon).

- **W3C WAI-ARIA Authoring Practices — "Alert and Message Dialogs" pattern**
  (`w3c/aria-practices`, `content/patterns/alertdialog/alertdialog-pattern.html`).
  Key requirements for an action-confirmation prompt:
  - The container has role `alertdialog` with `aria-modal="true"`.
  - It is labelled by its title via `aria-labelledby` **and** describes the
    message via `aria-describedby`.
  - Keyboard and focus behaviour inherits the modal-dialog pattern: focus moves
    into the dialog on open, is trapped while open, `Escape` dismisses, and focus
    returns to the invoking element on close.
  - Mark a dialog modal **only** when application code makes outside content
    inert for everyone and visual styling obscures it.
- **Native `<dialog>.showModal()`** (Baseline since 2022) is the current
  best-practice substrate: it provides the top layer, focus trapping, backdrop
  inertness, `Escape` handling, and automatic focus return without bespoke JS.
  `ConfirmDialog.vue` already builds on it.

## 3. Findings

- The fix is primarily architectural: collapse the per-call-site wiring into a
  single imperative service so every destructive action is a one-liner, and make
  the one shared dialog APG-compliant.
- The pure gating logic (levels, exact-match, acknowledgement) is framework-free
  and belongs in a testable library shared by every consumer.

## 4. Design

### 4.1 Pure intent library — `lib/confirm-intent.js`

Framework-free, fully unit-tested. Exports:

- `CONFIRM_LEVEL` — `none` | `checkbox` | `type_to_confirm`.
- `CONFIRM_TONE` — `danger` | `primary`.
- `normalizeConfirmLevel` / `normalizeConfirmTone` — defensive normalization
  (unknown level → `none`, unknown tone → `danger`).
- `normalizeConfirmRequest(options)` — resolves a caller options object into a
  complete request with trimmed copy and safe defaults. `confirmText` is only
  retained for `type_to_confirm`.
- `resolveTypedMatch` / `resolveConfirmGate` — derive `{ matches, canConfirm }`
  from the level, acknowledgement, and typed text.

`useConfirmDialog.js` and `ConfirmDialog.vue` now import `CONFIRM_LEVEL` from
this library (single source of truth).

### 4.2 Imperative service — `composables/useConfirm.js`

A module-scope reactive singleton (mirroring the `useToast` pattern):

- `useConfirm()` returns a `confirm(options) => Promise<boolean>` function.
  Call sites read naturally:

  ```js
  const confirm = useConfirm();
  if (!(await confirm({ title: 'Cancel request?', message: '…', confirmLabel: 'Cancel request' }))) {
    return;
  }
  await cancelMediaRequest({ mediaRequestId });
  ```

- `useConfirmHost()` exposes the host-facing bindings (`activeRequest`, gate
  state, `accept`, `cancel`, `setTyped`, `setAcknowledged`) for the single host.
- Opening a new confirmation while one is in flight auto-resolves the previous
  promise as `false`, so a stray prompt can never strand an unresolved promise.
- `accept()` is a no-op until the gate (`canConfirm`) is satisfied.

### 4.3 Single host — `components/ConfirmDialogHost.vue`

Mounted **once** in `AppShell.vue` alongside `ToastStack`. It renders the shared
`ConfirmDialog`, binds it to the service state, and resolves the active promise
on accept/cancel. There is exactly one alertdialog instance for the whole app.

### 4.4 Presentational dialog — `components/ConfirmDialog.vue`

Enhancements for APG compliance and reuse:

- Added `aria-describedby` wired to a rendered `#confirm-message` when a message
  is present (the APG alertdialog requirement that was missing).
- Added `message`, `confirmLabel`, `cancelLabel`, and `tone` props. `tone`
  switches the confirm button between danger (red) and primary (accent) styling.
- Still built on native `<dialog>.showModal()` for focus trap, `Escape`, backdrop
  inertness, and focus return. The `type_to_confirm` input blocks paste.

### 4.5 Migrations

Routed through the unified service:

- `RequestMusicView.vue` — per-request cancel and bulk cancel now gated.
- `RequestDetailView.vue` — cancel now gated.
- `ActivityIgnoredView.vue` — remove-from-ignore-list now gated.
- `OperationsView.vue` — destructive job triggers (`import_candidate_apply`,
  `library_organize_apply`, transcode preflight) migrated from ~30 lines of
  hand-wired dialog state + markup to a single `await confirm(...)`.

`useConfirmDialog.js` is retained (it has its own test suite and remains valid
for bespoke staged flows) but now sources `CONFIRM_LEVEL` from the shared lib.

### 4.6 Escalation guidance

- `none` — reversible-but-significant single actions (cancel one request, remove
  one ignore entry).
- `checkbox` — batch or higher-impact actions requiring explicit acknowledgement.
- `type_to_confirm` — irreversible bulk/filesystem actions (import apply, library
  organize) where the operator must type an exact phrase.

## 5. Security

- No new server endpoints. Confirmations are **client-side UX gates only**; the
  server continues to enforce authentication, authorization, and CSRF on every
  destructive call (e.g. `includeCsrf` on cancel / bulk-cancel). A bypassed
  client gate cannot perform an unauthorized mutation.
- No untrusted HTML is rendered — all dialog copy is text interpolation, so there
  is no XSS surface (OWASP A03).
- The `type_to_confirm` input disables paste to prevent accidental autofill of
  the confirmation phrase.

## 6. Files

New:
- `src/client/lib/confirm-intent.js`
- `src/client/composables/useConfirm.js`
- `src/client/components/ConfirmDialogHost.vue`
- `test/client/confirm-intent.test.js`
- `test/client/useConfirm.test.js`
- `test/client/confirm-dialog-contract.test.js`

Modified:
- `src/client/components/ConfirmDialog.vue` (aria-describedby, message, labels, tone)
- `src/client/components/AppShell.vue` (mount the host)
- `src/client/composables/useConfirmDialog.js` (re-export shared `CONFIRM_LEVEL`)
- `src/client/design-system.css` (primary-tone confirm button)
- `src/client/views/OperationsView.vue`
- `src/client/views/RequestMusicView.vue`
- `src/client/views/RequestDetailView.vue`
- `src/client/views/ActivityIgnoredView.vue`

No database migration or schema change.

## 7. Validation

- `node --test` over the new + existing confirm suites — green.
- `npm test` (lint, test hygiene, node + integration) — green.
- Copyright header check — green.

## 8. Recommendation summary

Option C (imperative promise-based service + single mounted host, reusing the
enhanced APG-compliant dialog) was selected over patching call sites (Option A)
or standardizing on the local stateful composable (Option B). It removes
per-site boilerplate, gives one accessible source of truth, closes the
unguarded-destructive-action gaps, and mirrors the proven `useToast` singleton.

## 9. Future areas (carried / newly identified)

1. **Slotted-body confirm migration** — `ImportCandidateApplyPanel.vue` and
   `ImportCandidateDetailPanel.vue` still drive `ConfirmDialog` directly because
   they render bespoke slotted bodies and staged execution/result views. Extend
   the imperative service with an optional render/slot escape hatch (or a
   component-driven variant) so these can adopt the unified path without losing
   their richer content.
2. **Shared loading/skeleton convention** (carried from Phase 9) — a single
   skeleton/spinner primitive and convention to match the unified toast and
   confirm conventions, eliminating ad-hoc "Loading…" strings.
3. **Operator-facing retention & export surface** (carried from Phase 10) —
   routes + UI plus an operator-triggered `ledger_retention` operation layered
   on the Phase 10 retention engine (its `previewLedgerRetention` is already the
   read model); destructive purges there would naturally use this unified dialog.
