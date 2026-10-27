# Plex callback Docker qualification design

October 27, 2026. Rebuild the existing walkthrough application from frozen source
on main, preserving its administrator, data and five bind destinations. No
release, tag, branch, persistent test service or additional deployed application
is needed. [Implementation design](PLEX_CALLBACK_DESIGN.md) owns behavior.

## Qualification sequence

1. Freeze changed code bytes and the repository source fingerprint. Run the full
   fourteen-stage fast gate once on the final source, including all server/client/
   script suites, lint, ESM/schema/image/topology checks and builds. Audit npm.
2. Use a fresh buildx builder and `--pull --no-cache`; remove that owned builder.
   Inventory old/new immutable images: source hashes, runtime binaries, npm/OS
   packages, metadata and permissions. Match every changed server module and the
   client build; carry forward unchanged resource evidence only with exact parity.
3. Recreate the existing loopback walkthrough from the candidate image, preserve
   the actual downloads host override, compare all five mounts and retain its
   existing administrator. Exercise the bootstrap helper's already-provisioned
   path and retire it. Run readiness with a temporary password file, then remove
   that file and its owned directory.
4. Execute eleven affected native auth entries serially at 3 GiB, two CPUs,
   256 PIDs, read-only root, UID 1000, no network or ports, and disposable tmpfs
   database/media directories. Run the packaged implementation without source
   overlays; mount only test/helper inputs. Verify exit, counters and removal of
   each exact owned container. Source overlays are permitted only for separately
   identified preflights, never final evidence.
5. Run actual browser cookie navigation through a disposable fixture using the
   immutable implementation and real PostgreSQL. Verify existing-admin browser
   login/schema diagnostics against the live walkthrough separately.

## Browser fixture boundary

The temporary application runs on a private task-owned Docker bridge, with only
a random loopback host port published, tmpfs data/media, read-only root, UID 1000,
3 GiB/two CPUs/256 PIDs and disabled background work. Its real Plex client uses a
controlled transport with public fixture identities. No live provider credential
is read or sent. A host loopback HTTPS proxy uses checked-in **public test keys**;
the browser's chain exception is scoped to new disposable contexts. No certificate
authority is installed. This proves browser cookie/navigation behavior, not live
Plex connectivity, trusted production TLS or WAN isolation.

The fixture persists its own secure-cookie setting as true before composing the
application. The main application policy is unchanged. A different
site (`http://localhost`) supplies a user-activated top-level link back to the
HTTPS application (`https://127.0.0.1`). Two independent browser contexts establish
that a stolen callback URL alone cannot sign in; the original browser succeeds.
Established-binding tabs use independent states, and replay cannot replace the
current refresh cookie. HttpOnly script exclusion, Secure/host prefix, Lax/path/
host-only attributes and absence of the binding at the simulated provider are
asserted. The fixture app/database/network, contexts, proxy and provider server
are all retired. Its public test material is never deployment configuration.

## Interpretation

The native PostgreSQL lane proves durable ownership and rollback under controlled
triggers, barriers and commit acknowledgement decoration. Per-call checkout/
release instrumentation proves provider work does not hold that call's SQL
checkout; global pool occupancy cannot establish that under concurrent requests.
Abort-aware fixture barriers permit teardown even when an expected phase fails.
These are specified schedules, not exhaustive concurrency or physical network
failure proofs. The browser lane uses controlled provider responses and does not
claim manual screen-reader/device acceptance. No new deployment memory minimum
or throughput benchmark is inferred from auth correctness tests.

Record exact image/source identity, successful gates, failed preflights, cleanup,
current PR discovery and limitations in the
[Docker outcome](LOCAL_DOCKER_PLEX_CALLBACK_OUTCOME.md).
