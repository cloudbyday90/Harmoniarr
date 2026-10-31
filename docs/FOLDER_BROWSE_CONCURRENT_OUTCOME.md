# Concurrent ceiling scan outcome

October 31, 2026. See [official research and tradeoffs](FOLDER_BROWSE_CONCURRENT_RESEARCH_2026_10.md)
and [design](FOLDER_BROWSE_CONCURRENT_DESIGN.md).

## Implemented behavior

The opt-in ESM benchmark accepts `--experiment concurrent-ceiling`, fixing four
simultaneous first-page scans on one production service/process, ceiling input,
buffers 32/128 and four balanced adjacent pairs per observer state. Small modules
own the group adapter, workload/lifecycle checks and plan/summary. Existing mixed
blocks reuse the balanced-block planner. Standard CLI behavior remains the default.

Production source, buffer 32, page size 100, raw ceiling 50,000, four admissions,
five-second cooperative deadline, dependencies, schema and maintenance are
unchanged. Both variants use the matching packaged scanner with only the verified
native buffer option substituted. No image, application service or deployment
was created. First-read delivery synchronization is included in group timing;
subsequent read/stat Promises stay native.

## Measured result

Local Docker-volume and Windows C: bind profiles each completed 16 fresh-process
groups and two separate lifecycle controls under inspected two-CPU/1-GiB/no-swap
limits. All 42 profile containers and both fixtures retired. Every measured group
succeeded: 128 successful scans in total, with exact independently generated
first pages/digests, 200,004 reads, eight stats and four awaited closes per group.
All groups reached four owned handles and ended with zero live handles. There
were no timed refusals, data mismatches, OOM kills or quota-throttling increments.

Each table row contains four observations per variant. Elapsed time is completion
of the whole four-scan group. Paired change is computed per adjacent pair before
taking the median; it is not a ratio of pooled medians.

| Storage / observer | Buffer 32 ms min / median / max | Buffer 128 ms min / median / max | Median paired change | Faster 128 pairs |
| --- | ---: | ---: | ---: | ---: |
| Volume / sampling on | 453.04 / 464.76 / 534.18 | 255.43 / 265.15 / 365.81 | -42.95% | 4 / 4 |
| Volume / sampling off | 431.17 / 447.45 / 543.16 | 242.87 / 286.51 / 324.62 | -39.90% | 4 / 4 |
| Windows bind / sampling on | 659.18 / 725.46 / 897.23 | 376.62 / 480.20 / 703.45 | -28.86% | 4 / 4 |
| Windows bind / sampling off | 666.95 / 686.11 / 741.87 | 411.96 / 454.92 / 558.52 | -36.00% | 4 / 4 |

All successful slow observations remain. Paired changes ranged as follows:

Volume: -52.18% to -19.25% with sampling, -44.00% to -32.25% without periodic sampling.
Windows bind: -58.02% to -7.42% with sampling, -40.12% to -16.53% without periodic sampling.

These are descriptive local observations, not significance, causation or
universal-speedup claims.
The separate preliminary window contained one bind control pair that was 11.33%
slower at 128. That observation remains in its original report; the final repeat
does not explain its cause or remove host/storage variability.

Median process CPU for 32/128 was 714.66/435.70 ms on volume with sampling,
681.66/462.29 ms without; bind was 792.51/498.21 ms with sampling and
760.88/483.72 ms without. CPU is process work across cores, not group wall time.

## Aggregate memory and lifecycle

These are whole-process observations while four scans run, not a sum of four
separate processes. Periodic RSS uses the existing 5 ms sampler.

| Sampled profile | Buffer 32 / 128 RSS median MiB | Buffer 32 / 128 RSS-rise median MiB | Buffer 32 / 128 container lifetime-peak median MiB |
| --- | ---: | ---: | ---: |
| Volume | 71.59 / 71.88 | 10.69 / 10.18 | 21.42 / 22.33 |
| Windows bind | 72.35 / 70.89 | 11.54 / 10.89 | 21.90 / 20.29 |

Maximum observed process RSS was 74.50 MiB across all measured groups. Maximum
container lifetime charge was 24.39 MiB on volume and 23.88 MiB on bind. The
actual cgroup interface was v1; current usage remains labeled approximate.
Container charges and process RSS have different accounting, including shared
resident pages, so a lower cgroup charge is not contradictory. Neither should
be added to the other. Container high water includes startup; sampling-off RSS
has boundary coverage only. No work-window cgroup peak, leak bound, memory
equivalence or whole-application minimum is inferred. Immediate after-GC heap
rise medians were 0.23–0.26 MiB, which are snapshots rather than leak tests.
The ceiling fixture uses short ASCII `folder-NNNNN` names; maximum-length and
Unicode-name memory behavior is outside these measurements.

Four separate native lifecycle groups verified both buffers on both storage
profiles. Each refused a fifth call before stat/open during held first-read
delivery, and again while all four closes were held before native close dispatch.
Each aborted one held reader and one call at close, waited for all actual closes,
verified two successful publications and two AbortErrors, then completed a new
scan through the same service. In total: eight busy refusals without extra I/O,
eight aborted results without publication, and 12 successful control/resume scans.
All five admitted handles per control retired. Controlled delivery proves
cooperative ownership, not interruption of a kernel-blocked filesystem operation.

