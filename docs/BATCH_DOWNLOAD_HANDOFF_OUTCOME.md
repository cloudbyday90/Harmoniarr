# Provider batch handoff and explicit download adoption outcome

Implemented on main, October 9, 2026. The separate
[accepted design](BATCH_DOWNLOAD_HANDOFF_DESIGN.md) records alternatives,
pros/cons, the final recommendation stack and standards applicability. The
[primary-source research](SLSKD_BATCH_HANDOFF_RESEARCH_2026_10.md) records fresh
MCP discovery and immutable provider contracts. Research began October 8 local /
October 9 UTC; final validation occurred October 9 local. No release, tag,
branch, provider upgrade or PR merge is part of this change.

## Result and ownership

New narrow ESM protocol, evidence, batch-envelope, transfer-normalization,
dispatch and adoption policies/services keep provider logic out of route and
worker singletons. Version selection supports only the inspected stable 0.25.1
legacy and 0.26.0 batch contracts. Unknown versions refuse before POST. A pinned
client/config is checked before dispatch; private fingerprints exclude credentials.
The existing local attempt UUID becomes the caller-owned batch UUID.

Direct batch responses validate every immutable file and explicit failure.
Resume never falls back to legacy POST or creates another batch UUID after an
uncertain outcome. A lookup confirms only the complete exact manifest with
positive remote-queued, InProgress or Completed/Succeeded evidence. Local-only,
missing, malformed, failed or conflicting evidence stays in review. Typed body
read/parse uncertainty cannot silently become admission, and a durable definitive
rejection survives resume without an unnecessary batch lookup.

Exact receipt reads validate ID, peer, direction, file/size, optional BatchId
and supported state. They deduplicate equivalent bindings with concurrency eight,
can observe removed successful receipts, and isolate per-receipt unavailability.
A wrong explicit binding has no fallback to another endpoint's observation.
Missing or incomplete evidence is pending review, rather than proof of an orphan.
Source-verified restart markers never authorize replacement-ID correlation or
automatic recovery from the original uncertain dispatch.

The existing owning handoff transaction compares the saved attempt, source,
current origin and lease/maintenance authority before committing links,
checkpoint, candidate phase and required audit. Provider reads are outside
transactions; raw lookup proof is revalidated inside the owning transaction.
All existing quality, source, recipient and library file guards remain applicable.

## Explicit operator adoption

Administrator-only review and command routes live under an exact execution
run/candidate. The read returns bounded meaningful file/state choices and an
opaque review digest. POST accepts that digest and unique selected transfer IDs,
using the existing durable Idempotency-Key contract. The digest proves freshness,
not permission. Current administrator/session/CSRF, source, consent, quality,
maintenance and latest terminal episode ownership are rechecked around provider
reads and under locks. Full saved manifests are capped at 200 files; competing
same-file IDs, absent immutable evidence, foreign links/batch ownership and
newer origins refuse. A partial list cannot become eligible by truncation.

Adoption records a separately attributed operator proof beside the original
attempt and preserves its unknown dispatch. Links, phase, checkpoint and two
required user audits commit together. Saved outcomes cover command replay and
uncertain response/command-record completion without duplicate links/audits.
There is no provider enqueue, cancel or remove in this command. Later missing,
failed or restarted adopted transfers stay review-only; all four automatic
recovery paths and both retention paths preserve that original uncertainty.

A small Vue component/composable presents a native Cancel-first confirmation
from match diagnostics, with bounded references to unresolved items and a safe
canonical Missing Music handoff. Pending feedback is exposed after modal
closure. Cancel/Escape performs no mutation; uncertain retries retain intent.
SPA navigation revokes stale response/focus ownership. Requester projections
omit provider bodies, peers, paths, bindings and adoption proofs. Refreshed facts
reflect the durable outcome without granting administrator diagnostics to others.

No new table, migration or schema snapshot was required. The existing private
JSON checkpoint and durable command/link constraints own persistence; see
[the database model](DATABASE_MODEL.md).

## Executed verification

Final `npm run validate` passes all 9,065 tests: 3,934 server, 4,364 client,
513 script and 254 PostgreSQL integration tests, with zero failures/skips. All
copyright, migration, schema snapshot, ESM, image/topology, test-hygiene and lint
checks pass, as do both client and server builds. The following focused evidence
also passes with zero final failures/skips. Focused totals overlap each other
and the complete run; the 27 browser scenarios are a separate gate.

The full local command used the verified existing media fixture:

```powershell
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE = 'harmoniarr-quality-fallback:local'
npm.cmd run validate
npm.cmd run validate:security
```

| Evidence | Final passing tests | Boundary |
| --- | ---: | --- |
| Provider policies/dispatch and existing consumers | 113 | Exact wire/schema/state, pinned drift, 409/lost response, malformed bodies, removed receipt and bounded concurrency |
| Backend worker/common handoff/summary/recovery | 99 | Lease/current owner, atomic proof, truthful pending and automatic recovery fences |
| Adoption policy/service/HTTP | 18 | Full review, server authority, durable replay and current evidence |
| Client adoption/API/composables | 63 | Selection, stale results, intent preservation and rendering behavior |
| Canonical handoff/public projection | 53 | Administrator visibility, requester privacy and registered route context |
| Controlled HTTP plus real PostgreSQL/retention | 6 | Four batch worker/summary scenarios and two retention scenarios |
| Existing real PostgreSQL confirmation/recovery | 20 | Eight confirmation, seven recovery execution and five positive ingestion/handoff scenarios |
| Real PostgreSQL adoption | 8 | Concurrent/replayed commands, foreign ownership, stale authority/policy/maintenance and required-audit rollback |
| Chromium browser | 27 | 23 canonical scenarios and four native-dialog adoption scenarios |

