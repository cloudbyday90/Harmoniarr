# Password change local Docker qualification design

Date: October 27, 2026. [Command design](PASSWORD_CHANGE_DESIGN.md).

Freeze the six changed production/test files and repository source fingerprint.
Run the complete fourteen fast-gate stages with server concurrency eight. Build
with `--pull --no-cache --load` through a disposable buildx builder and verify
builder retirement.

Compare exact packaged source, modes, dependencies, runtime provenance and client
assets against the preceding image. Preserve the existing administrator, database
and all five inspected bind sources, including the actual downloads override.
Recreate only the existing walkthrough application with loopback port 47956,
read-only root and UID 1000. Confirm readiness, zero pending migrations, existing
bootstrap handling, helper retirement and temporary private-password-file removal.

Run new password-change qualification in separate fresh 2/3 GiB containers. Run
hash upgrades, native password work, auth reads, session admission, failure,
ordinary login, rotation and replay at 3 GiB. Each final run must use immutable
packaged application modules, network isolation, two CPUs, equal memory/swap
caps, 256 PIDs and private tmpfs data/media. Assert exit zero and actual removal
and absence. Source-overlay preflight remains separate.

Use independent PostgreSQL observation for transaction visibility and actual
contender waits. Suppression triggers test refused credential/revocation writes;
post-COMMIT client decoration tests acknowledgement loss after a real commit.
Neither establishes a physical network-fault reproduction or exhaustive schedule
coverage. Observe actual backend absence after a timed-out command drains.

Finally verify entrypoint identity/mode, private data-bind publication/cleanup and
live browser login using the preserved administrator. Inspect desktop/mobile
schema diagnostics screenshots and automatic no-store status. Keep manual AT and
physical-device acceptance deferred. Retain unrelated native/provider proof only
after exact unchanged source/runtime review. Do not change unrelated containers
or create a release, tag, branch or additional application.

See [Docker outcome](LOCAL_DOCKER_PASSWORD_CHANGE_OUTCOME.md).
