# PostgreSQL fixture reset outcome

October 12, 2026. Main baseline `6e8fb18`. Separate
[design](POSTGRES_FIXTURE_RESET_DESIGN.md) and
[official research](POSTGRES_FIXTURE_RESET_RESEARCH_2026_10.md) own recommendations,
alternatives and the selected stack.

## What was established

The new before-fix pool-policy controls passed 0/3: external/template pools used
40 clients from conflicting ambient settings and the fresh-container pool used
the pg default of 10. All expected the existing integration profile's two clients.
Source inspection also showed direct pools omitted the profile's checkout/idle/
use limits. This is a reproduced configuration defect, not the established cause
of the earlier connection resets.

Two abandonment checkpoints used bare gates with unregistered work. They could
wait for readiness after an operation failed, or allow cleanup before controlled
work drained. Existing scoped lifecycle helpers now register completion before
launch, race readiness against failure/cancellation, release gates and drain
real worker/transaction work before returning the scenario callback. Assertions
and the 90-second scenario deadline remain intact. The historical timeout's
exact trigger is not inferred from this independent source defect.

## Implementation and security boundary

- `testing/integration/pool-policy.js` supplies one explicit policy to direct,
  application and template pools. A native control held two clients, observed
  the third queued, released one and completed its real query. No timeout or
  capacity increase was used to obtain passing evidence.
- The first longer cohort passed 155/158, with three fixture failures: two Wanted
  cases and the recovery transaction parent-lock case requested a third pooled
  observation checkout while both clients were held. No connection reset or
  cancellation was reported in that run. Healthy server/query/readiness/state
  snapshots accompanied these failures. This demonstrates fixture starvation
  under the now-enforced policy, without explaining historical resets.
- `fixture-postgres-observer.js` now owns an independent bounded client, stops
  admission, drains its current read and awaits close while preserving Error/null.
  Both fixture consumers use acknowledged connection config. Expected lease
  rejection is observed immediately, and held transactions unlock before tracked
  publication/recovery work drains. Existing state/event/expiry/rollback assertions
  and pool/scenario/observation bounds remain intact.
- `postgres-container-state-probe.js` reads selected state from only the captured
  fresh container with fixed non-shell arguments, a two-second deadline and
  512-byte output bound. Version-two failure records keep host/query, readiness
  and container state independent. No raw inspect configuration, SQL, credentials,
  CLI output or arbitrary error messages enter these records.
- External/reused/unknown containers, off mode and pre-cancelled captures launch
  no automatic probe. All launched observations settle before record completion;
  diagnostics cannot replace the original Error/null.
- A deliberately terminated owned backend failed before an unreachable
  checkpoint with its original `57P01`. Its connection drained, the pool ended,
  and a subsequent isolated database query succeeded. Healthy query/readiness
  and running/non-OOM/no-restart state were observed concurrently with controlled
  failures. This validates the evidence path, not unexplained `ECONNRESET` causality.

All first-party JavaScript remains ESM. Responsibilities stay in small testing
modules and existing fixture owners; application routes/services and schema are
outside this implementation.

## Validation

Ignored evidence is retained under `.tmp/postgres-fixture-reset-2026-10-12/`.
Earlier failed cohorts remain under `.tmp/operator-track-union-2026-10-12/` and
are qualified in the [union outcome](OPERATOR_TRACK_UNION_OUTCOME.md).

