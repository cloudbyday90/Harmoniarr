# Provider authorization action research

Consulted October 28, 2026 through Search/GitHub MCP. URLs were discovered and
opened. Initial GitHub search found no open PRs. The current application uses
Vue 3.5.44, Vue Router 5.4.0, Playwright 1.64.1 and ESM on Node 24.22.1.

| Official source/status | Applicable practice | Decision |
| --- | --- | --- |
| [W3C APG button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) and [keyboard guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), informative | A same-context action normally retains focus; important unavailable controls can remain discoverable with aria-disabled. | Keep authorization controls focusable while pending and after clear; implement handler admission because ARIA does not prevent activation. |
| [W3C ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22), informative technique | Status containers should exist before updates; polite atomic feedback can communicate progress without taking focus. | Keep one persistent status paragraph outside busy ancestors. Pending, failure and completion use fixed copy; controls remain separate. This does not certify spoken output or WCAG conformance. |
| [RFC 9110 section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html), Internet Standard, June 2022 | Non-idempotent requests should not be retried automatically without evidence that replay is safe. | One admitted POST, no automatic retry or timeout-based release/replay. Ambiguous failure does not assert that the server never applied the command. |
| [Vue scope disposal](https://vuejs.org/api/reactivity-advanced.html), official framework documentation | Scoped cleanup belongs with reusable composition functions. | Dispose admission and publication when the view leaves. Do not abort/replay a POST and claim server rollback. |
| [web.dev back/forward cache](https://web.dev/articles/bfcache?authuser=1), primary browser guidance, updated July 2, 2026 | A restored document can resume its JavaScript state; pageshow.persisted distinguishes that restoration. | Retire only an acknowledged start handoff on persisted return. Never retire an unsettled request or automatically send another POST. Controlled event proof and actual navigation are distinct from native cache restoration acceptance. |

## Alternatives and recommendation

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Native disabled flags only | Small UI change | Direct handlers can re-enter; independent flags allow competing commands and can blur focus | Replace as the sole guard |
| Per-provider pending flags | Allows unrelated commands concurrently | Shared feedback/navigation still competes across providers | Reject for this workspace |
| Global singleton lock | Broad exclusion | Couples unrelated views and survives their lifetimes | Reject |
| Scoped command owner shared by four actions | One command/result/navigation owner, explicit lifetime, small integration | Commands serialize; acknowledged handoff remains occupied until leave/return | Implement |

Recommended stack: existing settings API/session/CSRF contract, a scoped pending
command owner, bounded result projection, then existing connection cards and
persistent feedback. Coordinate settings load/save admission so they cannot
overwrite the same saved-status observation during a command. Keep saved absence
and clear refusal meaningful; no browser state is server authorization.

See [design](PROVIDER_AUTHORIZATION_ACTIONS_DESIGN.md) and
[outcome](PROVIDER_AUTHORIZATION_ACTIONS_OUTCOME.md).
