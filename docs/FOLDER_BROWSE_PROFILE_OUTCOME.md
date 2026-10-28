# Folder browsing measurement outcome

October 28, 2026. See [research](FOLDER_BROWSE_PROFILE_RESEARCH_2026_10.md) and
[design](FOLDER_BROWSE_PROFILE_DESIGN.md).

## Implemented result

An explicit ESM measurement CLI now delegates to seven focused modules for
policy/planning, owned fixtures, process/container observations, workload
verification, worker execution, Docker retirement and run orchestration. It
uses the unchanged packaged scanner and a lean full-readdir comparator. There
are no application, dependency, UI, database, schema or maintenance changes.
The benchmark is outside routine startup and test execution.

Immutable image and scanner/cursor/selector/API-error/shared-policy hashes must
match the checkout. Each measured process uses UID 1000, a read-only root and
fixture, no network/capabilities, no-new-privileges, two CPUs, 1 GiB memory and
zero swap. Preparation/cleanup uses root only for the owned scratch mount.
Exact container identity, actual stop/removal and ownership checks precede
fixture deletion. Failed or uncertain retirement retains the fixture. Reports
exclude host paths/native error text; failures retain a private local log.

## Final local observations

Both profiles used three fresh processes per algorithm/case/itinerary, with
alternating algorithm order, first-page/three-forward-page work and separate
sampling-off controls. Each profile completed 54 successful samples: 48 primary
samples and six controls. All 114 final-run containers, both fixtures and their
volume/bind scratch resources retired. No refusals, OOM kills or data/count
mismatches occurred. The source was frozen before these final measurements.

Cases were 1,000 directories, 10,000 directories, 1,000 directories plus 9,000
files, and exactly 50,000 directories. Case manifests stayed outside scanned
directories. Every returned page matched independently generated expected names;
successful stream reads matched raw entries plus EOF, with two stat calls and
one awaited open/close per page. Three ceiling pages therefore performed 150,003
caller-visible directory reads, not a claim about native syscall counts.

The table reports medians of three sampling-on samples. RSS rise means the
sampled maximum minus that process's baseline, in MiB (1,048,576 bytes), not
total RSS or an exact allocation peak. Time includes the itinerary's verification
and observer work. The comparator omits production metadata/cursor/admission
guards and is not a complete reconstruction of the historical application.

| Local storage | Directory count / pages | Stream ms | Full-readdir ms | Stream RSS rise MiB | Full-readdir RSS rise MiB |
| --- | --- | ---: | ---: | ---: | ---: |
| Engine-local volume | 10,000 / 1 | 60.24 | 16.97 | 8.77 | 1.05 |
| Engine-local volume | 10,000 / 3 | 153.66 | 46.97 | 9.62 | 10.13 |
| Engine-local volume | 50,000 / 1 | 237.44 | 78.40 | 8.73 | 16.34 |
| Engine-local volume | 50,000 / 3 | 599.53 | 233.74 | 10.13 | 21.28 |
| Windows C: bind through Docker Desktop | 10,000 / 1 | 89.32 | 35.48 | 10.41 | 1.13 |
| Windows C: bind through Docker Desktop | 10,000 / 3 | 276.35 | 98.81 | 9.66 | 10.24 |
| Windows C: bind through Docker Desktop | 50,000 / 1 | 362.84 | 169.30 | 8.64 | 16.29 |
| Windows C: bind through Docker Desktop | 50,000 / 3 | 1,040.61 | 413.09 | 10.07 | 21.45 |

The streaming implementation had a lower observed RSS rise at the ceiling, but
was slower than this comparator. Smaller cases did not consistently use less
RSS: at 1,000 directories/three pages the volume medians were 8.45 versus 0.53
MiB, and the bind medians were 8.39 versus 0.50 MiB. A bounded candidate array
does not imply universally lower process RSS.

For three ceiling pages, end-of-work heap differences were 1.53 versus 11.26 MiB
on the volume and 2.14 versus 11.26 MiB on the bind. Immediate after-GC differences
were 0.48 versus 4.67 MiB and 0.47 versus 4.67 MiB respectively. These snapshots
are not allocation totals or persistent-retention/leak tests. Entire-process
lifetime maximum RSS medians for that itinerary were 70.61/83.35 MiB (volume)
and 70.64/81.57 MiB (bind); they include startup and are separate from work-window
sampled rises. Do not add heap, external, ArrayBuffers, RSS or container counters.

