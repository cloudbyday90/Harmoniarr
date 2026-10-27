# Local Docker password-hash qualification design

Date: October 27, 2026. [Implementation design](PASSWORD_HASH_DESIGN.md).

Freeze all eight changed code/test files and the repository source fingerprint
before final validation. Run one complete fourteen-stage fast gate with server
test concurrency eight. Build the application with a disposable buildx builder,
`--pull --no-cache --load`, and retire that builder after completion.

Compare exact before/after packaged source, runtime, dependencies and client
assets. Preserve the existing local administrator, database and all five inspected
bind mounts, including the actual downloads source override. Recreate only the
existing walkthrough application, bound to loopback port 47956 with a read-only
root. Verify startup migration lineage, readiness, UID and bootstrap helper
retirement. Temporary operator password files must be removed and checked absent.

Run separate disposable network-isolated, non-root, read-only qualification
containers against the immutable new image. The legacy-upgrade and password-work
fixtures each run at 2 and 3 GiB. Authentication reads, session pool admission,
failure bookkeeping, ordinary login, rotation and replay run at 3 GiB. Assert
two CPUs, equal memory/swap limits, 256 PIDs, tmpfs-only fixture database/media,
zero failed/skipped/cancelled tests, then actual container removal and absence.
No final run overlays application binaries from the checkout.

Use real PostgreSQL transactions and independent observation to verify atomic
upgrade/audit/session behavior. Controlled commit acknowledgement loss occurs
after a real COMMIT; it is not a physical network-failure reproduction. Keep
source-overlay preflight evidence distinct from final packaged qualification.

Finally verify the entrypoint's bytes/mode, bind/data ownership and actual browser
login with the preserved administrator. Inspect desktop/mobile diagnostics
screenshots and automatic no-store schema status; no manual schema refresh or
repair is introduced. Manual screen-reader/physical-device work stays deferred.
Retain unrelated worker/provider proof only after exact unchanged packaged
source/runtime review. No extra application, release, tag or branch is created.

See [execution outcome](LOCAL_DOCKER_PASSWORD_HASH_OUTCOME.md).
