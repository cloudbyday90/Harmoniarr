# Catalogue fixture lifetime and template outcome

October 10, 2026. Baseline main: `ed25034`. See the separate
[design](CATALOGUE_TEST_LIFECYCLE_DESIGN.md) and
[official research](CATALOGUE_TEST_LIFECYCLE_RESEARCH_2026_10.md).

## Implemented behavior

Catalogue retains eight native cases and thirteen fresh scenario variants. Small
ESM scenario, worker and lock-observer modules reuse the existing scoped work,
workspace, rollback-client and native worker observers. Readiness races actual
settlement; detached completion is registered before launch. Manual organize
transactions are tracked and their captured leases release after held work drains.
Borrowed statistics reads close admission and drain before the owner resumes or
rolls back. Each activity poll refreshes its transaction's monitoring snapshot.
The original domain assertions, 100 x 10ms polling, 700ms expiry and 0.8s wait
remain. Workspace ownership now covers realpath and cleanup failures.

Fixture hook failures retain their original Error/null reason through actual
lease release. Non-Error owner failures are safely represented inside the native
worker and observed with their original identity after release; ordinary SQL/
service Errors still produce the expected native job outcomes. No production
worker, database schema, scheduler or dependency changed.

After the explicit trial and adverse proof, only the original catalogue suite
selects `migration_template` by default. Its independent override is
`HARMONIARR_INTEGRATION_CATALOGUE_SCHEMA_MODE=empty`; malformed or empty values
refuse without fallback. Global and dedicated lifecycle/bootstrap/migration/
recovery defaults stay empty. The existing owner verifies migration-only source
lineage, sealing/current OID/role/zero sessions and every clone's admission. Each
case still creates a fresh database/pool/workspace/seeds and performs its actual
idempotent migration check. No seeded or persistent cache was introduced.

## Executed focused evidence

- Five worker and four observer controls pass (9/9), including hook/release
  precedence, cancellation before writes, Error/null owner identity, serial
  borrowed reads and current-read drain. Four schema-policy controls pass for
  all domains, strict refusals and independent overrides. Scoped lint passes.
- Two actual PostgreSQL lifecycle cases (three variants) pass: a native walk
  assertion remains primary through secondary release/workspace failures; Error
  and null cancellation inside a provisional root INSERT roll back all state,
  leave no downstream work or idle/aborted-idle transaction, and verify the exact
  released lease DTO before media removal.
- Two explicit-template PostgreSQL cases pass: genuine changed-file/tombstone
  commit, clone-local trigger fault and failed case cannot contaminate the next
  clone's rows/IDs/run/lease/files; preparation occurs once. Reopening the private
  source refuses admission before workspace, schema checks, seeds or callback,
  with no empty fallback. Combined acceptance: 4/4, zero failures/cancellations/
  skips, 23.34s native duration.

Bounded legacy-adapter controls failed 0/2, and a separate precedence control
failed 0/1 before correction. A new cancellation double initially omitted
`markRunCancelled`, yielding a file-level detached TypeError despite eight green
assertions; supplying that required adapter method corrected the test double.
Those logs are retained, distinct from actual PostgreSQL proof. The first root
baseline invocation also failed strict release setup because PowerShell null
assignments supplied empty overrides. The corrected invocation removed the
variables explicitly; the failed run is excluded from comparisons.

## Measured comparison

Same public four-file order, reporters, one owned server and thirty-four unchanged
native cases. Wanted/release/tag keep their audited defaults. Approved phase
records contain opaque IDs/fixed labels; no credentials or database names.
Native diagnostics report PostgreSQL 18.3 on Alpine; current official major-18
documentation is separately classified in the research. Host Node is 24.18.1.

| Profile | Cases | Catalogue repeated checks/application | Catalogue source preparation | Catalogue clone verification | Wall | Owned/released |
| --- | --- | --- | --- | --- | --- | --- |
| Corrected pre-audit baseline | 34/34 | 20.97s / 13 | None | None | 99.81s | 92/92 |
| Audited catalogue, explicit empty | 34/34 | 16.51s / 13 | None | None | 72.14s | 92/92 |
| Audited catalogue, explicit template | 34/34 | 0.34s / 13 | 1.25s / 1 | 0.43s / 13 | 69.19s | 93/93 |

Every profile has zero failures/cancellations/skips and zero reaped databases.
The extra owned database is the private catalogue source. Source preparation
plus case checks is 1.59s versus 16.51s empty application; clone verification is
an additional 0.43s. Database copying/admission/cleanup remain separately measured
costs, not free work. Inclusive/nested phase spans are not additive wall time.
Matched audited wall reduction is 4.1%; the larger pre-audit difference is not
attributed to the lifecycle refactor. Host/cache variation is substantial; this
pair does not prove CI or complete-gate savings.

## Final validation and recommendation

