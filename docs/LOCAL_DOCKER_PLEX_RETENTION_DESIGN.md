# Plex retention local Docker qualification design

October 27, 2026. Rebuild and test the existing walkthrough application on main.
Retain its administrator, data and five actual bind sources. No release, tag,
branch, persistent test application or additional deployed service is needed.
[Implementation design](PLEX_RETENTION_DESIGN.md) owns behavior.

Freeze changed code bytes and the repository source fingerprint before the final
fourteen-stage fast gate. Run all server/client/script tests, lint, ESM/schema/
image/topology checks and builds once on that final source. Audit npm. A fresh
buildx builder must use `--pull --no-cache` and then be removed. Compare old/new
immutable image bytes, modes, runtime binary provenance, npm/OS packages and root
metadata; match every changed server path and the local client build.

Run the new retention native entry and affected callback/linked-login regressions
against the packaged immutable implementation. Each fixture owns a private tmpfs
database/media environment, no network/ports, UID 1000, read-only root, 3 GiB with
matching memory/swap caps, two CPUs and 256 PIDs. Final runs must not overlay
application binaries. Independently verify exit, assertions and absence of each
exact removed fixture. Source overlays belong only to separately named preflights.

The retention entry exercises real PostgreSQL locks, audit cardinality, rollback,
concurrent replacement and a controlled provider callback using production
services. Actual startup registration starts its maintenance component while the
fixture supervisor filters unrelated background services. This checks automatic
start/drain without sending external requests. Commit acknowledgement loss is a
controlled client decoration after a real commit; deadline proof includes actual
backend absence. Trigger/barrier evidence is not every possible schedule.

Retain unrelated password/KDF/session, native media and HTTPS-cookie browser proof
only after exact unchanged source/test/runtime comparison. Do not infer a new
memory minimum or benchmark from auth correctness. The affected callback native
entry and concurrent active-flow test establish the new retention interaction;
new production TLS/live Plex acceptance and manual AT/device checks are outside
this backend-only change.

Recreate the existing loopback walkthrough with the actual downloads host override
preserved; compare all five mounts. Exercise already-provisioned bootstrap and
readiness without changing credentials. Remove the helper and temporary private
password file. Verify entrypoint identity and the private packaged data-bind
publication/readiness/collision probe, removing only its owned child directory.
Run existing-admin browser login and automatic schema diagnostics, then inspect
desktop/mobile screenshots. Retire owned builders/fixtures; leave unrelated user
containers unchanged. Record exact identities, counts, failures, cleanup and PR
discovery in the [Docker outcome](LOCAL_DOCKER_PLEX_RETENTION_OUTCOME.md).
