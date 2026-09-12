# Artist and album asynchronous lifecycle design

Date: September 12, 2026. Baseline: `6db046a`.

## Problem

Artist detail is Harmoniarr's operator curation surface. Delayed album reads could overwrite a newer release or clear its loading state. Delayed policy saves, manual edition selections, and reconciliation retries could apply feedback or reload a different artist after navigation. Checking only an artist ID is insufficient: A to B to A creates a new A session.

## Decision

Give asynchronous presentation work explicit generation ownership. Album reads also receive AbortSignal cancellation, but every success, error, and finally path checks generation. Closing, unmounting, changing the album/preferred edition, or loading an invalid identity clears stale state and invalidates old work. Canonical-edition mutations may reload only their initiating generation; they do not resurrect an old album after a new load.

A small ESM useArtistMutationTask composable owns pending/error state and lifecycle checks for artist mutation callbacks. It observes the actor, route MBID, and local artist identity synchronously. Each task captures its scope before submission and compares scope plus generation before success, error, cleanup, and follow-up work. Scope disposal also invalidates callbacks. Manual edition selection adds dialog identity/open state, so closing its dialog invalidates presentation ownership.

ArtistDetailView retains domain-specific submit and success behavior, but delegates lifecycle state to task instances for policy save, manual edition selection, and reconciliation retry. Route/account transitions close stale dialogs and discard pending bulk-confirmation UI. Server operations keep their original captured targets; no mutation AbortSignal, automatic retry, or rollback claim is introduced.

The existing manual-edition command's unscoped toast is disabled on this view. Success feedback is emitted only after the current task accepts the result. A new artist's pending state cannot be cleared by an older artist's finally callback. Existing server authorization, CSRF, revision handling, and transactions remain authoritative.

## Alternatives and recommended stack

| Approach | Benefit | Limitation | Decision |
| --- | --- | --- | --- |
| Abort obsolete reads only | Reduces unnecessary work | Cancellation-insensitive adapters and promise cleanup can still alter state | Insufficient |
| Generation ownership plus read cancellation | Handles late success/error/finally and A-B-A | All state-changing async branches must follow ownership | Adopt |
| Force router/component remounts | Resets local component state | Discards drafts and does not cancel already submitted server work | Avoid as the primary fix |
| Global async task singleton | Centralizes bookkeeping | Couples unrelated users, dialogs, and views | Reject |

Retain Node 24 native ESM, Vue Composition API, native dialogs, per-instance generation state, a narrow mutation task composable, injectable API boundaries, and the current PostgreSQL-backed services. No dependency, endpoint, permission, or schema change is needed.

## Official research and W3C model

URLs were discovered and opened through research tools on September 12, 2026:

- [Vue watcher cleanup](https://vuejs.org/guide/essentials/watchers.html): register cleanup synchronously and prevent obsolete asynchronous effects from changing current state.
- [Vue lifecycle hooks](https://vuejs.org/api/composition-api-lifecycle): clean up manually created side effects during component disposal.
- [W3C native dialogs H102](https://www.w3.org/WAI/WCAG22/Techniques/html/H102): preserve native modal semantics and keyboard interaction.
- [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): preserve focus containment, Escape, and appropriate focus restoration. Late network responses must not reopen an obsolete dialog.

Generation checks are an application design inferred from these principles and the reproduced code paths, not a framework-mandated algorithm. Browser checks are scoped interaction evidence, not full W3C/WCAG conformance.

## Acceptance and limits

Defer old reads and mutations, then navigate, close/reopen, change actors, or return to the same artist. Verify stale success/error/finally cannot modify the current data, pending flags, errors, toasts, or follow-up reads. Keep ordinary current-session success and failure/retry behavior intact.

Submitted writes may still complete after navigation. Revisiting the artist obtains server state; this change does not undo those writes. This slice does not introduce server version-conflict policy, global request caching, catalog pagination, or the separate contextual Retry UI recommendation.
