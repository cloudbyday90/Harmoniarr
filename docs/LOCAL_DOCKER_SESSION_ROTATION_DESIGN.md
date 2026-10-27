# Session rotation local Docker design

October 27, 2026. Rebuild the existing single walkthrough service with an owned
temporary BuildKit builder using `--pull --no-cache`. Preserve the existing
administrator and all five inspected bind mounts, including the actual downloads
override. Do not introduce a second app service or stop unrelated containers.
Stop the preceding application binary during recreation; legacy issuers do not
participate in the new advisory-lock protocol.

Compare full server/shared/client bytes and modes, npm and OS inventories, Node
provenance, entrypoint and immutable schema/migrations against the preceding
qualified image. Require exactly the intended production paths to change and
packaged source to match the final freeze. Qualify affected native scenarios on
that immutable image without replacing application modules through source binds.

Native PostgreSQL entries own network-none, non-root, read-only containers with
2 CPU/3 GiB/256 PID limits and tmpfs databases/storage. Capture exit, removal and
exact absence. Keep failure evidence separate from successful final qualification.
Preserve application ownership through contender/holder drainage before teardown.

Existing-admin readiness and a Chromium smoke must exercise CSRF-protected
refresh and current cookie delivery, then existing explicit schema diagnostics
without resetting the operator. Remove the private password file and bootstrap
helper. Restrict the data-bind publication probe to a newly owned backup-directory
child and verify its removal. Remove the temporary builder.

See [implementation design](SESSION_ROTATION_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_SESSION_ROTATION_OUTCOME.md).
