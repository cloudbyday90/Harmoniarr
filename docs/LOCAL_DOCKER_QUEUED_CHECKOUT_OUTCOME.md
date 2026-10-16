# Local Docker rebuild after queued checkout work

Date: 2026-10-16. Follow-up to the
[queued-checkout outcome](POSTGRES_QUEUED_CHECKOUT_OUTCOME.md), following the
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) and existing
[owned rebuild design](LOCAL_DOCKER_REBUILD_2026_10_DESIGN.md). Current official
Docker guidance was rechecked through MCP in the
[research](POSTGRES_QUEUED_CHECKOUT_RESEARCH_2026_10.md).

## Build and preserved-state startup

The documented Compose build ran with --no-cache using a new, acknowledged
docker-container builder with default-load=true. The build took 106.805 seconds
and loaded `harmoniarr:walkthrough-local` as
`sha256:c178069620993dbee8016405268f7a382ab3ae1fc2e4f045945e791b92a8e8b1`.
Temporary builder, BuildKit container and state-volume absence were verified,
with the previously selected builder unchanged. No global pruning or base-image
pull was requested. The fresh builder excludes prior cache-mount state; cache
populated during this build can still be reused within the build.

The guide's `up -d --wait --no-build harmoniarr` and disposable bootstrap-profile
command both passed. The running container uses that exact loaded image and
remains available at <http://127.0.0.1:47956>. Its existing administrator was
reused. All existing bind sources and selected deployment fields, including the
secret-encryption key, were retained privately without printing their values.

Verified: healthy Docker state and successful /healthz, loopback-only port 47956,
non-root user, read-only root filesystem, all capabilities dropped and
no-new-privileges. A live read-only query returned PostgreSQL server 18.6.
Host tools were Docker 29.8.2, Compose 5.6.0 and Buildx 0.37.2. These deployment
observations are separate from the pinned integration database image.
The final review's unsupported-method refusal and its regression test changed
only testing/test files. Dockerfile COPY/build inputs remain byte-identical to
the completed no-cache build; the image was not rebuilt again for that revision.

## Applicable guide branches and limits

The documented readiness-only provider validator passed. It retained configured
provider/path-mapping requirements and reported provider health `attention`.
Existing diagnostic categories remain visible. Its temporary password-only file
was removed and verified; raw credentials, provider addresses and paths were
excluded from the evidence. This is readiness proof, not a new accepted transfer
or a claim that every existing download/import is healthy.

The guide's Stop/Reset, provider setup/transfer commands, optional file-backed
recovery/managed-provider proofs and fresh-install/release-rehearsal branches
were not rerun for this fixture-diagnostics change. The configured walkthrough
was preserved and left running. No transfer was submitted, no provider setting
was changed, and no release/image publication was created.

Private invocation evidence is under `.tmp/queued-checkout-2026-10-16/`, including
`no-cache-build-fbc581ea-c6e0-4182-8b0b-8afb4ac43aca.json`,
`walkthrough-up-evidence.json`, `provider-readiness.json` and the secret-cleanup
record. Source-byte verification remains tied to the checkout outcome's frozen
source; a healthy rebuilt application does not diagnose an earlier test failure.

Recommendation: keep the owned no-cache path for requested rebuilds and preserve
existing state. Continue with original-client startup write/authentication
evidence before changing pool capacity, deadlines or full-suite scheduling.
