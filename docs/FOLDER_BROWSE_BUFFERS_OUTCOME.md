# Folder buffer comparison outcome

October 28, 2026. See [research](FOLDER_BROWSE_BUFFERS_RESEARCH_2026_10.md)
and [design](FOLDER_BROWSE_BUFFERS_DESIGN.md).

## Implemented behavior

The existing ESM measurement CLI now offers an explicit `--comparison buffers`.
A focused variant-policy module selects stream/32 and stream/128; the original
algorithm comparison remains the default. Arbitrary values are refused, and
version 2 reports identify both the comparison and applied native buffer.

Both variants execute the same immutable packaged scanner. Its dependency
adapter verifies the original production options before changing only bufferSize
for native opendir, with a checked-option count per open. Read/stat observers
preserve native Promise identity. Signed cursors, page/raw-entry/admission limits,
metadata fences, deadline checkpoints and actual close ownership are unchanged.
There is no production, dependency, schema, maintenance or application-service change.

## Measured results

Each local profile completed 72 successful samples (64 primary, eight
sampling-off controls). Across both: zero refusals, OOM kills or data/count
mismatches, all 150 containers retired and both owned fixture resources removed.
Separate preflights passed eight samples and retired another 14 containers.
Four repetitions balance first/second positions; medians average the middle
two observations. Earlier preflight records do not supply final matrix numbers.

Volume means an engine-local Docker volume; bind means a local Windows C: mount
through Docker Desktop. Small/large/ceiling contain 1,000/10,000/50,000 directories;
mixed contains 1,000 directories plus 9,000 ordinary files. Pages are first-page
or three-forward-page itineraries, not complete walks.

The table shows sampling-on medians. Time includes counters and independent
name/digest verification. RSS rise is sampled maximum minus that process's
baseline, in MiB (1,048,576 bytes), not total RSS or exact allocation peaks.

| Storage | Case / pages | Buffer 32 ms | Buffer 128 ms | Buffer 32 RSS rise MiB | Buffer 128 RSS rise MiB |
| --- | --- | ---: | ---: | ---: | ---: |
| Volume | small / 1 | 17.09 | 17.68 | 1.39 | 1.44 |
| Volume | small / 3 | 36.29 | 29.07 | 8.26 | 8.54 |
| Volume | large / 1 | 60.11 | 41.68 | 8.35 | 8.46 |
| Volume | large / 3 | 163.08 | 100.19 | 9.48 | 9.38 |
| Volume | mixed / 1 | 74.12 | 41.52 | 8.17 | 8.07 |
| Volume | mixed / 3 | 199.20 | 120.55 | 9.45 | 9.36 |
| Volume | ceiling / 1 | 268.73 | 153.72 | 8.73 | 9.03 |
| Volume | ceiling / 3 | 689.61 | 349.89 | 9.96 | 9.70 |
| Windows bind | small / 1 | 24.02 | 21.02 | 1.22 | 1.38 |
| Windows bind | small / 3 | 56.89 | 53.59 | 8.34 | 8.26 |
| Windows bind | large / 1 | 101.41 | 85.71 | 8.42 | 8.52 |
| Windows bind | large / 3 | 277.09 | 221.97 | 9.51 | 9.38 |
| Windows bind | mixed / 1 | 94.20 | 115.51 | 7.81 | 8.16 |
| Windows bind | mixed / 3 | 259.31 | 205.80 | 9.31 | 9.18 |
| Windows bind | ceiling / 1 | 340.77 | 244.55 | 8.53 | 8.90 |
| Windows bind | ceiling / 3 | 1,032.57 | 736.63 | 9.73 | 9.59 |

For three ceiling pages, 128 reduced median itinerary time by 49.26% on volume
and 28.66% on bind. The ranges were 668.73–717.49 versus 342.10–372.94 ms
(volume), and 975.29–1,154.97 versus 706.78–808.44 ms (bind). Median process CPU
was 784.90/451.73 ms and 689.36/399.20 ms respectively. Both sizes still made
150,003 caller-visible reads, six stat calls and three awaited opens/closes;
these are not native syscall counts or evidence that repeated scans disappeared.

There is no universal latency improvement. Volume small/first-page was 3.45%
slower at 128. Bind mixed/first-page was 22.62% slower by median: 94.20 versus
115.51 ms, with ranges 88.31–98.27 and 69.94–161.37 ms. In that bind point,
128 was faster in the first two paired repetitions and slower in the latter two;
their 32/128 times were 90.22/83.74, 88.31/69.94, 98.18/147.28 and
98.27/161.37 ms. No quota-throttling increments were observed during those
work intervals. These facts do not identify the cause or establish a repeatable
buffer regression; retain the variance rather than discarding slow samples.

Across the 16 primary points, the difference in median sampled RSS rise for
128 minus 32 ranged from -0.27 to +0.37 MiB. These observations do not resolve
the memory cost of the extra internally buffered entries or prove equivalence.
Three-ceiling-page end heap differences were 1.92/1.59 MiB on volume and
2.18/1.74 MiB on bind; immediate after-GC differences were 0.49/0.37 and
0.27/0.32 MiB. Those are snapshots, not leak/retention tests. Entire-process
lifetime RSS maxima were 69.92/69.43 and 69.67/69.36 MiB; startup is included.
Do not add overlapping process or container memory fields.

