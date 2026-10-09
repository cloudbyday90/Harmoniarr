# Guarded download origin resolution outcome

Implemented on main, October 9, 2026. The separate
[accepted design](DOWNLOAD_ORIGIN_RESOLUTION_DESIGN.md) records alternatives,
pros/cons, final stack and required boundaries. The separate
[official research](ORIGIN_RESOLUTION_RESEARCH_2026_10.md) records fresh MCP
discovery/opening, source authority/date and application inference. No release,
tag, branch, PR merge or provider upgrade is part of this change.

## Result and ownership

An administrator can resolve one newer unused manual allocation that blocks an
older terminal source-owned batch. The server owns both run identities, original
manifest, source and policy. Fresh complete progressed batch evidence must match
the source-verified saved provider binding. Local-only, partial, legacy unknown,
rejected, malformed, active/claimed, reserved/private or multiple-newer cases
remain in review; cancellation or missing history alone never proves non-dispatch.

Small ESM authority, episode policy, origin SQL/store, allocation and resolution
modules reuse the existing service/transaction boundaries. Adoption and resolution
share current administrator/session and recipient/quality authority without
loosening the old contract. Exact source, consent, floors and actor facts are
rechecked after provider reads and under ordered parent/run/item/lease locks.
The pinned local configuration/credential assertion uses the transaction client;
it does not acquire another connection or call the provider while locks are held.

Typed reciprocal records tie the cancelled newer run to the exact older item and
attempt. Effective-origin readers validate both sides; malformed/orphan markers
fail closed. Retirement, records, receipt links, phase, existing confirmation
audits and the operator resolution audit commit together. Required-audit failure
rolls everything back. Durable commands and the saved outcome handle response or
command-completion loss without repeated provider reads, links or audits. No new
provider POST, cancellation, removal or receipt fabrication occurs.

Scoped allocation and item association share the candidate parent fence. Retired
jobs cannot restart, retry, claim or overwrite their checkpoint; a stale original
snapshot must also match the new resolution ID. Both lineage rows survive both
retention paths. Bounded private polling continues older confirmed downloads
through completion even when unrelated newer work exists. Observation merging
keeps distinct pending and restored items from the same run. API projections omit
that worklist and reciprocal actor/hash/attempt metadata. No migration/table or
schema snapshot change was required; see [the database model](DATABASE_MODEL.md).

## Administrator interaction and production wiring

Separate read and mutation routes require current administrator access; writes
also require a fresh session, CSRF and the existing durable intent key. Only a
review digest is accepted. Server-selected jobs and evidence cannot be supplied
by the browser. Both endpoints have rate limits and bounded provider errors.

The existing newer-origin adoption refusal opens a separate sibling native
confirmation after closing the first modal. Counts are bounded and the server's
permission gates confirmation. Cancel/Escape sends no command; an uncertain retry
keeps its digest/key and can reopen its cached choice. Pending feedback stays
exposed outside the closed modal. Competing controls remain excluded until both
execution and selected summaries finish refreshing, including when the reviewed
row disappears. Moved/SPA focus is respected.

The historical original operation can remain failed/completed while its verified
downloads are tracked. Display priority now reflects current pending/adverse or
verified tracking facts before historical failure/count fallbacks. This does not
claim media verification or library completion.

Two assembled-path defects from the prior slice were corrected: adoption handlers
now live in actual module route dependencies, and the top-level provider module
supplies the exact-ID snapshot reader instead of overriding it with the older
history-only adapter. Invoked module exports and a native assembled snapshot test
prove these closures, including a removed successful receipt.

## Executed evidence

Final `npm run validate` passes all 9,126 tests: 3,977 server, 4,375 client,
513 script and 261 integration, zero failures/skips. Copyright, migration/schema,
ESM, image/topology, test-hygiene and lint checks pass, as do both client and
server builds. The executed focused evidence below has zero final failures or
skips. Totals overlap each other and the broader run; browser evidence is separate.

```powershell
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE = 'harmoniarr-quality-fallback:local'
npm.cmd run validate
npm.cmd run validate:security
```

| Evidence | Passing tests | Boundary |
| --- | ---: | --- |
| Owning backend regressions | 97 | Origin, lifecycle, lease, summary, reconciliation, stale writers and retention |
| Provider/configuration plus resolution consumers | 68 | Exact evidence, local pinned closure and transaction-client propagation |
| Assembled snapshot and existing dispatch/snapshot consumers | 23 | Exact ID reads of removed success; no history-only override |
| Real HTTP origin routes | 9 | Real auth/CSRF, forged payloads, durable replay/concurrency and rate limits |
| HTTP plus route inventory | 11 | Same nine route scenarios plus actual registered surface/classifications |
| Client workflow | 34 | Permission/count gating, retry identity, summary exclusion and navigation |
| Chromium browser | 31 | Four origin, four adoption and 23 canonical scenarios |
| Serial real PostgreSQL | 37 | Seven origin, eight adoption, eight confirmation, seven recovery execution, five positive handoff and two retention scenarios |

The seven new PostgreSQL scenarios use native controlled HTTP version/batch
reads, real shared authority, owning transactions, observed lock waits and an
actual retired-worker entry with a zero-POST counter. They cover all three audit
rollback points, changed actor/consent/source after batch reads, one-connection
default-module configuration reads and late credential refusal. This is controlled
provider evidence, not a live Soulseek download or restart rehearsal.

