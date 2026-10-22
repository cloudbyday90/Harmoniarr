# Artwork process worker design

Decision date: October 22, 2026. This implements the next item from the
[ingestion outcome](ARTWORK_INGESTION_BUDGET_OUTCOME.md). See the separate
[research](ARTWORK_WORKER_RESEARCH.md) and [qualification outcome](ARTWORK_WORKER_OUTCOME.md).

## Ownership and flow

Keep the shared two-active ingestion gate, bounded waiting and same-handle file
reads. After admission and byte-policy validation, start one short-lived Node ESM
child for inspection, rewrite and best-effort dominant-color statistics. Give it
only image bytes and numeric byte/dimension limits. The child imports no repository,
policy store, auth service or publication code. The parent owns content hashes,
paths, source metadata, filesystem writes and asset publication.

Use an explicit executable/module argument vector, no shell, no inherited Node
flags/preloads and a minimal environment. Keep stderr discarded and protocol
errors fixed. Restrict libvips to one image thread and disable its operation cache
inside the disposable child only. These are resource reductions, not RSS limits.

The binary stream protocol has a bounded JSON header and at most 100 MiB rewritten
image bytes, independent of the saved input limit. Validate dimensions, format,
length and projected color fields before accepting output. Oversized rewritten
images are refused; this is a new output policy. Never deserialize arbitrary IPC
objects or retain unbounded stdout/stderr. No temporary image files are required.

A 15-second parent deadline includes spawn, input transfer, processing and output
drain. On deadline or active cancellation, mark the result unusable, destroy input,
send SIGKILL and discard further output. Retain the ingestion permit until actual
child/stdio `close`; `kill()` success and `exit` alone are insufficient. Reject
late success and nonzero/signal exits. The parent starts no filesystem/repository
publication until a validated successful close. Cancellation after processing
has completed does not roll back publication already started.

The deadline invalidates a result; it is not a guaranteed completion time when
the OS cannot terminate/reap a process. In that case ownership stays held and
queued work expires rather than admitting additional native jobs.

## Security scope

A child separates native crashes/hangs from the server's JavaScript execution and
allows external termination. It shares the application's OS user and container;
it is not a hostile-code sandbox or per-child memory control group. The existing
container memory limit covers parent plus all children and can kill the app under
aggregate pressure. Node heap flags do not cap native buffers. Do not expose the
Docker socket to the app. Stronger independent memory/filesystem/network isolation
requires a separately constrained worker deployment and its own delivery design.

## Qualification plan

Fast tests cover bounded framing, spawn/stream failures, deadline and cancellation,
late output, close-before-release and no publication after failed termination.
Native tests use actual ESM children and Sharp, including full byte/pixel settings,
first-excess-byte/pixel refusal, a child blocked synchronously and a child held
after returning valid output. Run expensive maximum cases in an explicit isolated
Linux container with OS-enforced memory/CPU/PID limits. Retain observed failures
and distinguish refusal, parent survival, process retirement and measured memory.
No fixture claims that a simulated hang reproduces a libvips defect.

No SQL, UI, release, tag or dependency change is planned. Continue on `main`.
