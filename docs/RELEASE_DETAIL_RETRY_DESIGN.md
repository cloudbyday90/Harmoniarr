# Release detail error recovery design

Date: September 12, 2026. Baseline: `caaa31e`.

## Problem and decision

A failed album read left the release dialog showing raw backend/provider text with no recovery action. This is a service failure, not necessarily an input mistake by the operator. Preserve the existing album hero and show an understandable loading failure with an explicit Retry action.

The existing ESM useReleaseDetail composable captures only the current failed read descriptor: release-group MBID and both preferred edition identifiers. retry() uses that exact descriptor through the existing load-generation guard. New loads, successful loads, and cancellation clear the descriptor. Pending or cancelled work cannot be retried; obsolete failures cannot replace the current target. Empty or whitespace error messages become a nonblank fallback, so failure cannot masquerade as success.

Retry never replays canonical-edition writes, manual selections, or acquisition requests. A successful canonical write followed by a failed refresh retries only the read. No automatic retries, new permissions, or server endpoint changes are introduced.

## Modular UI and error handling

A dedicated ReleaseDetailLoadState Vue component owns the recovery presentation and keyboard-focus lifecycle. The large dialog supplies loading/error/retry state and a guarded focus callback. The component displays a fixed safe message rather than arbitrary error text; raw read diagnostics are not inserted into visible text or hidden DOM attributes. Structured provider-specific guidance can be added later if stable error contracts justify it. No unsupported inference about network, credentials, or provider configuration is made.

The existing hero retains release identity. Dependent acquisition, edition, and track controls remain unavailable while a read is loading or failed. The component is unmounted on dialog close or identity changes, invalidating delayed focus callbacks.

## W3C interaction model

Keep a native button mounted during retry. aria-disabled plus an activation guard prevents duplicate submissions while retaining keyboard focus; aria-busy and a loading label communicate progress. A persistent polite status region announces loading and completion. A separate persistent alert container announces the failure explanation, without putting the Retry button inside the alert or duplicating the raw diagnostic.

When success removes Retry, move focus to Close only if Retry still held focus. If the user moved focus during the read, preserve that choice. The parent callback also checks that the current dialog is open. Closing and reopening cannot let an old response move focus or overwrite the new content.

## Official research

URLs were discovered and opened through research tools on September 12, 2026:

- [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/): an action that keeps the current context normally retains focus.
- [W3C keyboard-interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/): removal of a focused element needs logical focus handling.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages), [ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22), and [ARIA19](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19): establish announcement regions and announce waiting, completion, and errors without unnecessary focus changes.
- [Vue watcher cleanup](https://vuejs.org/guide/essentials/watchers.html): invalidate obsolete asynchronous effects and register cleanup before asynchronous boundaries.
- [W3C error suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html): input-error guidance is distinct from an unavailable metadata service; this design does not portray service failure as invalid operator input.

These inform the implementation; browser interaction tests are scoped evidence, not full WCAG conformance or a substitute for assistive-technology evaluation.

## Alternatives and recommendation

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Explicit Retry in place | Preserves album/edition context and user control | Requires loading and focus ownership handling | Adopt |
| Automatic retries | Can conceal a transient failure | Extra traffic and timing complexity; persistent errors still need recovery | Defer |
| Close and reopen | Minimal code | Forces navigation and can lose edition context | Retain as optional navigation, not sole recovery |
| Display raw provider text | Detailed diagnostics | Can expose internals and confuse users | Replace in this read-error surface |

Recommended stack: Node 24 native ESM, existing Vue composable and generation guards, a small recovery component, native dialog/button semantics, safe contextual text, and deferred-response unit/browser tests. No dependency, schema, or backend authorization change is required.
