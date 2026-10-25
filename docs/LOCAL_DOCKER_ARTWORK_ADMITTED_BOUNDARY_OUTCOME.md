# Admitted artwork local Docker outcome

October 24, 2026. Followed the applicable preserved-state no-cache build,
startup/bootstrap and readiness steps in [the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See the [implementation outcome](ARTWORK_ADMITTED_BOUNDARY_OUTCOME.md) for actual
admitted JPEG/WebP findings, separate preparation scope and next work.

Built with pull/no cache through an isolated buildx builder, loaded the local
walkthrough tag, then removed the builder and verified absence. Image identity
changed from
`sha256:f3a9b302f7a81ed18748d88ccb89cc2a327ae924cf762893c52cdb658b9e041f`
to
`sha256:41b132fd913f91823239a4d0def05c1eb7699fe542f0a073aa7c247384d57fd9`.

Before/after inventories verify byte-identical 933 server, 11 shared and 155 client
artifacts, plus unchanged 110 npm and 151 OS packages. Root metadata matches source;
package.json adds only the explicit admitted native-test alias. No production
module, dependency, migration, version or release change is packaged.

Node/npm remain 24.22.1/12.0.2; PostgreSQL 18.6, Sharp 0.35.5/libvips 8.18.7 and
FFmpeg 8.0.1 remain unchanged. Startup applied zero migrations and verified 115
applied, zero pending.

Recreated the app with `up -d --wait --no-build`; the documented disposable
`--rm --no-deps` bootstrap helper confirmed the existing administrator and retired.
All five actual bind sources/destinations/read-write flags match the pre-build
inventory: app data, downloads, music, staging and transcode temporary storage.
Existing data and saved configuration were preserved; reset was not applicable.

The app is healthy at loopback `http://127.0.0.1:47956`, with read-only root and
UID 1000. Authenticated readiness passed via a temporary password-only file; both
it and its directory were removed. Optional managed-provider/release rehearsals
were outside this rebuild.

Native consumer profiles use this immutable image with verified matching source
mounts and read-only pinned input artifacts. Preparation and independent decode
controls use the preceding byte-identical codec/runtime image and remain separate
evidence. All disposable owned containers retire; the walkthrough app stays up.
