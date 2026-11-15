# Persistent folder browse retention outcome

Completed locally November 14, 2026 on main, following the
[research](FOLDER_RETENTION_RESEARCH_2026_11.md), [design](FOLDER_RETENTION_DESIGN.md)
and [Astra review](FOLDER_RETENTION_ASTRA_REVIEW.md). The existing built-in service
now has an opt-in persistent qualification lane. Production service, admission,
buffer and GC policy are unchanged. No release or deployment was performed.

## Corrected-source native evidence

The immutable qualified image is
`sha256:fda139f38a81a4af9a2b49a6c4521b75aecca279efb9f72c76936a995be49d98`,
with Node 24.22.3 and production buffer 128. The existing probe compares all five
folder boundary source hashes with current source before fixture creation.
Each consumer actually applies two CPUs, 1 GiB, no swap, read-only root/fixture,
UID 1000, network isolation, dropped capabilities and no-new-privileges.

Docker-volume and local Windows-bind profiles each ran natural-GC and separately
labelled forced-GC workers. Every worker retained one service for all fifteen
cycles: three warm-up and twelve measured. Across the four workers this verifies
480 admissions and successful native closes, 360 complete independent page
publications, 120 aborts, 180 no-I/O busy refusals and 21,000,480 caller-visible
reads. Every idle checkpoint reports zero owned directory handles and a total
descriptor count of 19. No OOM counter increased.

Supplementary resource histograms contain only PipeWrap types, initially one and
then two as output initializes; they do not establish a complete descriptor census.
The corrected final yield removes the observer's FSReqPromise from both modes.
An earlier successful volume run predates the observation/protocol corrections
and is retained as exploratory evidence only.

Changes below compare the checkpoint after warm-up with the final checkpoint;
units are MiB (1,048,576 bytes). Each row also retains its full chronological
values and ranges in the private raw report.

| Storage / mode | Idle RSS change | Idle heap-used change | External / ArrayBuffer endpoint change |
| --- | ---: | ---: | ---: |
| Docker volume, natural GC | +19.82 MiB | +1.26 MiB | 0 / 0 bytes |
| Docker volume, forced-GC diagnostic | +13.60 MiB | +0.147 MiB | 0 / 0 bytes |
| Windows bind, natural GC | +16.37 MiB | +12.57 MiB | 0 / 0 bytes |
| Windows bind, forced-GC diagnostic | +16.07 MiB | +0.141 MiB | 0 / 0 bytes |

Natural heap fluctuates with GC timing; small post-GC growth includes bounded
harness records. RSS and heap capacity still increase. These observations neither
demonstrate a leak-free plateau nor identify a native allocator defect. Container
current/lifetime peak remain separate fields and are not added to RSS. Timings
are contextual observations under a shared Docker host, not a speed comparison.
No automatic pass threshold for a memory slope, forced production GC, new service
or speculative cache cap was introduced.

## Failure and test evidence

An actual native cancellation control aborted the attached worker after four
seconds. The live controller retained three complete cycles and four chronological
checkpoints, classified the result as incomplete, preserved AbortError and then
killed/waited/inspected/removed the worker before fixture cleanup. This proves
partial reporting across child cancellation, not crash-safe controller persistence
or interruption latency for blocked kernel I/O.

The focused folder/profile cohort passes 53 tests. Meaningful controls cover one
factory across cycles, complete four-slot reuse, no-I/O busy refusal, real close
settlement, early stat/open/synchronous and asynchronous read failure, controlled
deadline, rejected-close uncertainty, Error/null preservation, equal observation
ordering, acknowledged output sinks and malformed/partial protocol evidence.

One stable full gate passes all 11,824 tests: 6,471 server, 4,595 client and 758
script/policy tests; none failed, skipped or were canceled. Baseline, copyright,
migration/schema/anchor, ESM, image/topology, lint, test-hygiene and build checks
also pass. Fresh npm audit reports zero production findings and nine moderate
development findings, with zero high/critical; the existing dev-tool dependency
work remains separate.

All production source, root package/lock, Docker/runtime pins, migrations and
client boundaries match `bec1e5f7aabc3a1459af4e1afb084e820b8bdf86`. The current
immutable image identity is unchanged. This supports retention of that commit's
unrelated SQL/browser/provider/media qualification; those suites were not
re-executed for development-harness and workflow-pin changes.

The frozen qualification source contains 3,897 files, SHA-256
`62b8c60a85a3d24d9844bac79095b446b0874d06bd4dc076e87406b0f5564d7e`.
The eleven-file code/configuration manifest matches before and after native work.
Raw reports, partial/failure evidence, manifests, synthetic action bundle/recipes
and cleanup receipts remain ignored under `.tmp/folder-retention-2026-11-14/`.

## PR and workspace outcome

[Random PR 66](PR_66_LOGIN_ACTION_OUTCOME.md) contributes nine reviewed Docker
login action pin updates, tested through ten actual-bundle synthetic main/post
cases. The PR is not merged; no real credential or release workflow was used.
Other Dependabot PRs remain separate from this implementation. Rebase requests
and observed remote head states are reported at handoff, without equating a bot
request with a completed rebase.

All 22 task-owned containers retired, including failed synthetic replay attempts.
Four synthetic fixture profiles were removed after verified process retirement;
the bind scratch parent is empty. No images were built or added. The stopped
walkthrough retains its exact container/image, timestamps, ports and five mounts;
current qualification/media/rollback image IDs still resolve. Shared services,
data volumes and builder cache were not pruned or restarted. The existing
[workspace hygiene skill](../.agents/skills/harmoniarr-workspace-hygiene/SKILL.md)
continues to govern routine maintenance; this work adds no cleanup daemon.

## Recommendation and next item

Keep the built-in modular ESM service at buffer 128 with four admissions, bounded
pages/raw scans, cooperative deadlines and awaited native close. Add the new
fixed persistent natural-GC lane to explicit local qualification, with forced GC
as a separate diagnostic and bounded partial evidence on failure.

Benefits are reproducible lifetime/capacity evidence and honest memory accounting.
Costs are a 50,000-directory fixture, four disposable measurement workers across
two storage profiles and a finite sample that leaves RSS growth unexplained.
The final stack is the existing pinned runtime, unchanged production service,
one persistent owner per worker, two cancellation controls, full-capacity recovery,
idle descriptor/memory observations and exact owned-resource cleanup.

**Next memory item:** a longer fixed-block natural-GC soak with an idle-only
observer/control workload and post-load settling checkpoints. Separate V8 heap
capacity growth and harness bookkeeping from application retention before choosing
any production memory-management change. Escalate to isolated allocation/retainer
diagnostics only if sustained unexplained growth remains. Network/NAS, physical
assistive checks, hosted CI, real registries/providers and arm64 remain deferred.
