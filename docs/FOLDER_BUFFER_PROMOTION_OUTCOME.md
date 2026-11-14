# Folder buffer promotion outcome

Follow-up November 14: [Node 24.22.3 qualification](NODE_SECURITY_2026_11_OUTCOME.md)
completes the runtime-security next item below. This document's 24.22.1 timings
remain historical. Next component work is persistent browse/cancel memory
retention; no deployment has been performed.

November 14, 2026. See [official research and tradeoffs](FOLDER_BUFFER_PROMOTION_RESEARCH_2026_11.md),
[design](FOLDER_BUFFER_PROMOTION_DESIGN.md) and [Astra review](FOLDER_BUFFER_PROMOTION_ASTRA_REVIEW.md).

## Implemented result

The built-in service now uses a local fixed buffer of 128. Page 100, raw ceiling
50,000, four admissions, five-second cooperative checkpoints, exact-name signed
cursors, metadata fencing and sanitized errors remain the governing contract.
Admission stays held through close settlement; successful close establishes
retirement, while rejected close alone does not. No lifecycle redesign or user
buffer setting is introduced.

Astra identified long/Unicode identity and packaged dependency coverage as the
main gaps. Small ESM modules now own byte-bounded names, bounded independent
expected pages and production-option checks. The 32/128 comparison remains
independent. Reports label the default algorithm lane's stream/32 as historical.

