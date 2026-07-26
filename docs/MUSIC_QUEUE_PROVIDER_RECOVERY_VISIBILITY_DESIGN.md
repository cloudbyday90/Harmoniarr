# Music Queue Provider Recovery Visibility Design

Status: **Implemented.**

## Objective

When an operator repairs Soulseek from a Music Queue handoff and returns to
Music Queue, refresh the queue once and state what can happen next. The
confirmation identifies the first release already waiting for the normal search
cycle, if one exists. It does not dispatch a search, download, or add action.

## Research

W3C's ARIA22 technique recommends a persistent `role="status"` container with
explicit atomic behavior for status changes added after an action. The recovery
result uses that pattern so assistive technology receives the full queue result
without moving focus. [W3C ARIA22 status-message
technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22).

Vue Router supports named route location objects with fixed query data and
`router.replace()` can consume a one-time route state without creating another
history entry. The handoff uses a named route and removes the consumed token
after the queue read completes. [Vue Router programmatic
navigation](https://router.vuejs.org/guide/essentials/navigation.html).

OWASP documents that redirects based on untrusted URL input can enable phishing
and access-control bypasses. The handoff therefore accepts only the literal
`provider_ready` token and always returns to the fixed internal Music Queue
route. [OWASP unvalidated redirects and
forwards](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html).

## Options Considered

| Option | Advantages | Drawbacks | Decision |
| --- | --- | --- | --- |
| Return to Music Queue without feedback | Minimal implementation. | Leaves the repair outcome unclear and encourages manual refreshes. | Rejected. |
| Start a search or download when Connections saves | Appears immediate. | Bypasses server retry policy and can make a misleading promise about external work. | Rejected. |
| Persist a global provider-recovery banner | Survives unrelated navigation. | Becomes stale and noisy outside of the repaired workflow. | Rejected. |
| Bounded return token, one queue read, and contextual status | Explains the result while preserving server-owned scheduling. | Adds a small route-state contract and one read. | Adopted. |

## Final Recommendation Stack

1. Connections verifies provider health before offering the return action.
2. The return action uses the named `music-queue` route with the fixed
   `recovery=provider_ready` token; no destination or URL is user-controlled.
3. Music Queue disables its normal initial read for that arrival and performs
   exactly one recovery refresh instead.
4. The first API-ordered release with `queued_for_search` is presented as
   waiting for its next normal search check. Other states retain their existing
   meanings: searching is active, downloading is active, and quality/setup
   stops remain stops.
5. After the result is rendered, Music Queue removes the recovery token with
   `router.replace()`. Reloading the cleaned URL cannot repeat the handoff.
6. The client reports only the queue read. Server workers remain authoritative
   for cadence, matching, transfer dispatch, and library adds.

## Security And Product Rules

- Only the fixed `provider_ready` token is recognized. Unknown values do not
  alter Music Queue behavior.
- The queue location is a static named route, not a caller-supplied URL,
  pathname, route name, or redirect target.
- The status copy contains no provider endpoint, secret, file path, or raw
  connection error.
- The UI never labels searching, downloading, adding, or a quality block as
  waiting for a normal search check.
- No recovery button performs a manual dispatch. The wording explicitly states
  that Harmoniarr has not started a download.

## Validation

Pure tests cover the fixed token, query cleanup, deterministic first waiting
release, no-waiting outcome, and generic failed-refresh outcome. Browser
verification follows Settings repair through the return link, proves one queue
read on return, confirms the waiting release message, verifies the token is
removed, and checks for browser errors.

## Next Item

The next high-value item is **Music Queue normal-cycle activity visibility**:
emit and surface a concise timeline event when a repaired waiting release
actually re-enters search, so operators can verify progress without returning
to advanced diagnostics.
