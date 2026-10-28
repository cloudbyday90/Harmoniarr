# Saved authorization status research

Consulted October 28, 2026 through Search/GitHub MCP. Source URLs below were
discovered and opened. Initial GitHub search found no open PRs.

| Official source | Applicable practice | Project decision |
| --- | --- | --- |
| [W3C ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22), informative technique, updated January 12, 2026 | Mount the status container before updating its text; use explicit atomic feedback without moving focus. | Persistent polite status for the read; focusable guarded retry button. Manual spoken/device acceptance remains separate. |
| [Vue watchers](https://vuejs.org/guide/essentials/watchers.html), official documentation | Own cleanup when reactive inputs invalidate asynchronous work. | Abort obsolete GETs and independently fence publication by request/session identity; scope disposal removes the watcher and timer. |
| [web.dev BFCache](https://web.dev/articles/bfcache?authuser=1), primary browser guidance | Restored documents can contain stale user state; pageshow.persisted identifies restoration. | Refresh only after the existing command owner accepts a persisted handoff return. Ordinary pageshow and unsettled POSTs do not trigger the read. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), Internet Standard | GET is safe; uncertain non-idempotent requests need replay safety before automatic retry. | Read current session, then saved status once. Never replay start/clear to infer its outcome; explicit retry repeats only the reads. |
| [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Deny by default and validate permissions on every request. | Retain server authorization/CSRF/state ownership. A client session/status observation is not command authority or an atomic cross-request guarantee. |
| [W3C focus-not-obscured explanation](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum), informative explanation of WCAG 2.2 SC 2.4.11 | Sticky content can hide focused controls; author-created content must not entirely obscure the focused component. | Check retry visibility here; separately audit the earlier Connections mobile field-sizing/sticky-bar finding. This is not complete layout or conformance acceptance. |

## Alternatives and final stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Reload the whole settings form | Reuses existing load | Discards unsaved settings and secrets | Reject |
| Replay the authorization command | Simple apparent recovery | May repeat an already-applied mutation | Reject |
| Poll status or create a second service | Continuous updates | Extra traffic, lifetime/state complexity | Reject for this slice |
| Scoped read owner using existing endpoints | Preserves drafts, bounded work, explicit recovery, stale-response fencing | Two sequential reads and explicit unknown/session-failure states | Implement |

Recommended stack: existing authenticated session/status GETs, a scoped ESM read
owner, bounded saved-link projection, existing Connections cards, persistent
status and explicit retry. Invalidate reads before newer commands or settings
operations; retain each server-side command's independent authorization. This is
an application design derived from the sources, not a W3C conformance claim.

See the separate [design](PROVIDER_AUTHORIZATION_STATUS_DESIGN.md) and
[outcome](PROVIDER_AUTHORIZATION_STATUS_OUTCOME.md).
