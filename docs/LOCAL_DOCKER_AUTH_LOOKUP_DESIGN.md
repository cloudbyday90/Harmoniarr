# Preliminary authentication read local Docker design

October 27, 2026. Rebuild the existing single walkthrough application with an
owned temporary BuildKit builder using `--pull --no-cache`. Preserve the existing
administrator and all five inspected bind sources/destinations, including the
actual downloads override. Do not add an application service or change unrelated
containers.

Freeze affected source/tests before final qualification. Compare all packaged
server/shared/client bytes and modes, npm/OS inventories, Node provenance,
entrypoint and immutable schema artifacts with the preceding image. Require the
ten intended server paths to change; client assets/dependencies must stay equal.

Qualify new auth reads plus existing session admission, login, failure, rotation
and replay on the immutable image without application-module overlays. Each
native entry owns a network-none, non-root, read-only container with 2 CPU,
3 GiB memory/swap, 256 PID limit and private tmpfs data. Drain actual work before
teardown and record exit, removal and exact absence. Keep source-overlay preflight
evidence separate from final packaged proof.

Verify existing-admin readiness and browser login without resetting credentials.
Confirm automatic schema diagnostics remain current. Restrict the private data-
bind publication/directory-sync probe to a newly owned child and verify removal.
Retire bootstrap/password helpers and the temporary builder.

See [implementation design](AUTH_LOOKUP_DESIGN.md) and separate
[Docker outcome](LOCAL_DOCKER_AUTH_LOOKUP_OUTCOME.md).
