# Password work local Docker design

October 27, 2026. Rebuild the existing single walkthrough application with an
owned temporary BuildKit builder using `--pull --no-cache`. Preserve the existing
administrator and all five inspected bind sources/destinations, including the
actual downloads override. Do not change unrelated user containers.

Freeze source/tests before final qualification. Compare complete packaged server,
shared and client bytes/modes, npm/OS inventories, Node provenance, entrypoint and
immutable schema artifacts with the preceding image. Require only the intended
four server paths to change; dependencies and client assets must remain equal.

Run the new packaged password workload in fresh 2/3 GiB profiles, then existing
auth-read/session/failure/login/rotation/replay entries at 3 GiB. Each entry owns a
network-none, non-root, read-only container with 2 CPU, matching memory/swap cap,
256 PID limit and private tmpfs data. Record actual work completion, exit, removal
and exact absence. Separate source-overlay preflight from immutable-image proof.
Sampled process RSS is descriptive and does not establish a native memory bound.

Verify the existing administrator's readiness and browser login without resetting
credentials. Retain current automatic schema diagnostics. Restrict the data-bind
publication/directory-sync probe to an owned child and verify removal. Retire the
temporary builder and private bootstrap/password helpers.

See [implementation design](PASSWORD_WORK_DESIGN.md) and separate
[Docker outcome](LOCAL_DOCKER_PASSWORD_WORK_OUTCOME.md).
