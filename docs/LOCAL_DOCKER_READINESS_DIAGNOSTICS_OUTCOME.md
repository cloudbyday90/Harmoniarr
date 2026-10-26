# Local Docker readiness diagnostics outcome

October 26, 2026. Followed [LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md)
using a fresh Docker container builder with `--pull --no-cache --load`, then
Compose `up -d --wait --no-build` and the one-shot bootstrap profile. The existing
administrator was recognized; the bootstrap helper and builder were retired.
No reset, release, Git tag or new branch was created.

Final image: `sha256:71293899e9bb4e25683882d7dcf90abe71f4990f02a3037acb09d6909ded8325`.
Healthy at `http://127.0.0.1:47956`, Linux amd64, UID 1000, read-only root.
Preserved the administrator, database, provider configuration and all five actual
binds/access modes: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging`,
`/data/transcode-temp`. Both candidate rebuilds retained the same real mount sources.

Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9, undici 7.30.1 and PostgreSQL 18.6.
Verified 115 applied migrations and zero pending. The final source/build inventory
matched: 960 server files, 13 shared files and 155 client assets. Compared with the
preceding committed image, ten server files and one shared descriptor changed;
all other server/shared files, 110 runtime npm packages, 151 OS packages and six
mapped native binary hashes matched. Rebuilt client assets match the local build.
No dependencies changed; npm audit reported zero vulnerabilities.

The readiness-only provider command passed using a temporary password-only file,
which was removed. It establishes readiness, not a new accepted transfer. The
configured backup-root probe passed private directory creation, repeated ancestor
checks, same-handle readiness, exclusive publication, collision preservation and
deletion cleanup; all owned probe files were removed.

The packaged Recovery panel displayed actual healthy process history with no
retained failures. The administrator response was no-store. A separate controlled
response exercised sixteen safe history rows, five rendered rows, ignored private
extras and backpressure copy in the same packaged client. Refresh focus was
retained, desktop/390 px layouts passed and screenshots were inspected. The final
controlled screenshot matches the inspected preceding candidate byte-for-byte.
These controls did not inject failures or mutate real recovery state. Manual
screen-reader and physical-device checks remain deferred.

The first no-cache candidate was
`sha256:c5d2f9c53423670219924565f9bdcd59304963f6daae1787d6956e4d6e2e014d`.
It captured the migration-status HTTP 500 during replacement qualification and
was superseded after investigation, not silently retried. Failed fixture and
diagnostic experiment resources were retired with absence verified. See the
[implementation outcome](READINESS_DIAGNOSTICS_OUTCOME.md) for evidence and limits.
The final read-only reader and its native test were rebuilt into the image above;
final native checks use packaged modules without candidate source overlays.

The final image passed guarded native readiness and normal-startup recovery checks,
then all eighteen automatic container-replacement cases on nineteen production
containers. Fifty concurrent healthy HTTP reads and an actual read-only transaction
passed. No readiness failure records appeared in the final replacement logs.
All owned native/container probes, containers and persistent test volumes were
retired and absence verified. The final stable gate passed 6,131 server, 4,491
client and 700 script tests plus the required static/build checks.

Private first-candidate/failure evidence is under
`.tmp/readiness-diagnostics-2026-10-26/`. Final source freeze, gate, rebuild,
inventory, native, browser and retirement evidence is under
`.tmp/readiness-read-only-2026-10-26/`.
