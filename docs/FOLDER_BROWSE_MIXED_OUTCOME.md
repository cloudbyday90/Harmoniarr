# Mixed-file first-page comparison outcome

October 31, 2026. See [research](FOLDER_BROWSE_MIXED_RESEARCH_2026_10.md) and
[design](FOLDER_BROWSE_MIXED_DESIGN.md).

## Implemented behavior

The explicit ESM benchmark now accepts `--experiment mixed-first-page` and
rejects incompatible storage/case/repetition/comparison selections. A dedicated
planner randomizes balanced adjacent buffer pairs and observer order. A separate
pure analyzer validates complete evidence and reports paired, block and order
distributions without significance or causation claims. Standard matrix behavior
remains the default. Version 3 records the complete randomized plan.

Production source, buffer 32, page/raw-scan/admission/deadline policy, dependencies,
schema and maintenance are unchanged. Both variants use the same packaged scanner,
verified native options and original read/stat Promises. No new image, application
service or deployment was created.

## Measured result

One Windows C: bind run completed all four blocks: 64 successful fresh-process
samples, comprising 16 adjacent pairs with 5 ms RSS sampling and 16 control pairs
without periodic sampling. All 67 containers and the owned fixture retired.
There were zero refusals, OOM kills or data/count mismatches. Every sample
verified the same first 100 directory names, 10,001 caller-visible reads, two stat
calls and one awaited open/close, with no live owned handles afterward.

The table reports distributions across 16 observations per variant/state.
Paired change means `(128 time / its adjacent 32 time - 1) * 100`; its median
is calculated from pair changes, not from the ratio of pooled medians.

| Observer state | Buffer 32 ms min / median / max | Buffer 128 ms min / median / max | Median paired change | Faster 128 pairs |
| --- | ---: | ---: | ---: | ---: |
| Sampling on | 87.02 / 98.98 / 126.51 | 62.07 / 75.73 / 102.77 | -24.40% | 15 / 16 |
| Sampling off | 91.11 / 96.65 / 133.97 | 65.18 / 72.63 / 94.84 | -25.63% | 16 / 16 |

Both states favored 128 in every block by median paired change:

| Block | Sampling on median paired change | Sampling off median paired change |
| --- | ---: | ---: |
| 1 | -9.61% | -25.63% |
| 2 | -27.83% | -29.36% |
| 3 | -26.33% | -25.82% |
| 4 | -27.74% | -17.36% |

The one slower sampled pair differed by +0.13%; successful extremes were retained.
Sampled pair changes ranged from -47.06% to +0.13%, and controls from -51.35%
to -0.62%. When 32 ran first, sampled median paired change was -17.42%; with
128 first it was -28.55%. Control strata were -28.84% and -22.94%. Each stratum
contains eight pairs. These differences preserve uncertainty about ordering and
external conditions rather than explaining it away.

Median process CPU was 81.96/54.55 ms with sampling and 77.98/51.97 ms without
(32/128). Sampled RSS rise medians were 8.11/8.05 MiB. That is sampled maximum
minus baseline, not total RSS, allocation bytes or a memory-equivalence bound.
End-of-work heap differences were 1.79/1.35 MiB; immediate after-GC differences
were 0.18/0.18 MiB. The latter are snapshots, not persistent-retention/leak tests.
Process lifetime maximum RSS medians were 67.80/67.52 MiB and include startup.
Do not add overlapping process or cgroup fields. Sampling-off peaks have boundary
coverage only and are not compared as equivalent periodic peaks.

VM one-minute load ranged from 1.21 to 2.60; no quota-throttling or OOM-kill
increments were observed in the work intervals. Actual cgroup v1 usage is labeled
approximate. Equal resources and randomized balanced order do not isolate Windows,
VM, filesystem-cache or other host effects. Caches were not cleared, and full
validation ran only after native measurement/cleanup.

The preceding four-observation mixed/first-page median slowdown at 128 was not
reproduced in this window. That does not diagnose its cause, invalidate its slow
samples, prove a universal speedup or establish behavior on network storage.

## Validation and provenance

| Boundary | Evidence |
| --- | --- |
| Focused benchmark tests | 24 passed across policy, block/summary, guarded buffer/workload and ownership suites; zero failures/cancellations/skips |
| Complete fast gate | All 14 stages passed: 11,791 tests (server 6,469, client 4,595, scripts 727), zero failed/cancelled/skipped; ESM, lint, copyright, migration/schema/anchor, image/topology, hygiene and both builds passed |
| Native focused work | 64 successes, exact names/digests/read counts, 67 acknowledged container retirements and removed bind fixture |
| Default CLI compatibility | Four successful standard small-volume samples, seven acknowledged container retirements and removed volume |
| Resource controls | Actual inspected UID 1000, two CPUs/1 GiB/no swap, read-only root/fixtures, network none, dropped capabilities and no-new-privileges; kernel bounds/OOM counters checked |
| Existing runtime | Fresh unchanged inventory: 1,063 server, 14 shared, 157 client files, 110 dependency packages and 151 OS packages |
| Retained qualification | Exact unchanged production/test/runtime supports 157 historical native groups and 13 browser tests; zero fresh historical native groups/browser tests claimed |
| Walkthrough | Healthy, same immutable image and five mounts; no application mutations or redeployment |

Frozen source: 3,885 files, SHA-256
`c49496eb0b598ef500344813ec25395b81821bb2f4dc236c805aa60d5a79a192`.
Five code files were frozen before the native run and complete gate. Raw reports,
recorded schedule, independent summaries, source/inventory and retirement receipts
remain ignored under `.tmp/folder-browse-mixed-2026-10-31/qualified/`. The private
fast runner executes all 14 validate:fast stages with server concurrency eight.

The unchanged image is
`sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60`,
Node 24.22.1/npm 12.0.2. The existing walkthrough remains healthy at
http://127.0.0.1:47956. Task-owned consumers/fixtures were removed and no image
was built; compact evidence remains under the workspace hygiene policy.

## Recommendation and next item

Keep production at 32 while advancing 128 to aggregate-memory qualification.
Its benefit is consistent local first-page elapsed/CPU improvement in this
balanced repeat, supporting the earlier ceiling results. Its costs remain
larger internal buffering and unresolved sensitivity to ordering/host/storage;
single-consumer RSS does not qualify four active scans.

The final stack is the guarded built-in scanner at 32, fixed opt-in randomized
blocks, complete paired evidence and separate resource scopes. Keep successful
slow samples and explicit refusals. Do not add adaptive tuning, an operator
buffer setting or a second application service from this result.

Next: qualify four simultaneous ceiling scans in one guarded service/process
under the same container limits, comparing 32/128 and verifying fifth-scan
refusal plus admission held through actual close. Measure aggregate container/
process memory and cancellation/refusal behavior before a production default
decision. Network/NAS and manual assistive-technology checks remain deferred.

GitHub MCP found zero open repository PRs initially and at final review on
October 31, 2026. Random local PR implementation and stale Dependabot cleanup
or rebasing were inapplicable. All 11 changed files are included on main;
no PR is merged and no branch, release or tag is created.

## Reproduction

Create empty existing scratch and output directories first; output JSON files
are exclusive. Use an immutable image whose five measured module hashes match
the checkout. The command records its actual randomized order; a rerun can
choose a different balanced schedule.

```text
node --test test/scripts/folder-profile-blocks.test.js test/scripts/folder-profile-buffers.test.js test/scripts/folder-profile.test.js
node scripts/measure-folder-browse.js --image sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60 --output .tmp/mixed-first-page.json --storage bind --scratch-root .tmp/mixed-first-page-scratch --experiment mixed-first-page
```
