# App-fixture first-checkout diagnostics outcome

October 11, 2026, America/New_York. See the separate
[design](APP_FIXTURE_CHECKOUT_DIAGNOSTICS_DESIGN.md) and
[official research](APP_FIXTURE_CHECKOUT_DIAGNOSTICS_RESEARCH_2026_10.md).

## Implemented boundary

Two narrow ESM testing modules own safe record projection and scoped observation.
Both app-fixture entry points use the existing bootstrap pool-factory injection.
Only its first promise checkout is observed; actual pool/client methods, SQL,
shared singleton, acquisition limits, retry policy and shutdown behavior are
unchanged. Phase observers expose their already validated opaque correlation ID
so checkout records can be paired with schema timing.

Default mode is `failures`: one record after a failed first checkout. Set
`HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS=all` for controlled first-start/success
observations, or `off` to bypass them. Settings are captured when the fixture
observer is constructed; invalid values refuse before fixture allocation.
Records use `[app-fixture-checkout] ` followed by versioned JSON.
Start records keep requested/settled snapshots and duration unknown until actual
dispatch/settlement observations exist. Final review corrected the initial start
row's duplicated pre-checkout values; unit/native checks and the complete fast
gate were rerun after that code correction, before publication.

Records allow only approved source/phase labels, three pool-counter snapshots,
selected integer limits, observed closing flags, monotonic duration and at most
three approved class/code entries. Unknown fields are null. No error text, stack,
SQL, host/port, database/user, password, pool object or client is serialized.
Observation/clock/sink failures preserve the original result/error, including
throw-null. Closing flags and last admitted server phase remain observations,
not live-health or cleanup certificates. Existing native streams have their
own disclosure contract; this does not sanitize all native output.

## Native evidence and retained failures

The combined owning native command passed **9/9**, zero failures/cancellations/
skips, in **40.40 seconds**: the five Activity drillthrough cases, admin recovery
CLI case and three new diagnostics cases. The new cases verify native saturation,
TCP refusal and both app-fixture entry points with actual schema/HTTP work.
The cached fixture server reported PostgreSQL **18.3**, separately from the
consulted PostgreSQL 18.6 documentation.

Saturation used a healthy, task-owned pool with one held client and a controlled
100ms timeout. Before/requested/settled counters show total 1, idle 0 and waiting
0→1→0. The native Error has no code; no message heuristic invents ETIMEDOUT.
Refusal used a positively observed then closed loopback listener and preserved
native ECONNREFUSED: requested total 1, waiting 0, settled total 0. Its endpoint
and password are absent from the diagnostic. Both failures retain the exact
driver error object.

Factory and functional app entry points each emitted exactly one start/pass pair
correlated with their schema phase. Their actual global pool still supports SQL
and migrations, and the local HTTP response works. Existing cleanup paths ran;
no scheduling/template/cleanup rules were promoted or independent resource-
absence certificate invented.
The original Activity/admin setup failures did not reproduce and are not claimed
fixed. These native controls verify the diagnostic seam, not their cause.

The first native run passed eight cases and failed one because the new test
assumed a `pool` context property. The actual temporary-database API supplies
`getPoolFn`. Correcting that fixture usage preserved its assertions and bounds;
the same combined command passed. The rejected log remains
`native-rejected-fixture-contract.log`. Initial scoped lint also caught implicit
Promise-executor return values in tests; block bodies fixed those lint errors.

Focused unit/preparation/phase/app-runtime checks passed **24/24**, including
eight new observer controls: client/error identity, receiver binding, single
observation, safe snapshots/cause cycles/depth, hostile getters, throw-null,
broken clocks/sinks, off/strict modes and SQL-error versus checkout-error
separation. Final scoped lint passes. Executed tests and logs are retained under
`.tmp/app-fixture-checkout-2026-10-11/`.

The final stable `npm run validate:fast` passed **9,556 tests**: 4,620 server,
4,384 client and 552 script tests, zero failures/cancellations/skips. All static
checks, full lint/test hygiene and both builds pass, at **127.35 seconds** wall.
Seven code files were frozen for this final gate and publication continuity.
The full serial PostgreSQL gate was not repeated for this observational fixture
slice; the native owners/adverse cases above supply real database evidence.
This does not claim complete database-suite execution or whole-gate speedup.
Npm audit reports zero vulnerabilities, without a repository-wide security claim.

The standards skill's source and installed structural checks and the testing
skill structural check pass. Maintained source/installed standards files are
synchronized; routing metadata and invocation policy remain unchanged. This
is narrow reference maintenance, not a new blind skill trial or web conformance
test. Local Markdown links, exact code/index hashes and publication state are
recorded separately under the same ignored evidence directory.
Publication checks match all seven frozen code files and four maintained installed
standards files; 374 local links resolve across twelve changed Markdown documents.
No production/image input changed. Source/index identity and final main/remote
state are recorded independently of executed diagnostic/test receipts.

## Recommendation stack and remaining limits

Use existing pg/preparation ownership, the narrow connect-only fixture adapter,
immutable allowlisted records, correlated monotonic phases and native adverse
controls. This gives prompt safe evidence at a small instrumentation cost.
It deliberately cannot certify a cause from elapsed time, repair singleton
shutdown, prove backend quiescence or replace a complete database gate. Do not
promote retries, longer bounds or pool scheduling on a passing retry.

Fresh [PR inspection](OPEN_PR_APPLICABILITY_APP_CHECKOUT_2026_10_OUTCOME.md) finds
no eligible unreplayed patch. W3C timing, Node/pg/PostgreSQL contracts and OWASP
privacy apply at their respective boundaries; no new web/AT conformance claim
is made. No release, branch or PR merge. Production source/image inputs are
unchanged by this test-infrastructure slice.

## Next recommendation

Audit invocation-owned app work and global-pool shutdown using these diagnostics.
Reproduce the suspected late-work/getPool recreation path with controlled gates
before replacing the current 150ms drain or moving singleton-clear timing.
The earlier fixed-delay/recreation review is a candidate, not an explanation of
both historical failures. After lifetime evidence is sound, compose the audited
four-file PostgreSQL cohort and disjoint exhaustive serial remainder, execute
every file once and compare whole-gate counts/timing before promotion.