| Check | Result |
| --- | --- |
| Before-fix direct pool controls | 0/3; retained `pool-policy-before.log` |
| Initial six literal focused server files | 53/53, zero failures/cancellations/skips, 20.280 seconds TAP |
| Final seven literal focused server files, including independent observer failure/cleanup/cancellation | 57/57, zero failures/cancellations/skips, 2.155 seconds TAP |
| Changed JavaScript lint | Pass via direct ESM ESLint CLI; initial npm-wrapper argument error retained separately |
| Three native diagnostic/abandonment/operator lifetime files, serial, timings enabled | 23/23; zero failures/cancellations/skips; 92.155 seconds TAP |
| Initial `npm run validate:fast` before independent observer extraction | 9,972 tests: 5,036 server, 4,384 client, 552 scripts; static checks and both builds pass; 184.346 seconds wrapper; retained `fast-before-observer.log` |
| Final `npm run validate:fast` on 16 frozen JavaScript files | 9,976 tests: 5,040 server, 4,384 client, 552 scripts; static checks and both builds pass; 138.216 seconds wrapper |
| `npm audit --json` | Zero reported vulnerabilities |
| Standards source/install and testing skill structure | Three validators pass; four standards installed/source files have matching SHA-256 |
| First longer serial cohort | 155/158, three failures, zero cancellations/skips; 461.338 seconds TAP; retained `native-first-cohort-155-of-158.log` and result |
| Two repaired native observer suites | 19/19, zero failures/cancellations/skips; 45.865 seconds TAP, 46.004 wrapper |
| Final longer serial cohort | 158/158 across 21 files; zero failures/cancellations/skips; 336.824 seconds TAP, 336.919 wrapper |
| Four additional audited native fixtures | 32/32; zero failures/cancellations/skips; 110.821 seconds TAP, 110.911 wrapper |
| After the four native-only fixes | Changed-file lint, ESM consistency and hygiene (1,201 files) pass; all 20 frozen working/index hashes match |

The final 21-file serial cohort passed 158/158 with zero failures, cancellations
or skips: 336.824 seconds TAP. It extends the previous 19-file selection with
native diagnostic and template cases. All 16 frozen JavaScript hashes stayed
exact across focused, fast and this longer native check. This is an affected
cohort, not the repository's complete integration gate. The earlier 155/158
failure remains separate; different source/load conditions prevent a speedup
or historical connection-reset remediation claim.

The source audit also found pooled lock observation in origin resolution, lease
fencing, file matching and organize fixtures outside that cohort. They now use
the same independently owned observer and refresh monitoring snapshots. File
matching/organize expiry waits run on their held client rather than requesting
a third application checkout. Origin resolution sets up its unscoped writer
before competing requests fill the remaining slot. Controlled readiness and
transaction drainage retain the original authority/state/filesystem assertions.
These four native-only files were added after the fast/158-case freeze; the
original 16 hashes stayed exact and the extended 20-file source is frozen for
their separate verification. No application/service or fast-test code changed.
Their separate check passed 32/32 without failure, cancellation or skip. The
158-case cohort and this additional check cover 190 distinct native cases; they
are two checks, not one 25-file execution. Node 24.18.1, npm 12.0.2, pg 8.23.0,
pg-pool 3.14.0 and PostgreSQL 18.3 were observed. Media checks used the existing
network-disabled fixture image with ID
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`
and ffprobe 8.0.1; the scoped image/timing environment was restored.

## Skill, PRs and follow-up

The existing [web-standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now gives a reusable workflow for actual policy verification, owned work and
data-minimized diagnostics. Maintainer contracts, OWASP guidance and W3C draft
measurement have concrete owners/evidence. This is maintained skill guidance,
not a duplicate skill or a new blind evaluation.

The [MCP PR assessment](OPEN_PR_APPLICABILITY_FIXTURE_RESET_2026_10_OUTCOME.md)
found three unchanged previously evaluated revisions and no new applicable PR.
No random draw, repeated replay, merge, release, tag or deployment is needed.

Recommended stack: explicit shared pool policy; scoped registered work;
bounded independent failure observations; focused adverse tests; one frozen
serial cohort. It preserves failure visibility and test pressure at the cost
of stricter contention and a bounded extra probe on failures. No performance
improvement or historical reset remediation is claimed.

Next, use any recurrent reset's original code/phase and all three observations
to justify a narrowly owned transport/session investigation. Pilot the repaired
Wanted/recovery suites in the existing serial shared-PostgreSQL
launcher after auditing parent/database ownership, actual drainage and failure
evidence. Compare matched-order executions before promotion; do not assume a
speedup or increase concurrency. Partial two-owner delivery recovery and
fulfilled-source retirement follow, retaining this diagnostic path for recurrence.
