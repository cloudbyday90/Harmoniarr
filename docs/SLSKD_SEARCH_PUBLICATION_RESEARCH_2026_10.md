# Search publication research and recommendations

Consulted October 20, 2026 through GitHub MCP metadata/source fetch and MCP web
search/navigation. URLs below were discovered through those services. The
current Node documentation web fetch failed; version-pinned official source was
retrieved through GitHub MCP instead. No future guidance is inferred.

| Official source and status | Relevant evidence | Application decision |
| --- | --- | --- |
| [slskd 0.26.1 SearchService](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Search/SearchService.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), released implementation | Completed/count updates precede the final write of endedAt and response bodies; failures can also be Completed | Bounded publication allowance; distinguish unavailable, failed and finalized empty results |
| [slskd 0.26.1 Extensions](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Search/Extensions.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396) and [Search model](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Search/Types/Search.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), released implementation | State transitions preserve previous endedAt; IsComplete tests only the Completed flag | Require finalization and zero counters for empty bodies; refuse Cancelled/Errored observations |
| [Node 24.22.0 timers source](https://api.github.com/repos/nodejs/node/contents/doc/api/timers.md?ref=f14cd3aa7bf9ca8df2cc5b8bb14beb0f335b1d93), versioned runtime documentation | Promise timers are supported; callback timing is approximate | ESM node:timers/promises; count admitted polls separately from wall-clock claims |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), W3C Recommendation | Provenance and intended outcomes support understanding and evaluating data | Retain source/version; separate status observations from published data; this mapping is an application inference |
| [OWASP Error Handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet), security guidance | Error handling should avoid disclosing implementation details | Stable code and bounded message without peer filenames, credentials, URLs or raw state |
| [IETF RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), Standards Track | Error details describe the HTTP interface; existing domain formats can be appropriate | Reuse the existing API error envelope; no unrelated migration or problem+json conformance claim |

The slskd finalization marker is a reviewed implementation dependency, not a W3C
or IETF guarantee. Revisit it when qualifying another provider version. A
positive body remains usable under the preexisting partial-results policy; this
change does not wait for every peer or authenticate their claims.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Increase total polling | Small patch | Still trusts first completion; can publish false empty results; slower failures | Reject |
| Bounded observation plus one publication allowance and explicit unavailability | Fixes demonstrated gap; bounded work; fast available/final empty paths; no schema change | Delayed searches can still fail; empty acceptance depends on reviewed provider semantics | Implement |
| Durable continuation of the same search across worker retries | Handles long queues/restarts without another POST | Needs persisted search binding, expiry and cancellation/replay design | Next slice |
| SignalR or a new queue subsystem | Could reduce reads | Completion broadcasts omit bodies; more connection/lifetime complexity | Defer |

Final recommendation stack: existing slskd client and per-request timeout; small
ESM polling service; current-target and transaction guards; verified bodies or
finalized zero results; existing failure recording for unavailable/failed results.
Use fast ordering/cancellation controls and one native search-to-publication
case, final fast gate and no-cache preserved-state Docker walkthrough. Keep the
supported TypeScript/language-server stack while
[PR 48](OPEN_PR_48_SEARCH_PUBLICATION_EVALUATION.md) remains incompatible.

W3C accessibility practices remain relevant to future rendered status changes.
This backend slice adds no control, focus or live-region behavior and makes no
general accessibility/security conformance claim. See the separate
[design](SLSKD_SEARCH_PUBLICATION_DESIGN.md) and executed outcome.
