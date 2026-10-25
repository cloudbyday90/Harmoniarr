# Selected WebP mixed-workload outcome

October 25, 2026. Completes the next step from the
[selection outcome](WEBP_OUTPUT_SELECTION_OUTCOME.md). See separate
[design](WEBP_SELECTION_MIXED_MEMORY_DESIGN.md),
[official research/tradeoffs](WEBP_SELECTION_MIXED_MEMORY_RESEARCH.md) and
[no-cache Docker outcome](LOCAL_DOCKER_WEBP_SELECTION_MIXED_MEMORY_OUTCOME.md).

## Decision and implementation

Keep the enabled selector, full initial reservation, shared rewrite budget and
actual-close/publication fences. All four pinned inputs publish correctly while
the existing controlled review/media workload runs. These finite observations
support the current policy; they do not establish an allocator/RSS ceiling or
justify lower reservations, greater concurrency or broader eligibility.

Small ESM fixture modules own pinned-case verification, native observation and
publication/cancellation orchestration. Optional seams reuse the existing app,
HTTP/SQL/media workload and publication owner. Production modules are unchanged.
The new `validate:native-deployment-review-webp-selection` command remains opt-in;
five cheap focused tests were added to the ordinary server lane.

A test-only preload samples Sharp's active task count every 1 ms and emits one
fixed stderr marker. The parent observes a pipe only in this fixture; production
normally ignores stderr. The actual production worker still owns native limits,
cache/concurrency settings, transforms and stdout protocol. Each first marker was
observed while scan and FFmpeg encoder lifetimes overlapped. Instrumentation and
fixture setup contribute to resource/timing observations; marker sampling is not
proof of uninterrupted CPU work or whole-response/whole-encode overlap.

## Fresh guarded results

Each selected publication/cancellation profile used a fresh 2 or 3 GiB container,
two CPUs, no swap, 256 PIDs, read-only root/source/input mounts and tmpfs app/
PostgreSQL data. It included a retained 256 MiB caller buffer, two real held
100,000-row PostgreSQL sort statements, 64-file scan/tagging, four inspections and
a 120-second audio preflight encoded to null output. Every original media byte
was preserved; no converted media file was created.

| Input / mode | Published encoding / bytes | 2 GiB kernel lifetime peak | 3 GiB kernel lifetime peak |
| --- | --- | --- | --- |
| photo-earth / publish | Lossy / 150,382 | 761,888,768 | 773,894,144 |
| painting-cypresses / publish | Lossy / 143,482 | 744,488,960 | 745,422,848 |
| cover-type / publish | Lossless / 538 | 729,366,528 | 737,251,328 |
| cover-gradient / publish | Lossless / 5,232 | 753,000,448 | 753,799,168 |
| cover-gradient / cancel | None | 716,165,120 | 718,131,200 |

Publication held 1,350,566,688–1,351,406,432 reserved bytes after the first child
closed and before releasing its lookup. The second job remained queued with no
second child. Both jobs then completed normally, yielding two real assignments
and exactly one deduplicated asset row/file. Selected/source hashes, metadata
removal and every decoded RGB8 graphic sample matched the pinned expectations.

Cancellation began at an actual active-task marker. All 1,350,571,400 reserved
bytes remained held immediately after abort and at the child's close event.
The child retired with SIGKILL. The sibling observed cancellation without
launching another child; both ingestions returned owned cancellation errors.
There was no publication lookup, assignment, asset row or file. Final active,
queued and reserved states were zero in every selected profile.

Each mixed profile completed 11 actual authenticated review operations, including
checking → queued, three owned qualification worker steps, one intent/audit and
one released qualification lease. At least one completed detail response
overlapped scan/encoder lifetimes. All three media runs completed and released
their leases; native PIDs were gone. The largest individual measured operation
in each selected profile ranged from 239.7 to 382.5 ms. These are host-specific
samples, not a latency SLO or causal estimate of selection overhead.

All available kernel event counters stayed unchanged. This host exposed cgroup
v1 approximate current usage and a kernel lifetime peak; unavailable v2-style
OOM event fields remain null. Peaks include startup, setup, PostgreSQL, native
tasks, worker statistics and pixel verification. They are neither minimum
deployment requirements nor values to add to logical reservations/process RSS.

## Validation and retention

- 34 focused observer, case, admission, memory and lifecycle checks passed.
- One stable fast gate passed 11,178 tests: 5,998 server, 4,480 client and 700
  scripts, plus required lint, ESM, copyright, schema/migration, topology, hygiene
  and client/server builds.
- The final rebuilt image passed 15 native tests in 13 containers: ten selected
  profiles, two baseline mixed profiles and three baseline memory cases. The
  three memory cases share one fresh 3 GiB container, so its lifetime peak also
  includes preceding cases. Baseline mixed peaks were 1,543,008,256 bytes at
  2 GiB and 1,540,005,888 bytes at 3 GiB; both completed normally.

Retained unchanged evidence comprises 28 direct artwork native tests (nine
selection and 19 worker/corpus/canvas), 42 SQL and nine browser checks, plus the
controlled-provider/file-backed chains. These are not fresh executions. Production
source, direct drivers and packaged runtime/dependencies match; changed common
mixed-fixture seams were exercised by fresh baseline controls. The previous six
mixed boundary profiles are historical evidence, not a fresh or unchanged-driver
qualification claim for this harness revision. No new rendered UI, screen-reader
or physical-device acceptance is claimed; deferred human checks remain pending.

Two development preflights passed before the stable gate. An earlier preflight
failed because its observer tried to read the production worker's ignored stderr
after spawn, leaving an unmanaged fixture child. That owned container required
forced retirement. The adapter now validates stdio before launch and explicitly
observes stderr; unit/native checks cover that setup. The failed log is retained
and excluded from passing counts. All 13 final and three development containers,
plus builder/bootstrap/inventory/identity helpers, were retired and absence checked.

Private reproducible evidence lives in `.tmp/webp-selection-mixed-2026-10-25/`.
The stable 3,505-file source fingerprint is
`3b8979ef33bafaab1af531a2f3b10e160a26c2fe055f9fe2c33d777918818a9c`.
No code changed after the gate or image build. GitHub MCP searches at start/final
review found no open PRs, so local PR implementation/rebase/cleanup was inapplicable.
All project changes stay on main and are committed/pushed without a release.

## Next recommendation

Add a bounded read-only artwork-admission projection to the existing administrator
runtime diagnostics. The gate already owns active/queued/input-byte and logical
reservation/budget counters, while runtime monitoring currently reports process
memory. Present those meanings separately, with fixed fields and no source paths,
payloads, peer details or unbounded history. Reuse current authorization and
monitoring; do not add a service or automatic tuning. This would make capacity
refusal and the difference between reserved capacity and observed memory visible
before considering any concurrency/reservation adjustment. Rendered status changes
must follow the W3C status-message guidance in the research document.
