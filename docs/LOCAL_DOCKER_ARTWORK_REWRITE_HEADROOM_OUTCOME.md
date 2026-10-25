# Artwork rewrite headroom Docker outcome

October 24, 2026. Completed the applicable preserved-state no-cache rebuild,
startup/bootstrap and readiness steps from [the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See the separate [implementation outcome](ARTWORK_REWRITE_HEADROOM_OUTCOME.md)
for native results and the next memory qualification item.

## Build and identity

Built with pull and no cache through a disposable isolated buildx builder, loaded
`harmoniarr:walkthrough-local`, then removed the builder and verified absence.
The immutable image changed from
`sha256:2b0916878bff76af08e823a1d5e27953ded4d8a2fba5fdbd463667c43286f0ba`
to
`sha256:f3a9b302f7a81ed18748d88ccb89cc2a327ae924cf762893c52cdb658b9e041f`.

Inventories match expected source bytes. Exactly two of 933 server artifacts
change: `artwork/artwork-worker-memory.js` and
`artwork/artwork-memory-reservation.js`. The other 931 server, 11 shared and 155
client artifacts match byte-for-byte; 110 npm and 151 OS packages are unchanged.
Root package metadata and lockfile match source and are unchanged by this task.

Node/npm remain 24.22.1/12.0.2; PostgreSQL 18.6, Sharp 0.35.5/libvips 8.18.7 and
FFmpeg 8.0.1 remain unchanged. No dependency, migration or release/version change.

## Preserved local stack

Recreated the walkthrough app with `up -d --wait --no-build`. The documented
`--rm --no-deps` bootstrap helper confirmed the existing administrator and retired.
All five actual bind sources/destinations/read-write flags match the pre-build
inventory: app data, downloads, music, staging and transcode temporary storage.
Existing data and saved configuration were preserved; no reset was performed.

The service is healthy on loopback `http://127.0.0.1:47956`, with read-only root
and UID 1000. Authenticated readiness passed through a temporary password-only
file; both the file and its temporary directory were removed. Startup applied
zero migrations and verified 115 applied, zero pending.

Final native qualification uses fresh constrained containers from this image,
verified matching source mounts, network none, no published ports and disposable
tmpfs data. They are retired separately; the walkthrough app remains running.
Optional managed-provider setup and release rehearsals were outside this rebuild.
