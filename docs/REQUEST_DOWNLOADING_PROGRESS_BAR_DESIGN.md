# Request Downloading Progress Bar Design

> Phase 14 of the request-experience hardening track. This document covers the
> frontend APG progress bar for the Downloading stage and the candidate-selection
> policy used to choose the persisted transfer observation rendered there.

## Problem

Phase 13 added a requester-safe backend projection:

```json
{
  "transferProgress": {
    "status": "active",
    "percentComplete": 42,
    "observedAt": "2026-05-31T12:01:02.000Z"
  }
}
```

The request journey can now render quantitative progress in the Downloading
stage, but it must avoid three regressions:

1. It must not expose the candidate's internal planning snapshot, peer details,
   file names, filesystem paths, or byte counts.
2. It must not announce every polling update to screen readers.
3. It must not make the request journey depend on backend-only policy or Vue
   component state.

The goal is to select the single candidate driving the active Downloading stage,
surface its persisted percentage when available, and fall back to an
indeterminate progress bar when the transfer is active but the percentage is
not yet observed.

## Research Baseline

Research was performed against official primary sources available through
May 31, 2026. URLs were discovered and verified through online search rather
than inferred.

### Progressbar semantics

The WAI-ARIA role definition for
[progressbar](https://www.w3.org/TR/aria-role/roles#progressbar) describes it
as the status of a long-running task and says authors should provide
`aria-valuenow`, `aria-valuemin`, and `aria-valuemax` unless the value is
indeterminate. It also says progress bars are read-only and that assistive
technologies usually render values as a percentage of the range.

Applied here:

- The Downloading indicator is read-only.
- Determinate progress uses a 0 to 100 range.
- Indeterminate progress omits `aria-valuenow`.
- The value is not user-editable and no keyboard interaction is added.

### APG range-property practice

The WAI-ARIA Authoring Practices Guide page on
[range-related properties](https://www.w3.org/WAI/ARIA/apg/practices/range-related-properties/)
states that a `progressbar` only needs explicit min/max when the range is not
0 to 100, but needs `aria-valuenow` when the value is known. It also notes that
native `<progress>` can represent the same pattern.

Applied here:

- The custom visual track uses `role="progressbar"` so Harmoniarr can style it
  consistently in the request timeline.
- The component still follows APG range semantics: label, optional
  `aria-valuenow`, and bounded 0 to 100 values.

### Status announcements

WCAG 2.2
[Success Criterion 4.1.3 Status Messages](https://www.w3.org/TR/WCAG22/#status-messages)
requires status messages to be programmatically determinable so assistive
technologies can present them without moving focus.

W3C Technique
[ARIA25](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA25) notes that a
progressbar's value changes are not themselves a live region and that a separate
polite live region can convey progress changes. W3C Technique
[ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22) documents
`role="status"` as a polite, atomic status region.

Applied here:

- The request journey keeps its existing polite status announcement for current
  stage changes.
- The Downloading percentage is exposed through the progressbar value and
  visible text, but is not added to the journey's live status message.
- Polling refreshes can update the visual and accessible value without
  interrupting the user on every percentage tick.

### Native progress element

MDN's
[`<progress>` documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/progress)
identifies the native element as a task-completion indicator, describes the
absence of `value` as indeterminate, and recommends an accessible label. It
also notes the implicit `progressbar` role.

Applied here:

- Native `<progress>` remains a valid option.
- A custom `role="progressbar"` is chosen for design-system styling and because
  the adjacent text and track need to fit the existing vertical journey marker
  layout.

### Vue rendering

Vue's official
[conditional rendering guide](https://vuejs.org/guide/essentials/conditional)
states that `v-if` only renders when the condition is true, while `v-show`
keeps the element rendered and toggles display.

Applied here:

- The progress component is rendered with `v-if` only when a stage carries
  progress metadata.
- The progressbar role is not present on unrelated journey stages.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| **A - Render progress in each pipeline candidate row only** | Minimal journey change; keeps candidate context nearby | Does not satisfy the journey-stage request; user must expand candidate rows; no canonical active-candidate policy |
| **B - Add progress to every Downloading-ish candidate** | Transparent when multiple candidates are active | Visually noisy; harder to announce; risks implying parallel progress is request-level progress |
| **C - Aggregate all active candidates into one percentage** | Produces one request-level number | Requires byte totals or weighted transfer data that Phase 13 intentionally withheld; can misrepresent retries and parallel candidates |
| **D - Select one active candidate and render its persisted progress (chosen)** | One clear journey signal; preserves backend minimization; works with determinate and indeterminate states; testable as a pure policy | Eventually consistent; multiple active candidates are reduced to one display source; candidate-selection policy must be documented |

## Candidate Selection Policy

The journey selects a progress source only when the Downloading stage is active.
It never selects progress for completed, failed, skipped, cancelled, or pending
Downloading stages.

Eligible candidates:

- `candidate.status === "downloading"`, or
- `candidate.execution.runStatus` indicates queued/running execution work.

Ranking:

1. Prefer candidates with a numeric `transferProgress.percentComplete`.
2. Prefer higher percent complete.
3. Prefer newer `transferProgress.observedAt`.
4. Preserve API order as the final tie-breaker.

If no eligible candidate has a numeric percentage but a candidate is actively
downloading, the stage receives an indeterminate progress model. This preserves
truthfulness: work is active, but Harmoniarr has not observed a useful
percentage yet.

## Final Recommendation Stack

1. **Pure journey derivation**
   - Add transfer-progress normalization and active-candidate selection to
     `src/client/lib/request-journey.js`.
   - Keep Vue state and rendering out of the policy.

2. **Stage-scoped progress model**
   - Attach a `progress` object only to the Downloading stage.
   - Keep `stage.detail` stable so the existing live region does not announce
     every polling percentage update.

3. **APG-compliant progress component**
   - Add a small `RequestStageProgressBar.vue` component.
   - Use `role="progressbar"` with an accessible label.
   - Set `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-valuenow` only
     when the value is determinate.
   - Keep text outside the progressbar element because descendants of a
     progressbar are presentational in accessibility APIs.

4. **Design-system styling**
   - Use Harmoniarr `--hx-` tokens, compact spacing, and responsive-safe text.
   - Avoid motion-heavy updates; the bar width can change, but there is no
     animated polling spinner or flashing status.

5. **Security and minimization**
   - Display only percent, observed timestamp recency text, and generic status.
   - Do not show peer usernames, transfer IDs, filenames, filesystem paths,
     byte totals, or execution messages in the journey progressbar.

## Outcome

The Downloading stage can render determinate transfer progress when the
persisted projection contains a percentage, and an indeterminate progressbar
when active transfer work exists but no percentage is available. The user sees
one request-level progress signal, and the request journey remains a pure
composition of existing read models.

## Future Design Areas

1. **Progress freshness policy.** Decide whether stale observations should be
   visually degraded after a threshold such as two reconciliation intervals.
2. **Retry-aware journey messaging.** Distinguish "trying another source" from
   a failed Downloading stage when the system has queued a replacement
   candidate.
3. **Compact requester-safe candidate labels.** Explore replacing peer/folder
   candidate labels in requester views with generic source labels while keeping
   operator detail available in Activity.