VM one-minute load ranged from 0.70–0.89 during volume samples and 2.48–2.86
during bind samples. Caches were not cleared. Profiles ran serially with the
full validation gate idle. Equal limits do not isolate Windows, VM, cache or
other host effects. Network/NAS and manual assistive-technology checks remain
deferred by the user.

## Recommendation and next item

The local aggregate-memory and lifecycle qualification supports 128 as the
next fixed production-buffer candidate. Its benefits are lower local median
elapsed/CPU work and successful four-scan ownership controls. Its costs are
larger internal buffering and variability across host/storage conditions.
Observed RSS medians do not establish identical worst-case memory.

The final stack is the built-in guarded scanner, fixed buffer policy, bounded
pages/raw scan/admission/deadline, close before publication/release, opt-in
balanced measurement and separate memory scopes. Production stays at 32 in
this qualification commit. No adaptive tuning, user buffer setting, second
application service or extra runtime container is introduced.

Next: promote the fixed production buffer to 128 in a separately qualified code
change, updating the adapter's expected production option, focused guard tests
and matching immutable package. Recheck packaged success/refusal/cancellation
and affected local profiles before deployment; retain the same four admissions
and deadline. Include longer/Unicode folder names in promotion checks. Network
checks can follow when a scratch location is available.

## Reproduction

Create existing empty output/scratch parent directories first; JSON output is
exclusive. Both profiles require an immutable image matching the five measured
scanner/policy source hashes. The report records its actual randomized schedule.

```text
node --test test/scripts/folder-profile-concurrent.test.js test/scripts/folder-profile-blocks.test.js test/scripts/folder-profile-buffers.test.js test/scripts/folder-profile.test.js test/server/folder-browse-service.test.js
node scripts/measure-folder-browse.js --image sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60 --output .tmp/concurrent-volume.json --storage volume --experiment concurrent-ceiling
node scripts/measure-folder-browse.js --image sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60 --output .tmp/concurrent-bind.json --storage bind --scratch-root .tmp/concurrent-scratch --experiment concurrent-ceiling
```

## Validation and provenance

| Boundary | Verified outcome |
| --- | --- |
| Complete fast gate | All 14 stages passed: 11,801 tests (server 6,469; client 4,595; scripts 737), zero failed/cancelled/skipped; lint, ESM, copyright, schema/migration/anchor, image/topology, hygiene and both builds passed |
| Native measurement | 32 successful four-scan groups, four passing lifecycle groups, all 42 owned containers and both fixtures retired |
| Default compatibility | Four successful samples, seven containers and owned volume retired |
| Packaged comparison | Fresh unchanged inventory: 1,063 server, 14 shared, 157 client files, 110 dependency packages and 151 OS packages; rebuilt client matches image |
| Retained qualification | Exact unchanged source/test/runtime supports 157 historical native groups and 13 browser tests; zero fresh historical groups/browser tests claimed |
| Walkthrough | Healthy at http://127.0.0.1:47956; same immutable image, settings and five mounts; no app writes or redeployment |
| Hygiene | Ninety-nine profiler containers retired across preliminary/final runs including the failed initial preflight, plus two retired read-only runtime-inventory containers; no profile containers/volumes or owned bind fixture remain; no image build or shared prune |

The 45 focused tests passed across the concurrent lane, original block/summary,
buffer/workload/ownership and production service suites. They cover exact pages,
one shared factory, subsequent native Promise identity, pending close settlement,
fifth refusal, read/close cancellation, overflow, changed metadata, cooperative
deadline, and Error/null preservation while draining failed checkpoints.
A regression reproduced a held-close deadlock before the four-read checkpoint;
the final adapter releases both barriers on early close and drains siblings.
Both synchronous native dispatch failure and timeout after open now complete
without an outer timeout. Preliminary profiles and the gate were repeated after
this fix; their separate raw receipts remain in the adjacent qualified directory.

Default CLI compatibility completed four successful standard small-volume
samples and retired all seven containers plus the volume. An initial preflight
found a benchmark import that existed only in the checkout; the group helper
was corrected before qualification. Its single container retired before fixture
creation. The failed receipt remains separate from successful evidence.

Final frozen source: 3,889 files, SHA-256
`a95f73c0ec450d38d52899b38ba8a862fb225268b72b9932373abc9646de5fda`.
Eight code files were frozen before the successful preflight, native profiles
and full gate. The actual schedules, raw reports, independent summaries, source
manifests and retirement receipts remain ignored under
`.tmp/folder-browse-concurrent-2026-10-31/final/`. No synthetic fixture data
remains and no image was built; compact evidence is preserved under the
[workspace hygiene skill](../.agents/skills/harmoniarr-workspace-hygiene/SKILL.md).

The unchanged image is
`sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60`,
Node 24.22.1/npm 12.0.2. All consumers used inspected UID 1000, read-only
root/fixture, network none, dropped capabilities and no-new-privileges, with
the actual CPU/memory/swap limits checked inside the kernel interface. Root was
confined to owned fixture preparation and removal.

GitHub MCP found zero open repository PRs at initial and final review on
October 31. Random local PR implementation and stale Dependabot cleanup or
rebasing were inapplicable. All changes are included on main; no PR is merged
and no branch, release or tag is created.
