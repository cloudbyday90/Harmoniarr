# Session replay local Docker design

October 27, 2026. Rebuild the existing walkthrough with `--pull --no-cache` using
an owned temporary BuildKit builder; remove that builder after completion. Use
the existing single application and embedded PostgreSQL, preserving administrator,
application data and all five inspected bind mounts. Preserve the inspected
downloads-source override during Compose recreation. No second application service,
release or tag publication is required.

Compare the prior qualified image with the candidate using full server/shared/
client hashes and modes, npm/OS package inventories and runtime provenance.
Require only the intended four server paths to differ, unchanged client assets,
and packaged source equal to the reviewed freeze. Keep schema/migrations and
entrypoint unchanged. Re-run actual affected PostgreSQL scenarios on immutable
packaged code rather than a source overlay.

Each temporary database entry owns an isolated non-root, read-only, network-none
container with explicit CPU/memory/PID/tmpfs limits and no published port. Capture
exit and cleanup evidence. Test live existing-admin readiness and a browser smoke
without resetting the operator. A private temporary password file must be removed.
Keep the data-bind probe confined to a newly created directory under backups and
verify only that owned probe's removal. Never stop unrelated containers.

See [implementation design](SESSION_REPLAY_DESIGN.md) and
[executed Docker outcome](LOCAL_DOCKER_SESSION_REPLAY_OUTCOME.md).
