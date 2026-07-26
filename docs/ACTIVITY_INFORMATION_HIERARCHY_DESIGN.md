# Activity Information Hierarchy Design

**Status:** Implemented 2026-07-26  
**Scope:** Activity workspace and normal timeline presentation  
**Decision:** Make Activity a quiet, scan-first history surface. Show controls
and semantic emphasis only where they change the next decision.

## Problem

The timeline already has durable events, release stories, filters, safe
handoffs, and advanced diagnostics. Its presentation still competes with the
history itself:

- seven filter pills look like a command bar rather than a rare filter;
- every timeline row repeats a colored category pill even when the title states
  the outcome;
- the page-level subtitle, timeline subtitle, count status, and footer
  timestamp repeat related context; and
- Advanced diagnostics appears before normal Activity even though it is an
  exception path.

The result is correct but visually busy, especially for a home user who should
normally only scan for a completed release or a clear item needing help.

## Research

- [WCAG 2.2 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
  requires adequate pointer target sizing or spacing. The filter select and
  Refresh control retain comfortably sized native controls rather than a dense
  run of small pills.
- [WCAG 2.2 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
  calls for a visible focus indicator that scales with responsive controls. The
  select, Refresh button, links, and native disclosures keep explicit focus
  treatment.
- [WAI-ARIA overview](https://www.w3.org/WAI/standards-guidelines/aria/)
  emphasizes semantic regions, state, and live updates for dynamic web apps.
  The existing polite result status remains the sole refresh/count announcement.
- The [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
  recommends familiar accessible control patterns. A labeled native select is
  more predictable than treating a set of filters as a custom tab widget.
- [OpenTelemetry’s log data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  treats named events and timestamps as distinct records. The UI can reduce
  visual repetition without altering the immutable event ledger.

## Options Considered

### Keep the pill-heavy layout

**Pros:** Every category is always visible; no implementation change.  
**Cons:** Repeated category labels compete with event titles and make the page
feel like a control panel.  
**Decision:** Reject.

### Replace the filter pills with custom tabs or a toolbar

**Pros:** Could offer keyboard shortcuts and visible categories.  
**Cons:** Introduces custom interaction semantics for an infrequently used
filter and still consumes horizontal space on mobile.  
**Decision:** Reject.

### Use a labeled native select with attention-only row emphasis

**Pros:** Familiar, compact, keyboard-accessible, responsive, and preserves
every existing filter. Event titles carry normal context; the one colored pill
is reserved for a repair state.  
**Cons:** Categories are not all visible simultaneously.  
**Decision:** Adopt.

### Remove timestamps from the timeline

**Pros:** Fewer repeated labels.  
**Cons:** Removes critical chronology from history.  
**Decision:** Reject. Keep one timestamp per top-level row; disclose detailed
step timestamps only when a release story is expanded.

### Remove Advanced diagnostics from Activity

**Pros:** Simplest normal path.  
**Cons:** Breaks the operator troubleshooting boundary and existing diagnostic
routes.  
**Decision:** Reject. On the normal timeline route, move the collapsed
disclosure below the timeline; keep it ahead of the selected diagnostic view.

## Design Contract

1. The workspace title supplies the page purpose. The timeline heading does
   not repeat explanatory body copy.
2. The toolbar has one labeled `Show activity` native select, one concise
   result/status message, one freshness cue, and Refresh.
3. Normal timeline rows use the title, timestamp, marker tone, and safe
   handoff. They do not show a category pill.
4. Rows requiring a repair show one `Needs attention` warning pill. This is the
   only routine row-level status chrome.
5. The selected raw-event filter still applies before release-story projection;
   coalescing, filters, handoffs, and durable events are unchanged.
6. Advanced diagnostics is visually secondary beneath the normal timeline and
   remains first when the operator directly opens a diagnostic route.

## Security And Accessibility

1. This is a client-only presentation change. API payloads, event retention,
   authorization, and diagnostics data remain unchanged.
2. No provider paths, source users, credentials, raw errors, or internal IDs
   are added to the normal timeline.
3. Native controls retain keyboard support and visible focus. The filter is
   explicitly labeled and the existing Activity status region remains polite.
4. Attention relies on a label and marker tone, never color alone.
5. Responsive CSS uses design tokens and keeps controls at least 32px high;
   controls retain sufficient surrounding spacing at mobile width.

## Recommendation Stack

1. Keep Activity as event history, not a control workspace.
2. Use a native select for the rare filter task and preserve all filter values.
3. Reserve semantic badges for actionable exceptions only.
4. Keep one precise timestamp per top-level item and move freshness beside
   Refresh.
5. Keep advanced diagnostics available but visually after normal history.

## Implementation And Verification

- Replaced the category-pill filter bar with a labeled native select.
- Moved freshness into the header action area and removed the repeated footer
  timestamp.
- Rendered row metadata as a timestamp plus an attention-only warning pill.
- Reordered collapsed Advanced diagnostics below the normal timeline.
- Added browser verification with desktop and mobile visual evidence, filter
  interaction, attention emphasis, disclosure behavior, and page-error checks.
- Validation passed: `npm run lint:client`, `npm run lint:test`,
  `npm run build:client`, `npm run test:client`,
  `node --test --test-concurrency=1 test/browser/activity-information-hierarchy-browser-verification.test.js`,
  and the existing `activity-music-queue-lifecycle-browser-verification` suite.

## Next Item

The next high-value item is **Music Queue release-row hierarchy cleanup**:
apply the same outcome-first approach to reduce repeated status chips and
secondary metrics on release rows, keeping the primary state, next action, and
quality stop immediately scannable. Verify the release list at desktop and
mobile widths before changing deeper match-review details.
