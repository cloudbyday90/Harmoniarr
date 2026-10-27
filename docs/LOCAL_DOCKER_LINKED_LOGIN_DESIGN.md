# Linked login local Docker qualification design

Date: October 27, 2026. [Implementation design](LINKED_LOGIN_DESIGN.md).

Freeze all thirteen changed production/test files and repository source fingerprint
before final qualification. Run the complete fourteen fast-gate stages, with
server test concurrency eight. Build with `--pull --no-cache --load` through a
disposable builder, then verify builder retirement.

Compare exact packaged code, modes, runtime provenance, dependencies and client
assets against the preceding image. Preserve the existing administrator, database
and all five bind sources, forwarding the actual downloads override. Recreate only
the walkthrough application with loopback port 47956, UID 1000 and read-only root.
Check readiness, migration lineage, existing-user bootstrap handling, helper
retirement and temporary private-password-file removal.

Run linked login, password change, hash upgrades, native password work, auth reads,
session admission, failed login, ordinary login, rotation and replay in ten fresh
3 GiB containers. Each must use the immutable packaged application, network
isolation, two CPUs, equal memory/swap caps, 256 PIDs and private tmpfs database/
media. Assert exit zero and actual removal/absence. Source-overlay preflights
remain separate from final packaged evidence.

Provider calls use the real Plex client with controlled response transport, real
encrypted pending-state storage and actual mounted HTTP callbacks. This is not
live Plex or TLS qualification. SQL barriers/triggers and independent activity
observation own race/rollback proof; clear the PostgreSQL statistics snapshot
when observing waits inside a transaction. COMMIT-ack loss is controlled after a
real COMMIT, not a physical network-fault reproduction.

Finally verify entrypoint identity, private data-bind publication/readiness/
cleanup and live browser login with the preserved operator account. Inspect
desktop/mobile automatic no-store diagnostics. Manual AT/physical-device checks
remain deferred. Retain unrelated provider/media/resource proof only after exact
unchanged source/runtime review. No new release, tag, branch or application is
created. See [execution outcome](LOCAL_DOCKER_LINKED_LOGIN_OUTCOME.md).
