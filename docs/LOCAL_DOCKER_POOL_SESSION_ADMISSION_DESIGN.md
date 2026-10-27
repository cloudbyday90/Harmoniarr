# Local Docker pool/session admission validation design

Qualify the frozen October 27 candidate on main with a fresh-builder pull/no-cache
image and no release/tag. Preserve the walkthrough administrator, data and all
five actual bind mounts, including the inspected downloads override. Do not stop
unrelated host workloads.

Compare immutable image bytes/modes and package records with the prior qualified
image. Only the intended server modules change; client assets, shared files,
dependencies, Dockerfile and native binaries remain unchanged. Recreate the
existing walkthrough using the inspected mount configuration; verify UID 1000,
read-only root, loopback port, 115 applied migrations, readiness and temporary
password/bootstrap/builder retirement.

Execute packaged PostgreSQL lanes for session/pool exhaustion and cancellation,
administrator schema HTTP, drift lifecycle, ordinary observation/backup,
preparation serialization, atomic snapshot and migration CLI readers. Each owns
an isolated, read-only container with network none, CPU 2, memory/swap 3 GiB and
256 PIDs. Verify actual process exit and exact container absence. Session fixtures
use a pool maximum of one and cap of two to observe exhaustion; they do not change
production defaults. Controlled shorter startup/deadline cases test the same
driver/owner paths while unit checks pin production values.

Keep Windows-hosted authentication/CSRF integration evidence separate from Linux
filesystem durability. A Windows `fsync` EPERM refusal is not a passing backup
test. Do not weaken directory sync to make that lane green; qualify real backup
and restore through the packaged Linux observation/data-bind lanes and retain
the host failure explicitly.

Run the three affected diagnostics browser scenarios and existing-administrator
live refresh, retaining explicit-only operation, no-store, status/focus, retry
and desktop/mobile checks. Client API coverage must distinguish retryable 503
from authentication reset. Manual assistive-technology acceptance stays deferred.

The PR's native provider lanes have their own
[design](SLSKD_0262_QUALIFICATION_DESIGN.md). Require immutable identities,
bounded resources, restricted API credentials and acknowledged cleanup.

See [outcome](LOCAL_DOCKER_POOL_SESSION_ADMISSION_OUTCOME.md) and
[implementation design](POOL_SESSION_ADMISSION_DESIGN.md).
