# Shared artwork ingestion budget

Decision: October 22, 2026. Follows [fetch admission](ARTWORK_ADMISSION_OUTCOME.md).

Inventory found one production ingestion-service instance shared by provider
fetches and library embedded/sidecar capture. All server Sharp calls belong to
that service's preparation helpers. Serving returns existing originals; derivative
settings/directories exist, but no active derivative generator was found. This
round protects the existing paths without inventing a new derivative feature.

Extract the existing FIFO scheduler into an ESM work-admission module, retaining
fetch's diagnostics/state/defaults through a small adapter. Add an independent
ingestion adapter: two active ingestions, four waiters, 32 MiB of queued buffer
inputs and a 15-second queue wait. Buffer weight is its current byte length;
queued file requests hold bounded paths and zero input-buffer weight. Independent
factories/processes have independent budgets. No global singleton or dependency.

Validate buffer type and the existing 100 MiB hard per-image maximum before queue
admission. Read saved policy after admission; hold the slot through file reading,
inspection, rewrite, statistics, filesystem writes and asset publication. File and
buffer entrypoints call one admitted implementation, never recursively acquire
the same gate. Fetch's outer permit remains separate and includes assignment;
library assignment happens after ingestion returns. No reverse gate dependency.

File ingestion opens one handle after admission. Nonblocking open avoids waiting
on Unix FIFOs; reject non-regular files and oversized declared lengths. Read in
bounded chunks through at most the first excess byte, so growth after stat cannot
trigger an unbounded readFile allocation. Await close before retiring the slot,
preserve the first approved failure and keep native paths/causes out of errors.
This does not add library-path authorization, symlink or file-snapshot guarantees.

Move native image operations into a small processing module. Preserve inspection
and rewrite admission/defaults; apply the same pixel policy and existing three-
second native timeout to dominant-color statistics. Keep its best-effort outcome.
Reject input bytes before hashing. Existing public helper exports remain available.

Queued abort, expiry and capacity refusal release byte reservations and listeners
without dispatch. Active abort does not release a permit before actual completion.
Owned ingestion capacity failures must escape batch resolution after sibling drain,
not become qualified provider absence. HTTP/worker signal propagation is unchanged.

The budget counts admitted lifecycles and retained queued source bytes, not RSS.
Caller-owned buffers, native caches, intermediate/output buffers and other process
work remain outside that accounting. Callers must keep input bytes stable through
completion. Preserve deployment limits and do not tune global Sharp threads/cache
from a single fixture. See [research](ARTWORK_INGESTION_BUDGET_RESEARCH.md) and
[outcome](ARTWORK_INGESTION_BUDGET_OUTCOME.md).