Six inspected browser captures cover 390, 800 and 1280 CSS pixels in light/dark
themes. Browser fixtures use production-derived permission/projection shapes;
HTTP/transaction controls exercise real owners. They are controlled provider
evidence, not a live Soulseek download or provider restart rehearsal. PostgreSQL
tests ran serially with isolated test-owned databases. The reused local media
fixture image was verified as
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`.
Node 24.18.1 and npm 12.0.2 were checked locally.

Fresh `npm run validate:security` passes image/topology policy and the all-severity
npm audit with zero reported vulnerabilities. It is dependency/policy evidence,
not a security certification or a live provider assessment.

## Original failures and corrections

- Provider scoped lint first reported two duplicate imports. Consolidating them
  corrected the original check without changing behavior.
- The first adoption HTTP fixture run passed nine of 13 cases; four returned
  401 because the mocked session did not rebind the independent administrator
  guards. The corrected fixture calls the real guards with its explicit session.
  All original assertions remain, and the expanded final command passes 18.
  Original stdout is in the tool transcript only; the retained fixture note is
  a factual note, not reconstructed stdout. Eight adoption PostgreSQL cases
  passed on their first execution.
- The first backend PostgreSQL run passed five of six. One fixture omitted the
  isolated transaction runner and reached the default pool, causing SCRAM setup
  failure. Injecting the actual isolated runner fixed the original scenario;
  the isolated case and complete six-case rerun pass. First/final logs are retained.
- The first browser run passed 25 of 27. One fixture used an unregistered path;
  it now uses `/app/missing`. The other exposed a real normalization omission:
  the new review permission was stripped before rendering. Explicit boolean
  normalization and a lifecycle regression fix it; the rebuilt original browser
  command passes all 27. Initial/final logs and six captures are retained.
- Independent final review found untyped successful-response body failures and
  an unnecessary lookup that could downgrade a durable rejection. Typed GET/POST
  uncertainty and preserved rejection fix these; the 113-test provider command
  passes afterward. No pre-fix failing test execution is claimed.
- The first full validation stopped at copyright compliance for four new files.
  Correct complete headers fixed the original command. Its first log is retained;
  the final complete command passes all checks and 9,065 tests as recorded above.
- The final line-ending helper safely refused a partially staged document diff
  before writing. Comparing the complete working tree against its HEAD baseline
  corrected the helper; the final preservation/whitespace/link checks pass. The
  original assertion log is retained. No runtime behavior changed.

Logs are under ignored `.tmp/batch-handoff-2026-10/` and browser/client evidence
under `.tmp/batch-download-handoff-2026-10/`. Original failures are not erased.
No unrelated test expectation, runtime authorization or proof threshold was relaxed.

## PR applicability and skill

Fresh GitHub MCP collection/immutable-head/file checks found no eligible unreplayed
patch among the three open PRs. No random draw or local reimplementation was
applicable. Separate [PR design](OPEN_PR_APPLICABILITY_BATCH_HANDOFF_2026_10_DESIGN.md)
and [outcome](OPEN_PR_APPLICABILITY_BATCH_HANDOFF_2026_10_OUTCOME.md) preserve
discovered URLs, pagination, exact comparisons and retained evidence hashes.

The existing [practical web-standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now maps batch ownership, exact observation, original uncertainty and explicit
operator consent to their consumers and adverse evidence. It combines applicable
W3C/WHATWG, IETF, OWASP and PostgreSQL practice without turning every task into
a compliance audit. Source/installed structural validation and four-file SHA-256
identity pass; no fresh blind behavioral skill trial is claimed. Its maintained
[design](WEB_STANDARDS_SKILL_DESIGN.md) and [outcome](WEB_STANDARDS_SKILL_OUTCOME.md)
separate skill checks from application evidence.

## Limits and next work

This change does not establish provider exactly-once behavior, uniqueness after
provider storage reset, future version compatibility, blind restart replacement
attribution, assistive-technology announcements or a live media import. The
checked-in deployment remains at slskd 0.25.1. Unsupported and unverifiable
legacy/older episodes remain in review; absence never authorizes another POST.

Next recommended work: guarded resolution of current-origin conflicts caused by
a newer, never-dispatched job. An allocated R2 currently prevents R1's valid
receipt from advancing. Add an explicit authorized durable command that proves
R2 never dispatched, retires its allocation and restores R1's authority atomically.
Use a narrow service/store and shared origin lookup across the common handoff,
recovery, adoption and wanted-progress owners. Preserve uncertainty whenever
either episode lacks sufficient evidence; do not clear an unknown dispatch.

Acceptance case: R1's lost POST later yields full exact batch evidence; R2 is
merely allocated and blocked. A real PostgreSQL race must advance R1 once,
record one resolution audit alongside required phase audit and prove a concurrent
R2 worker sends zero additional POSTs.
A dispatched or uncertain R2 refuses resolution. Broader incomplete legacy
resolution and destructive provider actions remain separate explicit contracts.
