# Backup I/O drainage design

October 25, 2026. Follows [exclusive publication](BACKUP_PUBLICATION_OUTCOME.md).
See [research](BACKUP_IO_DRAIN_RESEARCH.md) for primary sources and classifications.

## Problem and observed boundary

The PostgreSQL session owner outlives returned work while its session is healthy.
But PostgreSQL releases a terminated session's advisory lock independently of
admitted filesystem work. A controlled baseline fixture held the production
file service's injected `unlinkFn` after ownership admission, terminated the real
backend, ran fresh recovery and published a replacement at the same path. The
old wrapper then called real `unlink`, deleting the replacement bytes while its
catalog row remained. This is a deterministic service-admission reproduction,
not an observed kernel stall or a reported production incident.

## Decision and final stack

Add a small process-local admission/drain factory. All default production backup
facades import the same canonical ESM instance. Reserve it synchronously before
database checkout; refuse contenders without queuing them. Hold it until the
entire returned ownership-store promise settles, including file work, attempted
journal/catalog writes, advisory unlock and client release. Do not free it when
the database emits an error, a timer expires or an observer sees terminal status.
Preserve the wrapped result or Error/null, then clear local ownership in `finally`.

Keep PostgreSQL ownership and the pinned query client. A busy local contender uses
the same fixed 409 error as a busy database contender; recovery keeps its explicit
ownership-busy result with zero outcome counts. Existing connection checks still
refuse later mutations after connection loss. Already-admitted work must settle
before a local replacement can inspect or mutate the journal/files.

Recommended stack: synchronous shared local admission → PostgreSQL session owner
and pinned client → existing journal/exclusive-link/verification/inode cleanup
workflow → awaited database cleanup → local release → fresh recovery if required.
No second app/service, queued promises, polling timer, dependency or schema change.

## Alternatives and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| PostgreSQL session lock alone | Existing cooperative cross-session coordination | Lost session releases the lock before local admitted I/O settles | Insufficient alone |
| Abort on database error | Stops future cooperative admission | Cannot establish cancellation of already-admitted OS work | Keep checks; do not treat abort as drainage |
| Timer/lease-based local release | Apparent bounded wait | Can admit a replacement while the old mutation is pending | Reject |
| Shared local gate plus current database owner | Covers returned work through session cleanup; constant state; no extra checkout or queue | Serializes backup work; a stuck operation remains busy; local process scope | Adopt for current runtime |
| Durable uncertain-I/O marker | Could conservatively refuse independent-process replacements | Needs schema/protocol/operator recovery, and cannot infer when old native work stopped | Consider before topology expansion |
| OS lock/native worker protocol | May couple lock and mutation lifetime more closely | Platform/native integration and interruption qualification; not supplied by current Node pathname APIs | Defer pending an actual multi-process requirement |

## Validation and scope

Test synchronous admission, refusal without checkout, cross-facade default sharing,
delayed cleanup, Error/null and reuse after settlement. Native qualification holds
admitted final deletion, link and temporary cleanup, terminates each real backend,
observes backend/lock retirement, and proves the default app's contenders remain
busy without journal changes. Only after actual settlement may fresh recovery
complete and a replacement's bytes/catalog remain. Keep a real database-contention
control independent of the local gate, plus exclusive-publication/journal regressions.

The supported packaged runtime has one application process and one Compose replica.
An ESM instance is not shared across separate processes, worker isolates or distinct
module URLs. PostgreSQL still coordinates healthy cooperating sessions, but this
change does not provide cross-process fencing after session loss. Direct low-level
service/store calls and custom independent gate injections are outside production
admission. No process-crash, power-loss, NFS, arbitrary same-UID pathname replacement
or unreturned-background-work guarantee follows. Preserve private storage and the
single-process topology; qualify stronger recovery before changing that topology.
