# Activity Resource-State Consistency Design

Status: **Implemented.**

Date: 2026-07-31.

## 1. Purpose

Activity is the everyday explanation of what Harmoniarr has done and what
needs attention. It should not make a person interpret raw transport errors,
guess whether an empty table is still loading, or learn a different retry
pattern on each normal Activity page.

This slice standardizes passive read states for these normal Activity views:

- Activity timeline;
- History;
- Monitored Artists; and
- Releases.

It does not replace release-specific recovery in Wanted or the intentional
Advanced diagnostics tools. Those controls carry meaningful release and
provider context that a generic retry state cannot safely reproduce.

## 2. Official Sources Reviewed

The following official guidance was reviewed on 2026-07-31 for the requested
June 2026 baseline.

| Source | Design input |
| --- | --- |
| [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Repeated navigation and functions need consistent identification and predictable placement. State labels and retry actions therefore use the same vocabulary across the normal Activity pages. |
| [W3C ARIA22: `role=status`](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22) | Loading and empty-result changes are polite status updates with text, rather than visual skeletons or blank tables alone. |
| [MDN: ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions) | The live-region semantics exist before asynchronous content changes, so assistive technology can announce the result. |
| [Playwright Locators](https://playwright.dev/docs/locators) | Browser coverage targets roles, headings, and actions a person can perceive instead of component structure. |

## 3. Audit

| View | Existing strength | Inconsistency to remove |
| --- | --- | --- |
| Activity timeline | Has a useful loading status and filter-aware empty state. | It shows raw API text as an empty-state heading and does not offer an in-place retry. |
| History | Uses a skeleton before the table and has a useful empty state. | It exposes raw errors as a danger pill and has no semantic read-state region. |
| Monitored Artists | Has simple search and sort controls. | It uses inline-sized skeletons, exposes raw errors, and calls a zero-result search `No monitored artists`. |
| Releases | Separates recent and upcoming content well. | It exposes raw errors and repeats a different loading/empty implementation in each panel. |

## 4. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Fix each view locally | Lowest immediate file count. | Recreates state, accessibility, and retry behavior repeatedly. | Reject. |
| Expand the general `EmptyState` component | Reuses an existing primitive. | It would mix discovery-oriented iconography and route CTAs with loading and failure behavior. | Reject. |
| Add an Activity-specific resource-state component | One compact, neutral presentation for loading, empty, filtered-empty, and retryable read failures. | Adds a small component and requires view migration. | Adopt. |

## 5. Final Recommendation Stack

1. Add `ActivityResourceState` as a small ESM Vue component with loading,
   empty, and retryable-error modes. It must use semantic live regions, hide
   decorative skeletons from assistive technology, and use existing `hx-*`
   primitives and design tokens.
2. Use static, task-oriented failure copy such as `Could not load history`.
   Do not display raw API messages, stack details, source paths, or provider
   diagnostics in normal Activity views.
3. Give an initial read failure one `Try again` action. When stale data is
   still visible after a revalidation failure, retain the data and render a
   compact retry notice instead of replacing the entire page.
4. Treat no data and no matching filtered data differently. A clear search
   can return a person to existing monitored artists; an empty system state
   explains what will cause future records to appear.
5. Keep unavailable-resource presentation domain-specific. Music Queue
   release URLs continue to use `MusicQueueReleaseUnavailable`; this generic
   component must not infer authorization or resource existence.

## 6. Security And Accessibility

- The generic failure view never prints transport or server error messages.
  This avoids exposing provider configuration, internal paths, or identifiers
  in the normal Activity workspace.
- The only generic read-failure operation is a repeat of the same read. It
  does not alter state, bypass authorization, or start background work.
- Loading and empty states use `role="status"` with polite announcements;
  failures use an alert region and a clearly named retry control.
- Button labels are stable: the same read recovery action is always `Try
  again`.

## 7. Validation Plan

- Focused client contracts verify that the four views use the shared state
  component and that Monitored Artists distinguishes search-empty results.
- Browser acceptance simulates loading, initial failure, retry success, empty,
  and filtered-empty timeline/history states through accessible roles and
  button names.
- Client lint and production build validate the Vue component and templates.
- Full repository validation runs before publishing because the shared async
  read contract is used by multiple Activity surfaces.

## 8. Outcome

`ActivityResourceState` now provides the neutral loading, empty, and generic
retryable-error presentation used by Activity timeline, History, Monitored
Artists, and Releases.

- Timeline and History no longer render raw transport text. An initial failure
  gives one `Try again` action; a revalidation failure retains already visible
  events or rows behind a compact notice.
- Monitored Artists no longer uses inline skeleton sizing and now distinguishes
  an empty monitored-artist library from an empty search result.
- Releases uses the same state contract for both recent and upcoming panels
  while retaining their individual, useful empty-state explanations.
- Wanted continues to own its release-specific recovery actions, and Music
  Queue release availability continues to use its dedicated owner-safe state.

Focused client contracts, client and test lint, the production client build,
and browser acceptance passed on 2026-07-31. The browser run uses the actual
client bundle and proves loading, generic retry, redaction of raw failure
text, recovery success, and stale timeline retention after a refresh failure.
