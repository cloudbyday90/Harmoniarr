# Backup process-crash qualification design

October 26, 2026. Follows [directory creation](BACKUP_DIRECTORY_CREATION_OUTCOME.md).

Qualify actual Linux application-service process termination through existing
production factories. Add test-only ESM plan, child and process-lifetime modules;
do not add production fault switches, a second deployed application or a job system.
The child imports packaged server modules and constructs the real application/owned backup service against disposable
files and packaged PostgreSQL. Pause after selected real filesystem/store calls,
acknowledge the checkpoint over bounded IPC, then terminate that owned Node child
with SIGKILL. No cooperative cleanup can turn this into a graceful shutdown.

Observe the actual spawned child's close and original PostgreSQL backend/lock
retirement separately. A successful signal request is not retirement. Recovery
runs in a different new process through default application composition. Observe
its normal close, current SQL/catalog/files, and a repeated recovery invocation
for idempotence. Report source/process/session/storage boundaries independently.

The finite 19-case plan spans publication intent, prepared directories, complete
bytes before sync, closed file, temporary-ready SQL, link, final-directory sync,
temporary unlink/sync, finalized SQL, catalog insert and completion. Six deletion
checkpoints span intent, unlink, directory sync, finalized SQL, catalog delete and
completion. A last controlled prefix-write case must remain in confirmation with
no catalog. Missing directory trees defer without recreation; an explicit fixture
repair is separated from subsequent default recovery of unwritten intent.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Throw or terminate PostgreSQL only | Cheap; existing coverage | Does not remove application-process memory/cleanup | Retain separately |
| Graceful SIGTERM | Tests orderly shutdown | Handlers may clean up or finish work | Separate future lane |
| SIGKILL after acknowledged real checkpoints | Actual abrupt process loss; repeatable states | Controlled boundaries, not arbitrary in-flight I/O or hardware loss | Adopt |
| Kill the container/database/host | Broader failure domain | More disruptive; obscures this process boundary | Separate qualification |

Recommended stack: guarded disposable profile → real checkpoint → bounded IPC →
owned Node SIGKILL → observed child close → observed backend/lock retirement →
fresh default recovery → durable file/catalog/phase assertions → repeated recovery →
verified teardown. Only actual spawned-child identity authorizes termination;
reported backend identity is for observation. Bound output, messages and waits,
exclude unrelated inherited environment/Node options, and preserve files after
uncertain child retirement. Sequential cases avoid process/pool/fixture overlap.

Keep cheap process-protocol/lifetime tests in the fast suite and the crash matrix
opt-in. One frozen bounded fast gate and no-cache Docker walkthrough complete the
change. Retain unchanged runtime evidence only after exact comparison. Make runtime
fixes only for reproduced failures. This is application-service process loss, not
an HTTP-server rollout, PostgreSQL crash, unacknowledged SQL response, arbitrary
mid-syscall interruption or power-loss durability claim.
