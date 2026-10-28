# Provider status availability research

Consulted October 28, 2026 through Search/GitHub MCP; official URLs were discovered
through search and opened directly. Existing runtime is Node 24.22.1. No open PR
was found initially.

| Primary source/status | Applicable guidance | Decision |
| --- | --- | --- |
| [OWASP Error Handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet), informative security guidance | Return useful generic failures without exposing technical or sensitive details. | Replace failed provider observations with a fixed unavailable object, never raw error/code/cause, false linked state or cached success. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), Internet Standard, June 2022 | HTTP status describes fulfillment of the request; 503 can represent temporary service inability. | A successfully collected status representation can explicitly contain unavailable observations. Recognized shared database/lookup failures remain a bounded 503 request failure, not partial success. The representation policy is a project choice, not a mandated wire format. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement, May 15, 2025 | Minimize unnecessary sensitive-data disclosure. | Expose only fixed provider identifiers and availability codes on failure; preserve existing authorized successful payloads. Do not return credentials or native diagnostics. This is informative guidance, not WCAG certification. |
| [ECMA-262](https://ecma-international.org/publications-and-standards/standards/ecma-262/), 17th edition, June 2026; [TC39 2026 Promise section](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html) | allSettled observes each input's completion, unlike early aggregate rejection. | Await every started route reader before publishing or rejecting. This observes returned promises, not independent native work or drainage. The catalogue verifies the released edition; the section was read in TC39's dated snapshot, whose header says draft. The catalogue's normative single-page HTML exceeded the MCP fetch size limit. PR-preview editions are not treated as adopted replacements. |
| [PostgreSQL 18 administration functions](https://www.postgresql.org/docs/18/functions-admin.html), versioned vendor documentation | pg_terminate_backend targets an individual backend; signal delivery and verified termination differ. | A disposable native fixture terminates only its owned reader connection and observes driver/end/backend absence to qualify genuine database-unavailable handling. It does not stop the server or unrelated sessions. |

## Alternatives and recommended stack

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep fail-fast Promise.all | Simple and fast failure | One local reader failure hides successful siblings | Replace at the provider projection boundary |
| Return linked/configured false on error | Fits older booleans | Falsely reports unlink/unconfigured state | Reject |
| Convert every failure into unavailable | Preserves some output | Can conceal shared database inability | Preserve classified shared failure as 503 |
| Retry/cache last success | Sometimes appears available | More work and stale credential claims | No retries or persistent cache |
| Explicit per-provider unavailable plus summary | Honest partial data and bounded errors | Consumers must distinguish availability from validity/link state; response waits for started readers | Implement |

Use one small ESM aggregation factory over existing read owners, with fixed provider
keys and a bounded summary. Default independently owned readers run concurrently;
an explicitly supplied queryable is read serially, without assuming it is a pool.
Keep commands, authorization, encryption, settings payloads and core readiness
ownership unchanged. Required overview/settings reads outside the provider projection
can still fail the request. See [design](PROVIDER_STATUS_DESIGN.md) and
[outcome](PROVIDER_STATUS_OUTCOME.md).
