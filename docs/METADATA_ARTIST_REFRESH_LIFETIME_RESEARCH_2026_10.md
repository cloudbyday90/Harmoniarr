# Metadata artist refresh: official research

Reviewed October 12, 2026 through search-service MCP and GitHub MCP. Repository
discovery supplies GitHub URLs; metadata supplies the PR collection template.
MCP searches identified official MusicBrainz, node-postgres and IETF pages.
Previously verified W3C/TC39/Node/OWASP URLs were reopened. The MusicBrainz API
page returned HTTP 429; its separately identified official FAQ was fetched and
its navigation supplied the rate-limiting page, which was also fetched.
Keep that access limit explicit rather than inventing current-source verification.

## Applicable sources and decisions

| Primary source | Guidance / status | Project application |
| --- | --- | --- |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html) | Promise capability and arbitrary rejection reasons | Reuse actual completion and retain Error/null through cleanup |
| [Node 24.18.1 timers](https://nodejs.org/download/release/v24.18.1/docs/api/timers.html) | Callback time/order is not guaranteed | Await worker completion beyond scheduling/status/release observation |
| [node-postgres pooling](https://node-postgres.com/features/pooling) | End waits for checked-out clients and refuses later checkout | Drain returned metadata and schedule work before pool disposal; pool end does not own future queries |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Server-side current object/relationship checks | Keep captured worker context, lease fencing and wanted projection authority at their mutation owner |
| [MusicBrainz API FAQ](https://musicbrainz.org/doc/MusicBrainz_API/FAQ) | Official provider FAQ, marked unreviewed; requires meaningful application identification | Preserve wired client identification; controlled HTTP is not live-provider compatibility proof |
| [MusicBrainz rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) | Published rules reference 2012 and may change; per-IP limit and distributed scheduling guidance | Retain existing request queue/rate/timeout/retry and jitter policy; instance-local ownership does not establish global egress compliance |
| [IETF RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | Retry depends on method semantics and evidence of application | No new provider replay or transport behavior introduced by lifecycle close |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/) | September 1, 2026 Working Draft; monotonic elapsed measurement | Keep elapsed observations separate from operational schedule timestamps and matched speedup claims |

These are project inferences from applicable sources, not standards mandating
Harmoniarr's worker architecture. W3C timing is a draft; OWASP is defensive guidance;
provider/runtime pages document their contracts; TC39/IETF define language/HTTP
semantics. No UI changes or WCAG conformance claim apply to this slice.

## Source-traced boundaries and final recommendation

The refresh worker passes captured expected lease plus a cancellation hook.
Catalog refresh clones context before awaits and forwards it to wanted projection;
existing transaction/current-state checks remain at that owner. Returned provider,
catalog, materialization, wanted, queue and detection work is awaited, followed
by scheduler persistence or unmonitored schedule clearing. Queue intent and
completed reconciliation remain different boundaries. Existing provider request
queue can stop caller waiting after abort; hidden injected work needs separate
proof and is not certified by normal-response lifetime tests.

Select shared ESM completion and captured lease drainage with the metadata owner
explicitly included at startup and in both app fixtures. Benefits are deterministic
cleanup and observable escaped failures; cost is cooperative waiting. Preserve
scheduler/current-authority/cancellation policy and vendor request behavior. Defer
forced abort, retries, partial-write semantics and global scheduling rewrites.
Maintain the practical standards skill with concrete owners/adverse evidence.
The [design](METADATA_ARTIST_REFRESH_LIFETIME_DESIGN.md) owns alternatives; a
separate outcome records executed counts, versions and limits.
