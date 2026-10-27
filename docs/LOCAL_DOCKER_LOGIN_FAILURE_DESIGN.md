# Failed-login local Docker design

October 27, 2026. Rebuild the existing single walkthrough application with an
owned temporary BuildKit builder using `--pull --no-cache`. Preserve the existing
administrator and all five inspected bind sources/destinations, including the
actual downloads override. Do not add an application service or change unrelated
user containers.

Freeze source/tests before final qualification. Compare all packaged server,
shared and client bytes/modes, npm/OS inventories, Node provenance, entrypoint and
immutable schema artifacts with the preceding image. Require exactly the intended
five server paths to change; client assets and dependencies must stay identical.

Run the new failure cohort and existing password-login, rotation and replay
cohorts against the immutable packaged modules. Each native entry owns a
network-none, non-root, read-only container with 2 CPU, 3 GiB memory/swap,
256 PID limit and private tmpfs data. Drain actual contenders/holders before
teardown; record exit, removal and exact absence. Keep source-overlay preflight
evidence separate from packaged qualification.

Existing-admin readiness/browser login must still work without resetting
credentials. Confirm automatic schema status remains current. Limit the private
publication/directory-sync probe to a newly owned child of the existing data bind
and verify removal. Retire private bootstrap/password helpers and the temporary
builder.

See [implementation design](LOGIN_FAILURE_DESIGN.md) and separate
[Docker outcome](LOCAL_DOCKER_LOGIN_FAILURE_OUTCOME.md).
