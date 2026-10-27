# Automatic schema maintenance local Docker design

October 27, 2026. Rebuild the existing single walkthrough application with an
owned temporary BuildKit builder using `--pull --no-cache`. Preserve the existing
administrator and all five inspected bind mounts, including the actual downloads
override. Use the built-in maintenance owner; do not add an application service
or change unrelated containers.

Compare full server/shared/client bytes and modes, npm/OS inventories, Node
provenance, entrypoint and immutable schema artifacts with the preceding image.
Require only the intended server paths to change and packaged client assets to
match the final local build. Freeze all affected code/tests before qualification.

Run real maintenance/HTTP and drift fixtures on the immutable image without
replacing packaged application modules through source binds. Fixtures own
network-none, non-root, read-only containers with 2 CPU, 3 GiB memory/swap,
256 PID limits and private tmpfs data. Wait for observer/backend retirement
before teardown; record successful exit, removal and exact absence.

Use the existing administrator for live readiness and browser validation. Opening
diagnostics must load the maintained result automatically with no manual schema
button, preserve focus and fit mobile width. Remove private bootstrap/password
helpers. Restrict the data-bind publication/directory-sync probe to a newly owned
child directory and verify removal. Retire the temporary builder.

See the [implementation design](AUTO_SCHEMA_MAINTENANCE_DESIGN.md) and separate
[Docker outcome](LOCAL_DOCKER_AUTO_SCHEMA_MAINTENANCE_OUTCOME.md).
