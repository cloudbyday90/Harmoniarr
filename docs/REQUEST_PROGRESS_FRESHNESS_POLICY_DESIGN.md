# Request Progress Freshness Policy Design

> Phase 15 of the request-experience hardening track. This document covers the
> freshness policy for persisted Downloading-stage transfer observations.

## Problem

Phase 14 renders a Downloading-stage progress bar from the Phase 13 persisted
transfer projection. That projection includes `observedAt`, which is the time
Harmoniarr last reconciled the external slskd transfer state. The value is not a
request-time live reading.

Without an explicit freshness policy, the UI can accidentally imply that an old
percentage is current. Hiding every old value is also poor: an old observation
can still explain that a transfer had made progress before reconciliation fell
behind.

The goal is to preserve useful progress context while clearly marking old or
unknown observations.

## Research Baseline

Research was performed against official primary sources available through
May 31, 2026. URLs were discovered and verified through online search rather
than inferred.

### Freshness as age versus lifetime

[RFC 9111 HTTP Caching](https://datatracker.ietf.org/doc/html/rfc9111)
defines a response's age as elapsed time since generation or validation and
freshness as whether a freshness lifetime is greater than current age. Although
Harmoniarr transfer observations are not HTTP cache entries, this model gives a
clear, portable vocabulary: compute an observation age and compare it to an
explicit freshness lifetime.

Applied here:

- Freshness is derived from `now - observedAt`.
- A fixed threshold defines the expected lifetime of an observation.
- The UI does not infer freshness when there is no valid observation time.

### Eventually consistent read models

Microsoft's
[CQRS pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
calls out that read models can lag behind writes and that stale data requires
careful handling. Phase 13 intentionally chose a persisted read model rather
than a live slskd query, so the progressbar must communicate that lag
explicitly.

Applied here:

- Keep using the persisted read model.
- Treat stale progress as presentation metadata, not as a new command or server
  state.
- Do not trigger live reconciliation from the request page.

### Machine-readable observation time

MDN's
[`<time>` element documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/time)
recommends `datetime` for machine-readable dates and times.

Applied here:

- Render `observedAt` with a `<time datetime="...">` element when valid.
- Keep the visible copy compact.

### Relative-time display

MDN's
[`Intl.RelativeTimeFormat` documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat)
describes language-sensitive relative time formatting.

Applied here:

- Format observation age as "just now", "1 minute ago", or "2 hours ago"
  without introducing a date formatting dependency.
- Retain the absolute timestamp in the `<time>` title for inspectability.

### Status-message restraint

WCAG 2.2
[Success Criterion 4.1.3 Status Messages](https://www.w3.org/TR/WCAG22/#status-messages)
requires status messages to be programmatically determinable without moving
focus. W3C
[ARIA25](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA25) notes that
progressbar value changes are not live-region announcements by default.

Applied here:

- Do not add freshness age updates to the journey's live status region.
- Expose freshness in the progressbar description and visible text.
- Let polling update the text without forcing focus changes.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| **A - Hide stale progress** | Avoids any risk of overstating old data | Loses useful context; causes the bar to disappear during reconciliation delays; hides the difference between unknown and stale |
| **B - Downgrade stale determinate progress to indeterminate** | Avoids showing an old percent as active | Discards known history; can look like regression from 80% to unknown |
| **C - Keep progress and mark stale (chosen)** | Preserves context; explicit age; stable UI; no backend change | Requires users to understand a freshness label; stale percentage can still be visually prominent if styling is too subtle |
| **D - Trigger live refresh when stale** | Potentially freshest display | Reintroduces request-time slskd coupling; allows polling clients to amplify external calls; weakens Phase 13's security and performance boundary |

## Final Recommendation Stack

1. **Pure freshness classification**
   - Add freshness calculation to `src/client/lib/request-journey.js`.
   - Keep it deterministic by accepting `nowMs` and
     `transferProgressStaleAfterMs` options for tests.

2. **Two-interval default**
   - Mark observations stale after `120000ms`.
   - This is two default 60-second reconciliation intervals, giving one missed
     heartbeat of tolerance before warning.

3. **Three freshness states**
   - `fresh`: valid observation age is within threshold.
   - `stale`: valid observation age is above threshold.
   - `unknown`: missing/invalid observation timestamp or invalid client clock
     input.

4. **Preserve determinate values**
   - Do not hide or downgrade a stale percentage.
   - Add `freshness`, `observedAgeMs`, and `staleAfterMs` metadata to the stage
     progress model.

5. **Accessible presentation**
   - Render the age with `<time datetime="observedAt">`.
   - Use warning styling for stale observations and muted styling for unknown
     freshness.
   - Keep freshness copy outside the `role="progressbar"` element and connected
     through `aria-describedby`.

6. **Security boundary**
   - Do not add new endpoints, server queries, or external calls.
   - Continue displaying only percent, generic status, and observation time.

## Outcome

The Downloading progressbar now distinguishes fresh, stale, and unknown
observations. A stale value remains visible but is clearly labeled as an older
observation, preventing the UI from claiming a live transfer percentage while
retaining useful context for requesters.

## Future Design Areas

1. **Requester-safe candidate labels.** Completed in
   `REQUESTER_SAFE_CANDIDATE_LABELS_DESIGN.md`; requesters now receive generic
   source labels from the server pipeline projection while operator diagnostics
   stay available outside requester views.
2. **Retry-aware journey messaging.** Distinguish stale active transfer
   progress from "trying another source" after a failed or abandoned candidate.
3. **Importing-stage freshness and explanation.** Apply the same observed-age
   vocabulary to future Importing-stage validation, scan, and quarantine
   progress.
