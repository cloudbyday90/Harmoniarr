# Wanted root test lanes outcome

Date: 2026-10-16. Companion documents:
[design and tradeoffs](WANTED_ROOT_TEST_LANES_DESIGN.md) and
[official research](WANTED_ROOT_TEST_LANES_RESEARCH_2026_10.md).

## Delivered behavior

Four focused ESM modules share pure pair comparison, scenario execution,
current-authority checks and explicit benchmark ownership. The existing workload
CLI adds --root-lookups. Its full default retains two media profiles, three
historical receipt cardinalities and four counterbalanced pairs: six scenarios,
48 samples. Earlier workload modes and defaults are unchanged.

The canonical routine filename retains one sine/two-second/one-candidate case
with both actual readers and every original current-authority assertion. It
still seeds/applies real media, hashes bytes and verifies complete private
projections, root/fingerprint counts and the exact query difference. Null/missing
settings, disabled owners and same-transaction drift still refuse publication,
with unchanged persisted Wanted rows. The full benchmark's first small scenario
also retains those guards.

No skip, name filter, root cache, schema/pool/resource/deadline increase,
production source, SQL or dependency change is introduced. The large matrix
requires deliberate invocation:

```powershell
New-Item -ItemType Directory -Force .tmp | Out-Null
npm run measure:wanted-guarded-workload -- --root-lookups --output .tmp/wanted-root-lookups.json
```

Verify existing media/PostgreSQL tools first; the generic workload CLI does not
inherit the coordinator's automatic capability preflight. Its existing npm
entrypoint supplies --expose-gc; this root mode adds no GC call or warm-up.
Reduced --profiles/--pairs selections are explicitly selected coverage, not full.

## Evidence so far

The fresh unchanged baseline passed six native cases in 122.032 seconds on
source SHA-256 `b6351d94a9f229b735ae7ade4abfefda3ccc8a93681cacafa6625d921774b2d8`
(3,005 source files). The changed routine native file passed one case in 22.748
seconds. This local reduction transfers repeated work out of the routine lane;
it is not an algorithmic or whole-CI speedup. Routine projections change from
48 to two, and isolated scenarios from six to one.

The actual full benchmark CLI exited zero and reported full completion:
six scenarios and all 48 unique samples in 116.960 seconds (116.817 seconds
inside its measurement runner). All 48 sample rows match the fresh baseline's
file sizes, query counts, counters and every phase's call count. Timings are
descriptive and were not equality assertions. Full private projections are
compared within each matched pair; fresh randomized fixtures are not treated as
cross-run identity matches.

The final freeze covers nine code files and all 3,010 source files, SHA-256
`1a98492e2a0f58f6ef079271d3fd9d5cb5128cfa3bdc2596f7a3f460a5040000`.
Source-before/after equality passed for routine and full benchmark collections.
All 29 focused tests and changed-file ESLint pass, including legacy mode plans,
comparison mutations, missing/duplicate/foreign sample refusal, fixed dimension
snapshots and held startup/scenario/progress/cleanup with original Error/null.
Testing/standards skill structural validators pass and the installed standards
copy matches the repository copy.

All 10,452 fast cases pass: 5,397 server, 4,384 client and 671 script cases, with
zero failures, cancellations or skips. Both builds and the fast gate's static
checks pass in 138.369 seconds; 225 existing Vue warnings match the prior run.

## Retained complete-command failure and separate diagnosis

The fresh complete coordinator invocation failed after accepting 40 files and
223 cases. It exited one after 661.123 seconds. All 131 shared registrations had
already been released, with none reaped. The unchanged
library-media-request-atomic-creation.test.js then received HTTP 500 instead of
200 while its fixture enabled required CSRF in settings, before the third case's
domain assertions. The changed root-profile file had not been reached.

The original approved checkout record reports 10,006.945 ms at the unchanged
10,000 ms bound. Before: total 1, idle 1, waiting 1; requested: total 1, idle 1,
waiting 2; settled: total 1, idle 0, waiting 0. Configured max is two and the pool
was not ending/ended. The record's phase/server phase are unknown and its original
driver client was not observed. These point snapshots do not prove the cause of
the wait. Its later independent query/readiness/container probes passed on
PostgreSQL 18.3; they do not diagnose the original queued checkout or establish
that CPU load caused it.

One separately labelled diagnostic invocation of that unchanged file passed all
six cases in 25.343 seconds on exactly the same frozen source. It does not erase
or repair the failed full invocation. No deadline, pool size, retry, skip, fixture
assertion or production code was changed in response. The initial failure,
closing fingerprint and diagnostic logs/results are preserved independently.

