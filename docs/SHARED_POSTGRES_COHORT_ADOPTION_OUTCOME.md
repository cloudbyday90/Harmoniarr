# Shared PostgreSQL cohort adoption outcome

October 10, 2026, America/New_York. Baseline main: `e1ce82a`.
The separate [design](SHARED_POSTGRES_COHORT_ADOPTION_DESIGN.md) and
[research](SHARED_POSTGRES_COHORT_ADOPTION_RESEARCH_2026_10.md) precede implementation.

## Baseline and ownership audit

The pre-edit matched-order baseline passes **34/34** cases (Wanted 10, catalogue
8, release reconciliation 8, tag snapshot 8), zero failures/cancellations/skips,
**217.42s command wall** and 217.21s adapter-wrapper duration. The four files use
the same native adapter/reporters/order as the planned shared profile. Phase
records show four container starts (20.52s inclusive), four stops (4.96s) and
**90 database creations**. No phase sum is substituted for wall time.

Release's 24 and tag's 22 scenario variants use the isolated runtime/temporary
helper; no raw CREATE/Docker or app-global pool appears in their creation trace.
Their original 16 cases/46 variants and real row/lock assertions remain the
adoption contract. Bare pre-checkpoint waits and release-finally completion do
not prove adverse worker settlement. Tag hook exceptions additionally need
refusal outside native parser-error persistence. Deferred manual lease cleanup
must follow gate release/transaction drain to avoid blocking its own cleanup.

## Implemented controls and current evidence

Three narrow ESM modules compose the existing lifecycle for lazy task admission,
controlled gates/deferred finalizers, owned workspaces and rollback-only checked-out
clients. **13/13** focused controls pass, zero failures/cancellations/skips; scoped
lint passes. Controls include pre-abort/late-admission launch refusal, original
Error/null preservation, actual drainage before resource cleanup, finalization
ordering, workspace resolution failure and client release after rollback failure.
The first ordering control used a late observation callback that could run after
another gate's resumed task; moving that observation before the gate preserved
the intended ordering assertion. Its first log remains retained.

Fresh official pg Pool API review led to discarding a client after BEGIN/ROLLBACK
failure rather than returning a possibly dirty transaction to idle. The three
focused transaction-client tests pass again, checking discard arguments alongside
original Error/null preservation. This requests disconnection; it is not an
independent observed zero-session or arbitrary-I/O cancellation certificate.

Domain refactors and adverse PostgreSQL proof are completed below; public CLI
measurement and complete final validation remain pending. Expanded adoption is
not claimed before the corrected candidate's unchanged cases all pass.

## Adverse proof and rejected first candidate

Domain worker controls pass 10/10 (release 2, tag 8); release's two controls first
reproduced the older helper's failures. Scoped lint passes. Actual PostgreSQL
lifecycle controls pass four cases: coverage SQL failure before readiness,
cancellation while projection locks are held, a native tag hook assertion before
readiness with secondary cleanup faults, and held native-parser cancellation.
They verify actual rollback/release before cleanup, no new projection/tag effects,
zero idle transactions and owned media removal. Tag's first two new acceptance
tests incorrectly expected a boolean release instead of the documented local
lease DTO; strong identity/state/timestamp assertions corrected that fixture
mistake, preserving ordering and deadlines. Its 0/2 first log is retained.

The first shared candidate is rejected: **25/26 passed** across three files,
one release serialization case failed; tag never started because the launcher
stopped after the failed file. All observed database releases/server stop completed.
This 82.31s incomplete run is not performance or adoption evidence.

Moving activity observation to a paused transaction avoided borrowing a spare
client, but its first monitoring read could cache the session list before the
contender connected. Fresh official PostgreSQL guidance distinguishes this
transaction-held monitoring snapshot from ordinary READ COMMITTED data snapshots.
The smallest same native case reproduces **0/1**, then passes **1/1** after
separately awaiting `pg_stat_clear_snapshot()` before each activity read, with
abort/outcome checks before both statements and actual read drainage before
rollback. The original blocker assertion, 100×10ms polling bound, SQL/expiry
controls and case deadlines remain unchanged. Tag's equivalent observer is
corrected; no older unrelated timeout is attributed to this reproduced mechanism.
The corrected four-file candidate passes **34/34**, zero failures/cancellations/
skips, **96.92s command wall** / 96.35s launcher duration. All **90 registered
databases are released**, zero normal reaping; one owned server completes cleanup.
This clears the named allowlist adoption gate; public CLI verification follows.