Random selection chose [Dependabot PR #61](https://github.com/cloudbyday90/Harmoniarr/pull/61).
Its exact package/lock delta was applied locally: music-metadata 12.2.3 to 12.3.2,
head `536deb8bc98ce00cd6e283b5e150505348c68d0e`, base
`56adac10d7b699ece083bb92607f29b5db06f86b`. Published archive integrity matches
the lock entry; transitive declarations are unchanged. Published runtime review
identified 60 changed library/declaration files. This is the selected PR version,
not the latest upstream release. The PR is not merged.

## Native measurements

Volume and Windows C: bind profiles each completed 16 fresh-process groups of four
simultaneous scans through one service/process. All 128 measured scans succeeded.
Each group verified 50,000 directories, exact first-page names/digests, 200,004
reads, eight stats and four successful closes; peak handles were four and final
live handles zero. There were no timed refusals, OOM kills or quota-throttling
increments. Components are 254–255 UTF-8 bytes: long common prefixes, ASCII,
NFC/NFD pairs and supplementary characters. Expected pages retain at most 100
names. Valid Unicode tests do not establish arbitrary non-UTF-8 POSIX support.

Each row contains four observations per variant. Group timing includes factory
setup and verification. Paired changes are calculated per adjacent pair before
taking their median, rather than from the ratio of pooled medians.

| Storage / observer | Buffer 32 ms min / median / max | Buffer 128 ms min / median / max | Median paired change | Faster 128 pairs |
| --- | ---: | ---: | ---: | ---: |
| Volume / sampling on | 535.66 / 551.79 / 596.82 | 369.76 / 395.39 / 456.57 | -28.33% | 4 / 4 |
| Volume / sampling off | 544.41 / 545.95 / 548.46 | 360.09 / 365.82 / 411.38 | -33.05% | 4 / 4 |
| Windows bind / sampling on | 1311.57 / 1606.67 / 1741.55 | 1273.94 / 1376.06 / 1583.01 | -7.79% | 4 / 4 |
| Windows bind / sampling off | 1313.42 / 1593.56 / 1765.52 | 1241.58 / 1426.40 / 1779.44 | -5.14% | 2 / 4 |

Two sampling-off bind pairs were slower at 128, with a maximum +15.18% change;
they remain in the evidence. Those changes ranged from -24.39% to +15.18%, and
sampled bind changes from -21.40% to -2.87%. These are descriptive observations,
not significance, causation or universal-speedup claims. Median CPU for 32/128
was 911.30/695.79 ms on sampled volume, 899.02/652.75 ms without sampling;
bind was 1119.76/890.65 ms sampled and 1086.94/903.30 ms without. CPU spans cores.

| Sampled profile | Buffer 32 / 128 RSS median MiB | Buffer 32 / 128 RSS-rise median MiB | Buffer 32 / 128 container lifetime-peak median MiB |
| --- | ---: | ---: | ---: |
| Volume | 74.06 / 74.47 | 13.81 / 13.30 | 24.39 / 24.88 |
| Windows bind | 74.43 / 70.20 | 12.46 / 9.94 | 24.24 / 20.60 |

Maximum observed process RSS was 76.01 MiB; container lifetime charges reached
26.67 MiB on volume and 24.60 MiB on bind. Actual cgroup v1 current usage is
labeled approximate. RSS and container charges have different shared/cache
accounting and must not be added. Lifetime peaks include startup; sampling-off
RSS has boundary coverage only. Immediate after-GC heap-rise medians were
0.22–0.25 MiB. These snapshots establish no leak bound, memory equivalence or
whole-app minimum. VM one-minute load ranged from 0.69–0.84 on volume and
2.45–2.78 on bind. Caches were not cleared; profiles ran serially after the gate.

## Guard and parser evidence

Both profiles passed production/128 paging over 203 exact unique names: three
forward pages, two reverse pages, preserved NFC/NFD forms, Unicode anchors and
exact paths, excluding an ordinary file. Actor-bound/tampered cursors refused
without another directory open. Native file/missing-path failures were sanitized;
controlled metadata change and controlled-clock expiry exercised checkpoints
over real native reads.

Four lifecycle groups produced eight fifth-call refusals without extra I/O,
eight read/late-close aborts without publication and 12 successful control/resume
scans. All admitted handles closed. Held delivery establishes cooperative
ownership rather than interruption of blocked kernel I/O. After preceding
consumers retired, one ordinary file was added to each ceiling fixture; fresh
read-only consumers refused actual 50,001-entry scans without partial results.
Each complete profile retired 24 containers and its fixture. Default compatibility
passed four samples and retired seven containers plus its volume.

The guarded packaged parser suite passed on 12.3.2 with tokenizer 10.6.2. Actual
FLAC, MP3, Opus, WAV and M4A parsing preserved source hashes, tags and audio facts.
Unsupported bytes failed; header-only FLAC retained its extracted-without-audio-
facts classification. A real embedded FLAC PNG passed through the production
parser and default cover selector with exact cover/source bytes. Snapshot,
ingestion and assignment writers were controlled, so no SQL persistence is
claimed. Other parser formats/adversarial corpora were not exhaustively qualified.

## Package, validation and hygiene

Local image:
`sha256:b7cf0e500878b7fa8bd78796c9c30f328bee005a5c94d546b257e205a117d9bb`,
Node 24.22.1/npm 12.0.2. Complete inventories verify one changed server module,
217 exact published parser files, six preserved nested content-type files,
consistent root/installed-lock metadata and preserved root ownership/modes.
All 110 packages remain, with only music-metadata's version changed. The 151 OS
packages, Node binary, 14 shared files and 157 client files match the baseline;
the rebuilt client matches the image. Obsolete vendor files are absent.

Artifact review caught a missing nested dependency and checked program ownership
and installed-lock consistency before native qualification. Three intermediate
images were retired; compact intermediate evidence remains. One current
qualification image and the stopped walkthrough image are preserved.

All 14 fast-gate stages passed: 11,807 tests (server 6,469, client 4,595, scripts
743), zero failed/cancelled/skipped, plus lint, ESM, copyright, schema/migration/
anchor, image/topology, hygiene and both builds. Focused evidence includes 51
folder/profile tests and nine parser-consumer tests. An initial new-test teardown
error was corrected to remove empty parents safely while preserving original
failures; final checks passed and the two empty leftovers were removed.

Frozen source: 3,892 files, SHA-256
`3089653e21072a5ecfe054df6b85eedf134b050ac923ddd42e69e1ec3839c6b2`.
All 19 changed code/package files and the whole source fingerprint match after
native work. Raw reports, complete plans, vendor review, inventories and retirement
receipts remain ignored under `.tmp/folder-buffer-promotion-2026-11-14/`.
Historical groups remain provenance; old parser qualification is refreshed here.
No whole-runtime unchanged claim or fresh execution of all 157 historical groups
is made.

Folder consumers used inspected two-CPU/1-GiB/no-swap limits; the parser used
its separate two-CPU/2-GiB disposable tmpfs profile. Consumers retained UID 1000,
read-only roots/fixtures, network none, dropped capabilities and no-new-privileges.
Root writes stayed in owned fixture preparation/seeding/removal. The walkthrough's
stopped state, original image and five private mounts are preserved. No permanent
service, deployment, release, registry push or shared prune was introduced.

## Recommendation and next item

Adopt fixed 128 in source and retain the local package for validation. Benefits are lower
local median CPU/elapsed work and preserved native identity/resource controls.
Costs are larger internal buffers, qualification work and smaller/variable
Windows-bind latency benefits. The two slower pairs and sampling limits preclude
a universal performance or memory-equivalence claim.

Final stack: built-in 128; bounded page/raw scan; four admissions; cooperative
deadline; exact-name cursors; close settlement before publication/release;
independent comparison variants; reviewed parser bytes and real consumers;
immutable package inventories and scoped cleanup. Avoid adaptive/user buffer
configuration without new evidence.

Next, before rollout: coordinate Node 24.22.3 security-patch qualification across
toolchain, image digest, baseline guards and affected native consumers. Final
research discovered its November 11 security release; this 24.22.1 artifact is
validation-only and is not presented as fully security-current.
[Official release](https://nodejs.org/en/blog/release/v24.22.3).

After that, qualify repeated browse/cancel cycles on one persistent service,
checking idle handles, capacity reuse and memory retention. Single-group and
immediate-GC observations do not establish a long-running plateau. Network/NAS
and manual assistive checks remain deferred by the user.

## Reproduction

Use pinned Node 24.22.1 and the matching image. Create output/scratch parents
first; report files are exclusive and retain their actual randomized plan.

```text
node scripts/measure-folder-browse.js --image sha256:b7cf0e500878b7fa8bd78796c9c30f328bee005a5c94d546b257e205a117d9bb --output .tmp/promotion-volume.json --storage volume --experiment concurrent-ceiling --cases long-ceiling
node scripts/measure-folder-browse.js --image sha256:b7cf0e500878b7fa8bd78796c9c30f328bee005a5c94d546b257e205a117d9bb --output .tmp/promotion-bind.json --storage bind --scratch-root .tmp/promotion-scratch --experiment concurrent-ceiling --cases long-ceiling
```