Sampling-off large/three-page medians were 182.69/102.76 ms on volume and
249.82/175.41 ms on bind, versus observed 163.08/100.19 and 277.09/221.97 ms.
The direction differs across profiles; controls do not establish an unbiased
overhead bound, and no correction was subtracted. Caches were not cleared.
VM one-minute load ranges were 1.27–1.94 and 1.43–3.33. Matched quotas and fresh
processes do not isolate host/storage/cache effects. Measurements preceded the
complete validation gate and profiles ran serially.

## Validation and provenance

| Boundary | Evidence |
| --- | --- |
| Focused checks | 30 passed across buffer/profile/service tests: fixed variants, balanced work, real native option substitution, page parity, option drift, refusals, held-close admission, Promise identity and container/fixture ownership |
| Complete fast gate | All 14 stages passed: 11,786 tests (server 6,469, client 4,595, scripts 722), zero failed/cancelled/skipped; ESM, lint, copyright, migration/schema/anchor, image/topology, hygiene and build checks passed |
| Native measurement | 144 final successful samples, 150 acknowledged container retirements, exact data/digests/read counts and zero live owned handles |
| Preflight | New comparison on volume and original default comparison on bind: eight successful samples, 14 container retirements and both owned fixtures removed |
| Kernel observations | Actual cgroup v1, usage explicitly approximate; two CPUs/1 GiB/no swap verified through Docker inspection and kernel counters; no OOM kill increments |
| Existing runtime | Fresh inventory matches original image/final build: 1,063 server, 14 shared, 157 client files, 110 dependency packages and 151 OS packages; no differences |
| Retained qualification | Exact unchanged production source/test/runtime supports 157 historical native groups and 13 browser tests; zero fresh historical native groups/browser tests claimed |
| Walkthrough | Healthy, same read-only loopback image and five mounts; no redeployment or application mutations |

Frozen source: 3,882 files, SHA-256
`5e0c274a9f3e58e4f5c1303091289e5bc36536fd7e1f9949699658e645e8ee47`.
Seven code files were frozen before final measurement. Raw/summary records,
checks, inventories and cleanup receipts are ignored local artifacts under
`.tmp/folder-browse-buffers-2026-10-28/qualified/`. The private fast runner
executes all 14 validate:fast stages with server concurrency eight. No unrelated
SQL/browser/native workload is claimed as freshly executed for this developer-only change.

The unchanged image is
`sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60`,
Node 24.22.1/npm 12.0.2. The walkthrough remains healthy at
http://127.0.0.1:47956. No new image, application service, branch, release or tag
was created. Actual network storage remains deferred at the user's request;
the Windows bind does not represent NAS behavior.

## Decision and next recommendation

Keep production at buffer 32, with 100-folder pages, 50,000 raw-entry ceiling,
four active scans and the cooperative five-second budget. Buffer 128 is a
promising fixed candidate for large-folder qualification: lower local ceiling
elapsed/CPU cost, without a resolved large RSS increase in this experiment.
Its costs are larger internal buffering and inconsistent first-page behavior;
four observations do not establish a universal speedup or a memory-equivalence bound.

The recommendation stack is the existing guarded built-in scanner at 32,
the explicit fixed-variant measurement lane, verified resource/data ownership,
separately scoped memory and an evidence-driven default decision. Avoid an
adaptive buffer, operator tuning setting or extra application service.

Next: repeat the mixed-file/first-page Windows-bind point in balanced blocks
with the same pinned runtime, fixtures, resources and raw timing/CPU/load facts.
Determine whether the broad 128 range repeats before attributing a cause or
changing a default. Four-concurrent-scan qualification remains necessary before
using this single-consumer result as evidence about aggregate memory; network
qualification stays deferred.

GitHub MCP found zero open repository PRs initially and at final review on
October 28, 2026. Random local PR implementation and stale Dependabot cleanup
or rebasing were inapplicable. All 13 changed files are included on main;
no PR is merged and no release is created.

## Reproduction

Create empty existing output and bind scratch directories first. Output files
are exclusive and must not already exist. The image must be immutable and its
five measured service/policy hashes must match the checkout. Example commands:

```text
node --test test/scripts/folder-profile.test.js test/scripts/folder-profile-buffers.test.js test/server/folder-browse-service.test.js
node scripts/measure-folder-browse.js --image sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60 --output .tmp/buffers-volume.json --storage volume --comparison buffers --cases small,large,mixed,ceiling --repeats 4
node scripts/measure-folder-browse.js --image sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60 --output .tmp/buffers-bind.json --storage bind --scratch-root .tmp/buffers-bind-scratch --comparison buffers --cases small,large,mixed,ceiling --repeats 4
```

Each consumer is UID 1000 with read-only root/fixture, no network/capabilities,
no-new-privileges, two CPUs, 1 GiB and no swap. Preparation and cleanup use root
only inside their UUID-owned mount. Actual container retirement precedes fixture
deletion; uncertain retirement preserves the fixture. Host paths/native failures
are excluded from reports; any failure retains a private local log.
