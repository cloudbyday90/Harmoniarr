# Durable search continuation: research and tradeoffs

Consulted October 20, 2026 through GitHub MCP metadata/source fetch and MCP web
search/navigation. URLs were returned by those services. Version-specific claims
refer to released slskd 0.26.1, not an assumed newer branch.

| Official source/status | Applicable practice | Implementation decision |
| --- | --- | --- |
| [slskd SearchRequest](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Search/API/DTO/SearchRequest.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396) and [SearchesController](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Search/API/Controllers/SearchesController.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), released implementation | POST accepts an optional UUID; state and responses can be read by UUID; absent records return 404 | Reserve UUID locally first, supply it once, then use reads after uncertain acceptance or restart |
| [IETF RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), Standards Track | Non-idempotent request retry needs evidence about its semantics or original application | Do not infer another POST is safe from a lost response, absent record or expired local continuation |
| [PostgreSQL 18 Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html?trk=article-ssr-frontend-pulse_little-text-block), database documentation | Conflicting row operations wait for transaction completion; lock order matters | Use a short owner-guarded reservation transaction and unique indexes; keep HTTP outside it |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), Recommendation | Provenance/version information supports evaluating data | Preserve provider/search/intent attribution; distinguish reservation, acceptance observation, candidate persistence and library publication; this mapping is an application inference |
| [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html?trk=article-ssr-frontend-pulse_little-text-block), security guidance | Recheck authorization at execution and protect transaction data from substitution | Retain current target/cancellation/maintenance guards, check replaced claims and provider configuration, and recheck before candidate persistence |

The UUID feature enables correlation and reconciliation. It does not make POST
generally idempotent or guarantee exactly-once distributed execution. The local
database owns the right to submit once. Provider observations own whether a
record exists and matches. Required candidate/current-target checks remain
separate from both. Keyed configuration fingerprints contain no raw credential;
they are private binding data, not authentication tokens or general proof that
remote peers are trustworthy.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Repeat POST after timeout or worker retry | Simple; may restore progress | Can create duplicate searches after uncertain acceptance | Reject |
| Store only the returned provider ID | Fewer changes | Crash/lost response before local save leaves no safe identity | Reject |
| Reserve UUID before POST, persist owner/context/configuration, continue by GET | Survives restart/uncertainty; concurrent callers share one admitted POST; bounded expiry; existing queue | Additional table/guards; a crash before sending can leave an absent record requiring explicit new intent | Implement |
| Hold a database transaction around the provider call | Appears to serialize local callers | Network failure cannot roll back provider acceptance; long locks and pool pressure | Reject |
| Add a separate event/queue subsystem | Could model longer workflows | Duplicates existing operation infrastructure; does not remove uncertain acceptance | Defer |

Final recommendation stack: existing operation queues/workers; small ESM
continuation service/store/binding policy; PostgreSQL owner/unique/FK constraints;
bound client reads; current-authority and locked persistence guards; the existing
bounded response poller; a guarded short continuation cooldown committed before
POST. Durable success clears that pending marker and identifies a subsequent
scheduled cycle. Expiry alone never grants another submission.

Keep cheap ordering/configuration/expiry controls in the fast gate. Use one native
PostgreSQL/HTTP cohort for concurrent reservation, rollback, target ownership and
worker completion, plus one released-provider UUID/continuation-to-audio case.
No new UI is introduced; W3C focus/live-region checks remain applicable to a
future rendered recovery action. This slice does not claim WCAG conformance or
a complete security certification. See the separate
[design](SLSKD_SEARCH_CONTINUATION_DESIGN.md) and outcome.
