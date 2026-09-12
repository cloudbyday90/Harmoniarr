# Recipient-aware release request identity

Date: September 12, 2026. Baseline: `195b38d`.

## Problem and platform boundary

Harmoniarr's artist, search, Home, and release surfaces allow administrators to request a release for a selected user. The frontend previously cached completed and pending requests by release alone. Requesting for A could therefore suppress B's request while returning successful/skipped. Local duplicate suppression must describe the actual intended recipient; the server continues to authorize requests and manage durable request state.

## Decision

Use a small native ESM identity module and the existing per-instance composable. Encode actor ID, effective recipient ID, and release key as an unambiguous JSON tuple. An omitted recipient resolves to the current actor; explicitly selecting that actor uses the same identity. Capture identity before submission, so later selector or account changes cannot move completion state to another person.

Keep pending and successful identities separate. Success affects only that identity; failure removes its pending state and permits retry. Different recipients can proceed independently. Reject invalid non-null recipient inputs instead of silently turning them into self requests. IDs remain untrusted inputs: this client helper grants no permission and does not replace server validation.

The existing exposed requestedIds/requestingIds become read-only computed self projections. Initial release IDs seed self state only. All lookup helpers accept the same requestedForUserId option as submission. Production callers do not mutate these sets; tests now create actual pending requests rather than injecting implementation state.

## Dialog integration

Bind the confirmation recipient to its parent so eligibility, pending state, completion state, and the submitted payload use one selection. Disable recipient changes while that dialog is submitting, retain retry on failure, and clear old recipient errors when selection changes. Release-detail lookups use its selected recipient as well.

The tracklist requestState query combines requested-by and requested-for records and does not identify the selected recipient. It must not disable the selected recipient's action. Use locally confirmed scoped state for immediate feedback; the server handles existing durable requests. Existing card indicators remain self indicators. A self-requested card may still require opening release detail to request for someone else; redesigning card actions is outside this slice.

No global cache, browser persistence, backend schema, endpoint, permission, or durable idempotency contract changes are introduced. Cross-instance and cross-tab suppression remain the server's responsibility. Other delayed artist-save and tracklist-load races remain a separate follow-up.

## Alternatives and tradeoffs

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Scoped local identities | Correct recipient attribution; retains same-request double-click protection | Every state lookup must use the same scope | Adopt |
| Clear state on recipient change | Small patch | Loses prior protection and mishandles late responses | Reject |
| Shared persistent cache | Could synchronize screens | Requires account isolation, expiry, and durable-state reconciliation | Defer |
| Remove duplicate suppression | Never masks another recipient locally | Permits redundant clicks and poor progress feedback | Reject |

Recommended stack: existing Node 24 native ESM and Vue Composition API, pure identity helper, per-instance reactive maps, computed self projections, controlled recipient selection, server-authoritative authorization, and behavioral unit/browser tests. No new dependency is required.

## Official research and W3C model

The following URLs were discovered and opened through research tools on September 12, 2026:

- [Vue composables](https://vuejs.org/guide/reusability/composables): reactive inputs and reusable stateful logic. Current selection is read inside computed lookup state; mutation scope is captured before awaiting.
- [Vue watchers](https://vuejs.org/guide/essentials/watchers.html): stale asynchronous effects require explicit lifecycle handling. A submitted mutation is not undone merely by abandoning a UI view.
- [W3C native dialog technique H102](https://www.w3.org/WAI/WCAG22/Techniques/html/H102): retain native modal semantics, keyboard behavior, and focus restoration.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) and [ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22): progress/success should be perceivable without unnecessarily moving focus.
- [W3C ARIA19](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19): announce dynamic errors using appropriate live-region semantics.

The identity tuple is an application design derived from these principles, not a framework-prescribed algorithm. Existing dialog semantics are retained. Browser interaction tests provide scoped evidence, not full accessibility conformance.

## Validation plan

Exercise sequential and concurrent A/B requests, same-scope duplicates, failures/retries, implicit/explicit self equivalence, seeded self state, invalid recipients, and account changes during pending work. Browser checks exercise recipient selection and resulting button states across confirmation and release-detail flows. Run repository tests, lint, and production builds before committing.