Compared with the pre-edit 217.42s baseline, the observed profile saves 120.50s /
about 55.4% locally. Both use the same explicit per-file adapter, native reporters,
file order and phase-timing setting. Fixture lifetime changes, source/code warmth
and host/cache differences also changed; container phase reduction cannot explain
or causally establish all saved wall time. No CI or complete-gate speedup is claimed.

## Public profile and selected stack

`npm run test:integration:shared-postgres` now admits the four audited files in
matched order. Its public native CLI passes **34/34**, zero failures/cancellations/
skips, **98.86s command wall** / 97.80s launcher duration, all **90 registered /
90 released**, zero reaped. Compared with the pre-edit baseline this is an
observed 118.56s / **54.5% local reduction**, with the same attribution limits as
the corrected private candidate. Default complete integration scheduling remains
unchanged. Named subset/path/duplicate refusal controls pass 6/6.

| Phase | Four-server baseline | Public shared profile |
| --- | ---: | ---: |
| Container start | 4 / 20.52s total | 1 / 2.92s |
| Container stop | 4 / 4.96s total | 1 / 0.85s |
| Database creation | 90 / 10.34s total | 90 / 5.57s total |
| Registration | absent | 90 / 0.60s total |
| Verified release | absent | 90 / 0.28s total |

Overlapping/inclusive phases are not added into wall time. Reducing containers
also changes server/cache reuse; the startup/stop rows alone do not explain the
whole difference. Phase evidence remains in the separate retained comparison.

Recommended stack:

1. Native serial per-file Node isolation and the named shared-server profile for
   these affected domains. Benefit: measured startup amortization and faster local
   feedback; cost: explicit lifecycle/registration completeness per admitted file.
2. Existing lifecycle/worker observer plus narrow work/workspace/rollback helpers.
   Benefit: early failure/readiness and actual drain before cleanup; cost: careful
   expected-failure and deferred-finalizer ownership rather than implicit promises.
3. Fresh PostgreSQL databases/pools, current OID/role ownership, authenticated
   bounded control and refreshed monitoring evidence. Benefit: preserved SQL races
   and refusal of unowned cleanup; cost: control/inspection/clone overhead.
4. The unchanged complete serial final gate. Benefit: broad regression coverage;
   cost: long final feedback, so reserve it for a stable candidate.
5. Maintained standards evidence references. W3C/WHATWG/IETF cover applicable app
   journeys; Node/pg/PostgreSQL/OWASP own this fixture slice. Structural checks and
   tests establish their executed scope rather than general conformance/security.

Security validation passes image/topology policies and zero npm vulnerabilities.
Source/installed standards skills structurally validate and match four maintained
files; entrypoint metadata/invocation policy is unchanged. This is narrow reference
maintenance rather than a new blind skill trial. No app/UI, migration, release,
branch, tag, deployment or PR merge is introduced.

The stable `npm run validate` gate passes **9,877 tests**: 4,594 server, 4,377
client, 552 script and **354 integration**, zero failures/cancellations/skips.
Copyright, migration/schema/ESM/image/topology/hygiene checks, complete lint and
both builds pass. Wall time is **18m19.92s**; native serial integration is
**16m6.69s** and the client build is 1.88s. Existing non-production ephemeral-VAPID
diagnostics remain separate from failing test/lint evidence. Default scheduling
is unchanged; another whole-gate duration is not causal proof that the opt-in
profile accelerated default CI. All 16 changed code files match their pre-gate
SHA256 manifest after validation. Local links across 12 changed MDs resolve.

Next: instrument actual empty-schema preparation in the remaining cohort members,
then assess the existing verified migration-template mechanism for tag/release
fixtures with fresh seeds/clones and dedicated untemplated migration proof retained.
Creation/registration is complete here; schema-preparation cost needs direct phase
evidence rather than inference from total wall time. Discovery-request recomputation
remains the next product task. Do not broaden to raw Docker/manual siblings or
more file workers from this four-file result alone.

## Evidence freeze and publication scope

Twenty-four retained log/state/comparison/code-manifest hashes are inventoried in
`.tmp/shared-postgres-cohort-adoption-2026-10/validation-evidence-final.json`, SHA256
`50c1916dfd00c3a3520424d312b00e13b0b3db76cb66b618c30501c0a38c8238`.
The fresh [PR assessment](OPEN_PR_APPLICABILITY_COHORT_ADOPTION_2026_10_OUTCOME.md)
at 20:48:46 UTC again has no eligible unreplayed patch. Original candidate, exact
statistics red/green and lease-DTO fixture failures remain retained separately.
All work stays on main; commit/push includes the code and separate recommendations,
design/outcome/research and skill maintenance. No release or PR merge is performed.