The explicit selected 86-file remainder accepted three files/13 cases, then
failed at unchanged library-scan-receipt-invalidation.test.js; its command took
125.135 seconds. The scan fixture's candidate remained import_pending instead of
applied after another 10-second checkout failure. This original connection was
observed with a matching target: transport connected at 2.529 ms, startup
dispatched at 2.768 ms, then no observed authentication or backend-ready milestone
before failure at 10,011.084 ms. Server startup association stayed unassociated
with a clipped 33-row receipt window. Later healthy probes do not locate that
original gap. This differs from the first unobserved queued caller; neither is
diagnosed as CPU saturation or repaired by a later successful run.

A separate unchanged scan-file diagnostic passed all five cases in 33.524
seconds. Broad validation stopped after these two independent failures rather
than repeating the full gate or changing bounds. All code/source fingerprints
remain equal. The intended routine population is 556 cases in the same 127
files, but a successful complete invocation on this change is **not proved**.
The unchanged prior full pass remains historical evidence. No selected results
are replayed into a green full collection, and no combined 127-file pass is
claimed. Eighty-one other unchanged files were not freshly revalidated after
the broad failures; the separately executed root case covers its changed file.

| Fresh scope | Result | Passing files/cases or samples | Elapsed seconds |
| --- | --- | --- | --- |
| Unchanged native baseline | Passed | 1 file / 6 cases | 122.032 |
| Changed routine root file | Passed | 1 file / 1 case | 22.748 |
| Explicit full root benchmark | Passed | 6 scenarios / 48 samples, every work row matched | 116.960 |
| Fast/static/build gate | Passed | 10,452 cases, both builds | 138.369 |
| Complete coordinator invocation | Failed | 40 accepted files / 223 cases before failure | 661.123 |
| Atomic-creation diagnostic | Passed separately | 1 file / 6 cases | 25.343 |
| Selected remainder invocation | Failed | 3 accepted files / 13 cases before failure | 125.135 |
| Scan-receipt diagnostic | Passed separately | 1 file / 5 cases | 33.524 |

Private evidence is under .tmp/wanted-root-lanes-2026-10-16: baseline/routine/
benchmark source/result/log records, baseline work comparison, fast records,
untouched failed complete log/result, failed remainder report/log and separately
named atomic/scan diagnostics. Repository documents retain approved aggregates;
raw response/driver output remains private. The first candidate lint check
rejected a shadowed helper name and a promise-executor return; those were fixed
before the final code freeze and all subsequent focused/fast lint checks pass.

## Recommendation stack and limits

Select native routine paired-reader/current-authority proof → existing explicit
workload CLI → reviewed full/selected dimensions → private pair/work assertions
before numeric summaries → existing PostgreSQL/app/rollback owners → actual
completion and cleanup evidence. Benefits are fewer routine scenarios and hashes,
clear coverage ownership and retained full scaling verification. The cost is a
separate deliberate benchmark invocation; version/tool availability and host
load remain operational constraints. Do not expand sharing, parallelism or
default coordinator scheduling from this lane split alone.

Maintain existing testing/standards AI skills with the concrete command,
implementation owners, adverse cases, source status and evidence limits. No
overlapping general skill or browser/WCAG certification is introduced.

Opening and closing GitHub MCP PR collection reads both returned zero open PRs;
none was available to implement or rebase. All repository work remains on main,
with no release, tag, separate branch or PR merge. Nine code files and eleven
Markdown files form this change; ignored private validation artifacts stay local.

First follow-up: investigate the original queued application-pool checkout and
its lost phase/client association, alongside the separately observed startup
gap, before further scheduling/default promotion. Capture the actual pending
waiter, handoff/removal and phase at dispatch; retain conservative association
when a startup receipt window clips or no authorization marker is available.
A later healthy connection cannot locate the original stall. Preserve both
promise/callback acquisition, existing resource bounds, original Error/null and
all transaction/audit assertions. Do not convert this collection to green by
replaying selected rows or increasing limits.

Later efficiency candidate: profile automatic-library-add fixture setup/media-command work
before further scheduling changes. Its eight authorization, audit/queue rollback,
ownership, policy/recovery and real-byte checks belong in routine correctness.
The fixture's reusable app runtime already has per-scenario workspace cleanup
guards, while its media helper uses per-command Docker run/--rm. Inventory actual
returned workers and generation/inspection calls before considering the existing
owned read-only ffprobe executor. CLI timeout alone is not remote retirement;
writable media generation needs its own reviewed ownership. Keep every behavioral
case, real mutation/refusal check and current resource bound. No source/byte cache
or wider shared-parent admission is justified by elapsed time alone.
