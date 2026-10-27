# Password login local Docker design

October 27, 2026. Rebuild the existing single walkthrough application with an
owned temporary BuildKit builder using `--pull --no-cache`. Preserve the existing
administrator and all five inspected bind sources/destinations, including the
actual downloads override. Do not add an app service or modify unrelated user
containers.

Freeze changed source/tests, then compare all packaged server/shared/client bytes
and modes, npm/OS package inventories, Node provenance, entrypoint and immutable
schema artifacts with the preceding qualified image. Only the intended five
server files may change; client assets and dependencies must remain identical.

Qualify password login and the existing rotation/replay cohorts on the immutable
image without overlaying packaged modules. Each native entry owns a network-none,
non-root, read-only container with 2 CPU, 3 GiB memory/swap, 256 PID limit and
private tmpfs data. Keep holders and contenders alive through actual drainage,
then record exit, exact removal and absence. Source-overlay preflight evidence
is separate from final packaged qualification.

Existing-admin readiness and browser login must still work without resetting
credentials. Confirm automatic maintained schema status remains current after
the login change. Probe private publication/directory-sync only in an owned child
of the existing data bind and verify its removal. Retire bootstrap/password
helpers and the temporary builder.

See [implementation design](PASSWORD_LOGIN_DESIGN.md) and separate
[Docker outcome](LOCAL_DOCKER_PASSWORD_LOGIN_OUTCOME.md).