Sampling-off three-page/10,000-directory medians were 157.04/47.81 ms on the
volume and 276.19/91.15 ms on the bind, versus 153.66/46.97 and 276.35/98.81 ms
with sampling. Direction and size vary; these controls do not establish an
unbiased overhead bound, and no correction was subtracted from the measurements.
Caches were not cleared. VM load-average ranges were 1.00–3.31 and 2.06–5.47;
equal container quotas do not eliminate host activity or cache effects.

## Verification and provenance

| Boundary | Result |
| --- | --- |
| Focused benchmark checks | 13 passed: option/plan bounds, counter versions, signed fields, sampling retirement, Error/null preservation, Promise identity, independent page checks and safe cleanup |
| Complete fast gate | 11,780 passed: server 6,469, client 4,595, scripts 716; zero failed, cancelled or skipped |
| Static/build | All 14 stages passed, including ESM, lint, copyright, schema/anchor/migration, image/topology, hygiene and build |
| Fresh packaged work | 108 successful final samples, exact page digests/read counts, zero live owned handles and 114 acknowledged container retirements |
| Container observations | Actual cgroup v1; current usage explicitly approximate; two CPUs/1 GiB/no swap verified through Docker inspection and kernel counters; no OOM kill increments |
| Existing runtime | Fresh inventory matches the original image and final local build: 1,063 server, 14 shared, 157 client files, 110 dependency packages and 151 OS packages; no differences |
| Walkthrough | Healthy, same image and five mounts, read-only loopback deployment; no redeployment or application mutations |
| Retained qualification | Exact unchanged source/test/runtime supports 157 historical native groups and 13 browser tests; zero fresh historical native groups/browser tests are claimed |

Final source: 3,880 files, SHA-256
`d21670403a8d5c64c44ce2655e37a49ac9419a83da83579a0dce80a7cfe7bc3a`.
Nine code files were frozen before final measurement and the complete gate.
The private fast runner executes the 14 validate:fast stages with server
concurrency eight. Raw/summary records and cleanup/runtime receipts are under
`.tmp/folder-browse-profile-2026-10-28/qualified/`; these ignored artifacts do
not expose machine paths through Git.

An initial preflight assumed cgroup v2 and failed on this host's v1 layout; its
container retired. Both versions are now supported/tested. Review also removed
an avoidable Promise from every read/stat observer, with a Promise-identity
regression check. Both complete local profiles were rerun after that correction;
earlier records remain separate and do not supply the final numbers above.

The unchanged image is
`sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60`.
The existing walkthrough remains healthy at http://127.0.0.1:47956. No new image,
application service, branch, release or tag was created for this change.

## Reproduction

Prepare an empty existing scratch/output directory first. The CLI refuses to
overwrite output files. Use the pinned local image above or another immutable
image whose measured module hashes match the checkout. Example commands:

```text
node --test test/scripts/folder-profile.test.js
node scripts/measure-folder-browse.js --image sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60 --output .tmp/profile-volume.json --storage volume --cases small,large,mixed,ceiling --repeats 3
node scripts/measure-folder-browse.js --image sha256:7009c6d3335b1b6a74c504acb4a2d1761bc7ab6c33c231b24264f5b0dff28f60 --output .tmp/profile-bind.json --storage bind --scratch-root .tmp/profile-bind-scratch --cases small,large,mixed,ceiling --repeats 3
```

## Recommendations and next item

Keep the production defaults: 100-folder pages, bufferSize 32, 50,000 raw-entry
ceiling, four active scans and a cooperative five-second per-scan budget. The
benefit is bounded work/candidate retention and lower observed ceiling RSS rise;
the cost is repeated scanning, Promise/iteration work and greater elapsed time
than this lean comparator. These data do not justify unbounded readdir, retained
directory handles, relaxed deadlines or a minimum whole-application RAM claim.

The final stack remains the guarded built-in scanner plus explicit stateless
pages, an opt-in fresh-process measurement lane, independent source/data/resource
checks and separately reported memory scopes. Full research records alternatives
and pros/cons. A three-page single-consumer experiment does not qualify full walks,
four concurrent scans, actual HTTP response latency or production-wide memory.

Next: compare bounded opendir buffer sizes 32 and 128 using this same method,
while preserving page/scan/admission limits, metadata fences and actual close
ownership. Measure the memory/elapsed tradeoff before changing a default. Real
network storage remains deferred at the user's explicit request and is not
represented by the Windows bind profile.

GitHub MCP found zero open repository PRs initially and at final review on
October 28, 2026. Random local PR implementation and stale Dependabot cleanup or
rebasing were inapplicable. All 15 changed files are included on main; no PR is merged.
