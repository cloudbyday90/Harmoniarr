# Staged artwork memory reservations

Decision date: October 22, 2026. Implements the next item from the
[corpus outcome](ARTWORK_CORPUS_OUTCOME.md). See separate
[research/tradeoffs](ARTWORK_AGGREGATE_RESEARCH.md) and
[executed outcome](ARTWORK_AGGREGATE_OUTCOME.md).

## One admission owner

Extend the existing FIFO in `work-admission.js` with an optional active-weight
ceiling and a task-owned reduction capability. Unweighted callers retain their
existing task arguments/state shape. Artwork's existing ingestion admission uses
a **2 GiB active reservation budget**, alongside the existing two active jobs,
four waiters, 32 MiB waiting buffers and 15-second queue deadline. No second queue,
worker daemon, HTTP API, deployment service or privileged cgroup writer is added.

`artwork-memory-reservation.js` owns the pure artwork accounting policy.
`getMemoryState()` exposes budget/reserved counters separately from the legacy
job/queue counters. Buffer intake reserves before policy/preparation; file intake
reserves before policy and bounded file reading. Waiting buffers already exist in
the caller, so the existing waiting-byte limit remains independently necessary.

## Reserve first, only reduce

A baseline-then-upgrade approach can deadlock when two admitted children retain
their baselines and neither can acquire its decoded-work increment. Instead,
reserve a conservative full-job allowance before intake, then only reduce it:

```text
n = original bytes (file intake initially uses the hard 100 MiB upper bound)
O = 100 MiB maximum rewritten output
initial = 1 GiB child DATA ceiling + 64 MiB runtime/mapping allowance + n + 2O
D = 4 × oriented width × height × max(3, channels) × sample bytes
predicted = n + 2O + (128 MiB child baseline + 2n + O + D)
metadata reservation = min(initial, predicted)
```

The parent input and two parent output copies are explicit. The metadata estimate
also allows child input retention, native pixel work and encoded output. Depth
mapping/pixel accounting is shared with the existing per-image policy; unknown
depths stay conservative. File metadata reduction uses the actual bounded read
length, which must not exceed the size initially reserved.

These are engineering allowances for logical job ownership, not allocated RAM,
measured RSS bounds or kernel reservations. The 2 GiB value is an application
policy independent of cgroup size; PostgreSQL, caller-owned buffers, other app
work, allocator/GC retention and host pressure remain outside its guarantee.
Retain the actual per-child Linux DATA ceiling and deployment memory controls.

The FIFO never bypasses a blocked head. A valid reduction can start a fitting
waiter while the first task remains active. Cancellation/expiry removes a waiting
entry and pumps eligible work immediately. An oversized initial reservation
refuses as owned capacity failure before intake. A live task's capability cannot
expand, become negative, or mutate accounting after settlement.

The reduced reservation stays held through child close **and** original file/
repository publication. Active abort alone does not release it. Original task
Error/null remains the original rejection. Even a failed kill must retain worker
ownership until actual close; there is no guaranteed response duration when OS
retirement itself stalls.

## Bounded metadata/grant protocol

The worker argv now includes the exact original byte count. The child reads that
many binary bytes into one bounded buffer without waiting for EOF. It performs
existing native metadata/content/memory admission, then writes one bounded JSON
metadata line containing only stage, format, oriented dimensions, channels and
approved depth. Raw source metadata, paths, URLs and credentials are not included.

The parent validates the exact six-field schema and request bounds, synchronously
reduces the current reservation, rechecks cancellation/deadline and sends exactly
`grant\n`, ending stdin. The child requires those exact six bytes and EOF before
native rewriting. Malformed/non-ASCII/extra control bytes fail closed. Metadata
and a final result in the same pre-grant chunk are refused.

The parent still accepts approved content/capacity refusals before metadata.
Positive results require metadata first, bounded exact output, matching format/
dimensions, zero exit, live deadline and actual process/stdio close. Metadata and
result headers each retain their 1 KiB bound. Synchronous ownership errors or
unsupported async owners withhold grant, kill and drain the child with fixed
temporary diagnostics. The input/result transport remains the existing stdin/
stdout streams, so no additional IPC descriptor or socket is needed.

## Validation and tradeoffs

Fast checks own weighted FIFO fairness, cancellation/expiry, late capability use,
Error/null, exact grants/EOF, malformed projections, callback failure, deadline
refusal and retained publication ownership. Native checks prove actual Sharp,
kernel limits/OOM counters, process retirement, unchanged output hashes and the
default budget serializing two maximum-pixel jobs through held publication.

Small metadata reductions can permit overlap. Conservative initial reservations
can delay work whose eventual estimates would fit; a large buffer that cannot
enter the 32 MiB waiting budget returns temporary capacity failure. The paired
100 MiB native compatibility control explicitly uses a 3 GiB reservation budget
matching its test profile; it is not default-throughput evidence. Existing native
deadlines and original/output policy limits are unchanged.

This coordinates predicted artwork work within the existing app. It does not
isolate hostile native code, reserve physical RAM, protect every host OOM or size
the entire application. Next, qualify deployment-budget sizing against concurrent
provider intake/PostgreSQL work before adding operator-facing memory configuration.
