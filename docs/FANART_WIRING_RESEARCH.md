# Fanart.tv composition research and recommendations

Consulted October 22, 2026 through connected MCP search/GitHub services. URLs below
were returned by official-source search. Direct opening the Fanart.tv reference
returned HTTP 403; the indexed official reference supplied the contract excerpts.
No live account, key or public-provider query was used.

| Source and status | Applicable practice | Project decision |
| --- | --- | --- |
| [Fanart.tv API](https://api.fanart.tv/), vendor reference | Header authentication; v3.2 album arrays identify records with `release_group_id`; legacy versions use keyed maps; album endpoint returns the parent artist envelope | Resolve existing secrets into headers and select the requested release group |
| [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), informative security guidance | Central ownership, rotation and restricted exposure | Reuse encrypted storage; resolve on each request; preserve private failure projection |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), Statement, May 15, 2025 | Minimize data and respect its purpose | Architectural inference: keep keys out of URLs, diagnostics and returned artwork data |

These are selected practices, not a claim of W3C or OWASP conformance. The vendor
reference is versioned guidance, not an Internet standard. Synthetic fixtures
qualify the documented shapes, not every live catalogue or account tier.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Existing credential service and per-request callbacks | One storage owner; immediate saved-key changes; no migration | Secret reads on each request; no atomic two-key snapshot | Adopt; retain current precedence and failure behavior |
| Startup key snapshot | Fewer reads | Rotation/clear needs restart; secret lifetime expands | Reject |
| Exact album identity in small pure selector | Prevents cross-album assignment; easy focused tests | Rejects ambiguous provider payloads; schema upkeep | Adopt for both nested versions |
| First-album fallback | Tolerates undocumented envelopes | Can assign another album's art | Reject |
| New secret manager or broad client rewrite | Could centralize more providers | Unneeded infrastructure and regression surface | Defer until supported by a wider requirement |

Recommended stack, in order: existing encrypted provider credentials → application
composition → per-request header resolution → bounded HTTPS JSON service →
target-bound pure selection → existing artwork ingestion/assignment. Next, qualify
the image-download boundary before claiming safe live provider ingestion.

GitHub MCP returned no open repository PRs at selection time. Random selection,
local PR implementation, rebasing and stale-PR cleanup are inapplicable to that
empty set. Recheck before publication. No release is planned.
