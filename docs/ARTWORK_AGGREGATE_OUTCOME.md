# Aggregate artwork reservation outcome

Completed October 22, 2026 on `main`, following the next item in the
[corpus outcome](ARTWORK_CORPUS_OUTCOME.md). See the separate
[design](ARTWORK_AGGREGATE_DESIGN.md), [official research and tradeoffs](ARTWORK_AGGREGATE_RESEARCH.md)
and [local Docker outcome](LOCAL_DOCKER_ARTWORK_AGGREGATE_OUTCOME.md).

## Delivered behavior

The existing ingestion FIFO now owns a **2 GiB logical active reservation budget**
as well as its existing active-count, waiting-byte and queue-deadline limits.
Buffer intake reserves before preparation; file intake reserves before reading.
The conservative initial allowance includes child work, parent input and two
parent output copies. Native metadata can only reduce the original reservation.
This avoids deadlocking two baseline holders that both need an increase.

A bounded metadata/grant exchange uses the existing child stdin/stdout. Only the
approved six-field metadata projection crosses the boundary. The parent validates
it, synchronously reduces the task's weight, rechecks cancellation/deadline and
grants rewriting. The child requires exact grant bytes plus EOF. Positive output
must match the metadata and existing byte limits, exit successfully and actually
close before publication. Async/throwing owners, malformed frames and expired
grants withhold permission and retain retirement ownership.

The remaining reservation stays held through file/repository publication even
after the child closes. Waiting-head cancellation/expiry immediately pumps the
FIFO; active cancellation does not release a live original task's reservation.
Generic unweighted callers retain their task arguments and state shape. Memory
counters are exposed separately through `getMemoryState()`.

The policy is implemented in small ESM modules for reservation arithmetic,
parent protocol collection and child session handling. The app keeps its existing
deployment and child-per-job model. No additional deployed service, queue,
privileged cgroup writer, dependency, migration, UI setting or HTTP endpoint was
introduced. No version bump, release or tag is part of this change.

## Executed validation

The final code was frozen before the full fast gate and image qualification:
18 changed/new JavaScript files; 3,332 source files with fingerprint
`e9dc4b6e496220bfee211320053bb54cd11f083b738cff3e2c54a53db5a14a99`.
Subsequent documentation edits do not alter that source cohort. Client artifacts
are unchanged. All counts below overlap and must not be added as unique tests.

| Check | Result and scope |
| --- | --- |
| Focused server checks | **38 passed**; both ingestion and fetch callers, reservation reductions, FIFO fairness, cancellation/expiry, retained publication, Error/null, exact grants/EOF, malformed metadata, async/throwing ownership and deadline refusal |
| `npm run validate:fast` | **10,971 passed**: 5,804 server, 4,470 client, 697 scripts; static checks, lint, hygiene and client build passed; zero skipped/cancelled/failing tests |
| Final Linux server cohort | **111 passed** on the rebuilt image; network disabled, read-only, UID 1000, one CPU, 256 MiB |
| Native lifecycle lane | **7 passed** on the rebuilt image; one CPU, 1 GiB; includes real post-grant native-active cancellation and close/publication fences |
| Native memory lane | **4 passed** on the rebuilt image; two CPUs, 3 GiB; allocation refusal, paired maximum-byte control, combined-limit refusal and default-budget maximum-pixel serialization |
| Native sample-depth/entropy corpus | **7 passed** on the rebuilt image; existing hashes, 8/16-bit native metadata, content refusal and publication ownership retained |
| Packaged default-ingestion probe | Passed with parent native loaders blocked, actual packaged child, minimal environment, approved output hash, actual close and pre-cancelled no-spawn behavior |

The native and memory lanes also passed against the preceding immutable image
with the final source mounted before the no-cache rebuild. Final qualification
used image `sha256:380e8269d6cdfa651d0cd31ccebbe5b2907d072ec139fadf6e8f3e8c587b68b1`.
Disposable qualification containers and the owned builder were removed and their
absence checked. Existing unrelated Vue `onScopeDispose` warnings remain in the
passing client log. No SQL changed; a full PostgreSQL matrix was not repeated.

### Native observations and limits

Two real 8192-by-8192 JPEG jobs under the default budget reached at most **one
concurrent child**. The first child retired while its publication was deliberately
held; the second job remained queued. Releasing publication allowed the second
job to proceed. Both exact hashes matched, two publications completed and the
final reserved count was **zero**. The test container's OOM-kill counter did not
increase.

The paired 100 MiB compatibility control explicitly uses a **3 GiB logical
reservation budget**, matching its test-container profile. Two children overlapped
and retained exact hashes under their individual 1 GiB DATA limits. This is not
evidence of parallel maximum-byte throughput under the default 2 GiB budget. Its
1,048,690,688-byte cgroup peak covers the whole qualification container, including
fixture generation and the preceding allocation control, not only those children.

The actual allocation control refused further buffers after 989,855,744 allocated
bytes and prevented publication; parent survival and unchanged OOM-kill counters
were checked. Combined maximum original bytes/pixels still returned the owned
`artwork_worker_memory` capacity refusal before publication. The native corpus
retained its expected output hashes and zero OOM kills; its container peak is a
whole-container observation, not a per-image bound.

The 2 GiB policy is an accounting model, **not allocated RAM, an RSS ceiling or a
kernel reservation**. Caller-owned buffers, other app work, PostgreSQL, native
metadata compromise and allocator/GC retention remain outside its guarantee.
Keep the real per-child DATA limit and deployment memory controls. Conservative
initial allowances can serialize otherwise small work; buffers too large for the
existing 32 MiB waiting budget receive temporary capacity failure.

## Skills, PR selection and recommendation

The project web-standards skill now routes aggregate reservation work to a
dedicated [reference](../.agents/skills/harmoniarr-web-standards/references/aggregate-reservations.md).
The validation skill includes both shared admission callers, native cancellation
after grant and held-publication evidence. Scenario review covered an increase
deadlock, blocked-head cancellation, late reduction, high-bit grant bytes, async
ownership, post-metadata cancellation and misleading larger-budget throughput.
Both skill manifests passed the skill-creator quick validator.

GitHub MCP found **no open PRs** at selection and again before publication on
October 22. There was no applicable random PR to implement locally or stale open
PR to rebase/close. No PR was merged.

Recommended stack: the existing FIFO owns count, waiting bytes and active weight;
reserve before intake; use the minimal limited child for native metadata; validate
and reduce; grant exact bytes/EOF; bound native work/results; wait for actual close;
publish; release. The [research document](ARTWORK_AGGREGATE_RESEARCH.md) records the
alternatives and their pros/cons.

The [deployment memory follow-up](DEPLOYMENT_MEMORY_OUTCOME.md) now qualifies
selected parent/provider/PostgreSQL workloads in fresh 2/3 GiB containers.
**Next item:** add actual concurrent scanning and media inspection/transcoding to
that envelope before exposing operator configuration. Keep the existing app;
do not infer whole-app protection from the logical artwork counter or reduce the
child limit from moderate-image peaks.