Final source is frozen by SHA256 across ten code files. The promoted default is
exercised by the final complete gate, with mode overrides absent, rather than
repeating the already passing cohort. The first broad run passed all server/
client/script tests but encountered two unchanged app-fixture failures at the
first `pool.connect()` in schema bootstrap: Activity feed's import-candidate case
and admin-recovery CLI's first case. Both precede SQL/app creation and use no
catalogue/template path. Their native underlying cause was not emitted before
the deliberately stopped broad run's terminal summary; failure events and the
incomplete log are retained. Only the positively identified validation child tree
was terminated. This is rejected/incomplete evidence, not a complete gate pass.

The two cases pass unchanged in the focused TAP run (2/2, zero fail/cancel/skip,
43.46s). Ten source hashes still match; no deadline, assertion, runtime or retry
policy changed. The same complete command is rerun after this investigation.
The configured 10s connection-acquisition bound fits the observed durations but
does not establish socket delay versus queue exhaustion or a reproduced cause.
The final `npm run validate` passes **9,901 tests**: 4,612 server, 4,377 client,
552 script and 360 integration, with zero failures/cancellations/skips. Static
checks, complete lint/test hygiene and both builds pass. Wall duration is
1,468,434.7932ms (24m28.43s); integration is 1,292,367.1982ms (21m32.37s).
This is longer than the preceding slice's 23m33s gate and does not demonstrate
whole-gate improvement. The first rejected attempt remains separate. Expected
non-production ephemeral VAPID messages and Vite plugin timing diagnostics are
not failing checks. All ten frozen source hashes still match after the gate.

Dedicated untemplated schema bootstrap passes 105/105 migrations. Image/topology
security checks pass and npm audit reports zero vulnerabilities; this is not a
repository-wide security certification. Source/installed standards skills and
the testing skill pass structural validation, with all four maintained standards
files identical by SHA256. Local Markdown links resolve at final freeze.

Staging normalized CRLF to LF in one added PostgreSQL test and removed redundant
blank document endings. That test's LF-normalized content is identical; validated
and publication hashes are retained in `publication-formatting.json`. The other
nine code hashes match exactly. No logic changed or complete gate was repeated
for this formatting-only correction; publication continuity is recorded separately.

Recommended stack: narrow ESM fixture scopes and observed workers; serialized
transaction/observer ownership; captured after-drain lease finalizers; existing
verified private migration sources; fresh scenario clones/pools/seeds; focused
feedback followed by one stable complete serial gate. Benefits are reliable
cleanup and reduced repeated schema work. Costs are explicit lifecycle code,
source/admission/copy checks and variable host performance. The standards skill
maps these vendor and OWASP practices beside applicable W3C/WHATWG/IETF guidance,
without a new browser-conformance or universal I/O-stop claim.

Next diagnostic item: capture bounded error/cause codes and pool total/idle/
waiting counts at the first app-fixture checkout, together with the owned server
phase. Trace invocation-owned app work and pool lifetime before changing
scheduling: the existing fixed shutdown delay and global-pool recreation are
source-review candidates, not explanations of both observed failures. Preserve
privacy and failure exits; a passing retry does not establish remediation.

Next efficiency item after that evidence: compose exactly the audited four-file cohort into the
complete serial integration gate. Recompute the recursive native test inventory,
prove a disjoint/exhaustive cohort plus sorted remainder, and execute every file
once. Preserve per-file process isolation, reporters, signals/deadlines and
serial remainder scheduling; never pass parent PostgreSQL tokens/config to the
remainder. Complete shared-resource cleanup before advancing and retain the old
native full path for matched whole-gate count/timing proof before promotion.
The current planning inventory is 80 integration files: four audited cohort
members and 76 remainder files. This enumeration is not a dispatcher or proof
of future execution/realpath ownership; recompute and verify at invocation.
Discovery-request recomputation remains the next product item.

The fresh [PR outcome](OPEN_PR_APPLICABILITY_CATALOGUE_LIFECYCLE_2026_10_OUTCOME.md)
finds no eligible unreplayed patch. Changes stay on main without branch, release,
tag, deployment or PR merge. Publication verification follows final validation.

The subsequent user-requested local rebuild follows the separate
[Docker design](LOCAL_DOCKER_REBUILD_2026_10_DESIGN.md) and
[research](LOCAL_DOCKER_REBUILD_RESEARCH_2026_10.md) after this code publication.
The walkthrough's readiness wording was corrected from an absolute no-provider-
request claim to its actual sign-in/status-read boundary; it submits no searches
or transfer commands. That documentation correction adds no runtime change.

Evidence lives under `.tmp/catalogue-test-lifecycle-2026-10/`: corrected pre-audit,
audited-empty and template-trial logs/state/phase summaries; bounded failed and
passing worker/observer controls; actual PG acceptance; schema-policy/scoped lint;
official-source and PR snapshots. Final manifests record hashes and publication.

Forty retained evidence files are recorded in
`.tmp/catalogue-test-lifecycle-2026-10/validation-evidence-final.json`.
Manifest SHA256: `6b73f1ae73d2b8eced34185769604e8c368dae86785d6ec1f7a9b7bd067990be`.
Final link check resolves 360 local Markdown links across fifteen changed
documents. Publication state is recorded separately after commit and push.
