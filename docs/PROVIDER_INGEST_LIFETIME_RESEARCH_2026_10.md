# Provider ingest lifetime: official research

Reviewed October 11, 2026 through search-service MCP and GitHub MCP. Repository
discovery supplies GitHub URLs and metadata supplies the PR collection template.
Search discovered current official provider, node-postgres, OWASP and IETF pages;
previously verified W3C/TC39/Node URLs were reopened. Saved links are starting
points, not proof of current guidance.

## Applicable sources and decisions

| Primary source | Guidance / status | Project application |
| --- | --- | --- |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html) | Promise capability and rejection reason semantics | Reuse completion ownership; retain original Error/null after cleanup fallout |
| [Node 24.18.1 timers](https://nodejs.org/download/release/v24.18.1/docs/api/timers.html) | Callback time/order is not guaranteed | Await actual executor completion; status/release observation or sleep is earlier evidence |
| [node-postgres pooling](https://node-postgres.com/features/pooling) | End waits for checked-out clients and refuses later checkout | Drain admitted provider/persistence work before database disposal; pool drain alone does not own future queries |
| [Spotify Get Album](https://developer.spotify.com/documentation/web-api/reference/get-an-album) | Official OAuth catalog endpoint, GET /albums/{id} | Trace wired client and ID-based endpoint; controlled transport evidence must remain separate from live provider behavior |
| [YouTube API reference](https://developers.google.com/youtube/v3/docs) | Official playlistItems list is a GET | Retain existing identifier/cursor client contract and bounded collection preparation |
| [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) | Destination allowlist, redirect and connection-time policy | Preserve actual client origin/redirect/bounded-response controls; do not equate worker drainage with complete SSRF protection |
| [IETF RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | Non-idempotent automatic retry requires safe semantics or evidence of non-application | No provider replay or new transport retry introduced by close |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/) | September 1, 2026 Working Draft; monotonic elapsed time | Keep elapsed observations separate from operational timestamps and matched speedup claims |

These are project inferences from applicable sources, not standards mandating a
worker architecture. W3C timing is a draft, provider pages are vendor contracts,
OWASP is defensive guidance, and TC39/IETF define their respective language/HTTP
semantics. No UI changes or WCAG conformance claim apply to this slice.

## Source-traced security boundary

Provider JSON request service accepts explicit official origins, rejects URL
credentials/fragments, refuses redirects, bounds timeout/response bytes and owns
returned request/body promises. Its cancellation adapter can stop waiting before
an injected request settles; hidden post-abort work requires separate proof.
Spotify/YouTube clients build fixed-base catalog URLs;
the executor service calls them with stored identifiers. Collection intake
rechecks active request, target eligibility, maintenance and cancellation before
requests and transactional publication, with request locking and cursor/snapshot/
budget checks. Preserve these owners; connection-address policy and externally
injected clients require separate assessment before a broader SSRF claim.

## Final recommendation

Select shared ESM execution completion, renewal/release cleanup and ordered
application owners. Benefits are deterministic teardown and observable failures;
cost is cooperative waiting on admitted dependencies. Preserve required evidence/
audit, handled row failures and bounded collection status. Defer forced abort,
provider retry, protocol rewrites and global scheduling changes. Maintain the
existing practical standards skill with concrete owners/adverse evidence instead
of adding an overlapping checklist. The [design](PROVIDER_INGEST_LIFETIME_DESIGN.md)
owns alternatives; a separate outcome records executed versions, counts and limits.
