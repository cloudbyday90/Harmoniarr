# Provider route error research

Consulted October 28, 2026 through Search/GitHub MCP. Source URLs were discovered
and opened. Current runtime is Node 24.22.1, npm 12.0.2 and Express 5.3.0. Initial
GitHub search found no open repository PRs.

| Official source/status | Applicable guidance | Decision |
| --- | --- | --- |
| [OWASP Error Handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet), informative security guidance | Avoid exposing technical details through failure responses. | Map recognized provider codes to fixed public messages; never forward incoming message, cause, response, path or credentials. |
| [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), Standards Track, July 2023 | Error details describe the HTTP interface, with attention to implementation disclosure. Existing domain formats can remain appropriate. | Retain current JSON/status/code contracts. Do not migrate to application/problem+json for this fix. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement, May 15, 2025 | Minimize unnecessary disclosure of sensitive information. | Select fixed public text at the route boundary; explicit local validation uses the existing immutable application-error descriptor. This is an application of guidance, not privacy/accessibility certification. |
| [W3C APG keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) and [button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/), informative guidance | Preserve predictable focus for an action in the current context; aria-disabled does not implement activation behavior. | An observed Downloader Refresh focus loss justifies a small UI correction: keep the pending button focusable, guard loading/revalidation/disabled activation, and retain native disabled when downloads are off. Test held requests and both keyboard keys. |

## Alternatives and recommended stack

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Match a provider code and forward its message | Detailed diagnostics | A code does not establish safe text or provenance | Replace |
| Make all provider failures generic 500 | Small disclosure surface | Loses useful not-found, configuration, authentication and temporary-failure classification | Reject |
| Duplicate static maps in each route file | Simple local review | The same failure can drift across metadata, download and candidate routes | Consolidate |
| Shared fixed catalogs plus explicit local validation ownership | Stable status/code and useful safe guidance | Configuration explanations become less specific; public factory callers still own wording outside this scope | Implement |

Recommended stack: a small pure ESM provider-route error policy, fixed catalogs
for MusicBrainz and Soulseek, the existing public API-error factory and terminal
HTTP projector. Use captured application codes before mutable fields. Known
provider failures always receive catalog text, including already-public provider
errors. Unknown failures retain identity for existing global handling. Preserve
explicit local validation/conflict/auth errors rather than recreating them from
arbitrary code/message fields. No retries, commands, provider transport, SQL,
cache or diagnostic persistence change.

For the observed Refresh issue, prefer a guarded pending button over restoring
focus after each request. The benefit is retained focus without stealing a user's
later focus move; the cost is explicit activation guards and browser coverage.

See the separate [design](PROVIDER_ROUTE_ERRORS_DESIGN.md) and
[outcome](PROVIDER_ROUTE_ERRORS_OUTCOME.md).