Six browser captures at 390, 800 and 1280 CSS pixels in light/dark were inspected:
clear counts, visible Cancel focus and no clipping. Browser fixtures use controlled
DTOs and production privacy projection; they do not prove provider/SQL ownership.
The separate PostgreSQL evidence owns those claims. Actual assistive-technology
speech was not tested.

Fresh `npm run validate:security` passes image/topology policy and the all-severity
npm audit with zero reported vulnerabilities. Node 24.18.1/npm 12.0.2 were checked.
The local measured-media fixture used by full validation was verified as
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`.

## Original failures and corrections

- The invoked module-export regression initially failed because adoption handlers
  were absent from route dependencies. Moving the handlers corrected production
  wiring; the intermediate exact-map expectation was updated to include the new
  exports. The original and corrected logs are retained.
- The assembled provider snapshot regression initially passed two of three tests;
  it could not observe a removed successful UUID receipt through the supplied
  history adapter. Wiring the exact-ID callback fixes it; the assembled module
  and existing dispatch/snapshot command passes 23 tests afterward.
- Independent review reproduced contradictory pending-item/outcome eligibility:
  the first pure command passed four of six. Restricting the never-started path to
  actual initial planning states/outcomes fixes the original six-case command.
  The explicit typed not_dispatched path remains separate; uncertainty is not cleared.
- Observation merging initially passed one of two cases. A last-wins run map
  dropped a different pending/restored item when both belonged to the same older
  run. A narrow run/item union fixes it; both cases pass with unrelated current work.
- Historical failure display initially passed two of three cases. Verified tracking
  appeared after the old failed-status fallback. Priority now honors current
  pending/adverse facts and explicit tracking before historical failure. All 32
  relevant consumer cases pass without changing historical operation status.
- Source review identified the second-connection configuration read inside the
  transaction. Threading the owning client through the actual default module,
  facade and pinned closure fixes it. No pre-fix pool hang execution is claimed;
  focused propagation/no-provider-IO and real one-connection PostgreSQL controls pass.
- Initial scoped lint found two shadowed names; a later global test lint caught
  a shadowed test binding. Renaming them corrected the checks without behavior
  changes. The route inventory's first run also used an undefined fixture stub;
  the existing correct helper fixes the original two-case command.
- The first wider PostgreSQL command passed 36 of 37. An old fixture created a
  newer allocation while its candidate was downloading, which the new producer
  correctly rejects. Explicit SQL now models that preexisting historical row;
  all original delayed-completion/refusal assertions remain. The isolated case
  and original complete 37-case command pass. The runtime guard was not relaxed.
- Full validation first stopped at copyright compliance for three new client
  files. Correct complete headers fix the original command. Its first log is
  retained; the final original command passes all checks and 9,126 tests above.

Client/browser focused commands had no initial behavior failures: client 32 then
expanded 34 pass, and the first executed browser command passes all 31. Root
service/policy tests passed 19 initially and 21 after current-config regressions.
All failure statements above distinguish actual execution from source inference.
Logs are under ignored `.tmp/origin-resolution-2026-10/` and
`.tmp/download-origin-resolution-2026-10/`, including first/corrected commands,
the historical fixture repro, native PostgreSQL results and inspected captures.

## PR applicability and practical skill

Fresh GitHub MCP repository discovery, explicit collection pages, immutable
heads/bases and complete file scopes found no eligible unreplayed patch. All three
observed open patches retain their earlier locally implemented scope. No random
draw, duplicate local replay or PR merge was applicable. Separate
[PR design](OPEN_PR_APPLICABILITY_ORIGIN_RESOLUTION_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_ORIGIN_RESOLUTION_2026_10_OUTCOME.md) preserve
observed times, discovered URLs, comparisons and hashed evidence.

The [practical web-standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now maps reciprocal ownership, future allocation fences, source/newer stale
snapshots, actual module wiring, retention and private polling to their owners
and adverse tests. It combines applicable W3C/WHATWG, IETF, OWASP and PostgreSQL
practice without a blanket compliance workflow. Its separate
[design](WEB_STANDARDS_SKILL_DESIGN.md) and [outcome](WEB_STANDARDS_SKILL_OUTCOME.md)
distinguish structural/installed checks from actual application evidence. No new
blind behavioral skill trial is claimed. Source and installed structure pass
validation; all four files match by SHA-256 after final reference synchronization.

## Limits and next recommendation

This supports one explicitly scoped unused newer manual allocation and an older
terminal source-owned v2 batch with full current positive evidence. Multiple
newer jobs, reserved/recovery approvals, previously run checkpointless legacy
work, unknown/partial/provider-restarted proof and source/policy drift refuse.
There is no provider POST or destructive resolution in this contract, and no
claim of external exactly-once, uniqueness after provider storage reset, perfect
settings/provider-version serialization after the final check, live media import
or assistive-technology speech. Subsequent exact reads remain provider-bound and
normal current recipient/quality/file gates still apply. Deployment stays at 0.25.1.

Next: persist explicit pre-provider refusal/non-dispatch certificates for future
leased jobs, including blocked preparation/version decisions. The current worker
can refuse before creating a dispatch checkpoint; an older previously attempted
job then has no durable unused proof and correctly remains unresolved. Record
the exact local decision/epoch at its owning gate, preserving any existing unknown
dispatch. Test a paused preparation and late retry against the certificate:
refusal commits without POST, resolution can retire only that known unused intent,
and a later worker cannot overwrite it or send work. Do not retroactively certify
historical missing checkpoints or broaden all cancelled-run eligibility.
