# Fixture HTTP phase outcome

Date: 2026-10-16. Implementation and validation follow the
[design](FIXTURE_HTTP_PHASE_DESIGN.md) and
[official research](FIXTURE_HTTP_PHASE_RESEARCH_2026_10.md).

Added narrow ESM phase-scope, owned dispatch and request-lifecycle composition
under the existing withServer helper. Both app entrypoints already supply the
owning observer. Checkout record v3 admits the approved http_request phase;
application routes, authorization, schema, dependencies, pool/deadline limits and
scheduling are unchanged.

The initial native HTTP body control exposed an incomplete candidate: server
handler entry and data callbacks were attributed, but body end ran in server_start.
The final adapter also scopes the admitted request/response dispatchers until
response finish/close, with exact restoration and no payload inspection.

All 37 final focused cases pass, covering timing-disabled context, native POST
body/end, disconnect, nested/concurrent ownership, expiry of inherited work,
listener order/once semantics, custom/accessor refusal, partial setup rollback,
later owners, descriptor restoration and original Error/null through close errors.
Focused ESLint passes with zero warnings.

A separate selected native control passes all three app-checkout-diagnostics
cases in 8.284 seconds. Both actual app entrypoints execute a real PostgreSQL
callback query from a POST body-end handler, recording http_request on the
application pool. Direct scenario work keeps its own phase. Private request
payload/header sentinels are absent from the minimized records.

The frozen source covers 3,020 files, SHA-256
`605e0f38d98d45630724b82b893cf46c01b764809a4268d7c652b8b65541e026`.
All seven changed JavaScript files retain their opening/closing byte hashes.
Private evidence lives under `.tmp/http-phase-2026-10-16/`.

The complete fast lane passes all 10,489 cases (5,434 server, 4,384 client,
671 scripts), static policies, lint, test hygiene and both builds in 136.554
seconds. All lanes have zero failures, cancellations or skips. The existing
client fixtures still emit 225 Vue warnings; this slice does not resolve them.

The fresh `npm run test:integration:coordinated` invocation passes all 127
canonical files and 558 cases, with zero failures, cancellations, skips or todos.
It executes the reviewed seven-file shared cohort and all 120 isolated serial
files. All 131 shared database registrations are released, with none reaped.
CLI wall time is 2,018.018 seconds (33 minutes 38 seconds); coordinator time is
2,016.698 seconds. This is complete correctness evidence, not a speedup claim.

Exact planned file order, unique membership, all 127 native root summaries and
case digests match the coordinator's accepted records. Aggregate counts match
every per-file count. Final source and all seven changed JavaScript byte hashes
match the opening freeze. The three selected native app cases also occur within
the complete invocation; those scopes are not added together as extra coverage.

The earlier [broad failures](WANTED_ROOT_TEST_LANES_OUTCOME.md) remain historical
failures. In this fresh complete invocation, atomic creation passes all six cases
and scan-receipt invalidation passes all five. A new passing run does not diagnose
or retroactively repair their earlier connection failures.

Native reporter output contains 127 TestsStream warnings about 11 end listeners.
They are recorded separately from test outcomes; their cause and any leak remain
unestablished. No listener limit was increased. Private full logs, exact case
evidence and the validated summary remain local in the artifact directory above.

Opening and closing GitHub MCP discovery found no open PRs. Random local PR
application and stale-PR cleanup are inapplicable. Work stays on main without a
PR merge, branch, release or tag. The focused testing and standards skills retain
the verified context boundaries and controls; the installed standards copy
matches the repository version.

## Next recommended efficiency work

The slowest file in this collection is music-queue-automatic-library-add.test.js:
eight cases in 94.285 seconds. Its observed scenario_work total is 79.511 seconds,
versus 6.521 seconds for schema_prepare, 2.259 for container_start and 1.044 for
container_stop. These are descriptive phase measurements, not additive global
wall-time ownership or a cause established by timing alone.

Source review finds that this file still uses createLibraryAddMediaFixture without
an inspectionExecutor, so its image-backed ffprobe path launches Docker per
command. The existing createLibraryAddMediaScenario already offers per-command
and owned-api modes, a separate inspection owner per scenario and cleanup before
workspace removal. This is an implementation candidate, not validated savings.

| Recommendation stack | Benefit | Cost or limit |
| --- | --- | --- |
| Keep owned HTTP scopes, bounded records and the complete canonical gate | Reliable attribution and unchanged correctness coverage | Maintain native dispatch/lifecycle controls |
| Benchmark the existing owned-api media scenario in automatic library-add first | Targets the measured slowest file and can avoid repeated ffprobe launches | Preserve exact bytes, outcomes, authority checks, per-scenario roots and actual command/reader cleanup; require paired evidence before promotion |
| Diagnose native reporter listener warnings separately | Cleaner validation output and clearer ownership | A warning alone proves neither a leak nor a test bottleneck |

Next: adapt that eight-case fixture to the existing media-scenario helper with an
explicit comparator, then measure per-command versus owned-api with equal work
and complete cleanup. Retain all native assertions, resource bounds and serial
scheduling. Broader adoption needs its own evidence.
