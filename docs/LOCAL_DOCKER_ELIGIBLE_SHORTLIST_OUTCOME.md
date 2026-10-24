# Local Docker eligible-shortlist rebuild

Executed October 24, 2026 using the preserved-state path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The
[implementation outcome](ELIGIBLE_MATCH_SHORTLIST_OUTCOME.md) records behavior and limits.

## Build and preserved startup

- Fresh disposable buildx builder with --pull --no-cache --load. Builder retirement
  and absence were verified after the build.
- Previous image: 8f487b8f50e8b7bf295e10db80788ce4dc66d27ccf6e72931048f51fb91035bd.
- New immutable image: 1ebc2ebeff901b4b5743251971200a2472d9b6a0b865105fbdc09c7c54ca41c3.
- Compose up --wait --no-build passed. The app is healthy at
  http://127.0.0.1:47956, Linux amd64, UID 1000, with a read-only root filesystem.
- Existing administrator, data and all five actual bind mounts were preserved,
  including the existing download source through the documented override.
- One-shot bootstrap recognized the existing administrator and retired. Startup
  verified 112 applied migrations and zero pending; no new migration ran.
- Authenticated readiness-only validation passed without provider search/transfer
  submission. Its temporary password-only file was outside the repository;
  deletion and absence were verified.

## Exact runtime comparison

The packaged image has 919 server files, 11 shared files and 155 client files.
Only nine intended server files differ, including the new candidate-fact store;
all other server/shared bytes are unchanged. Client bytes are unchanged from the
previous image and match the validated local build exactly.

Root manifests, exact Node binary, Node 24.22.1, npm 12.0.2, 110 production npm
packages and 151 APK packages are unchanged, with no additions. Media/artwork
workers and dependencies are unchanged. Prior native allocation and deployment
memory qualifications are retained on this exact comparison; no new memory-sizing
or whole-container OOM claim is made.

Private evidence is under .tmp/eligible-match-shortlist-2026-10-24. Fifteen changed
source/test files match the frozen inventory. The broader PostgreSQL fingerprint
is 3409 files, SHA-256 0cd62c47bdf5f5504827a9efe9ae339bdec53b345fe72b69367e9c9985002f2f.

## Isolated packaged checks

The immutable image is used by the controlled-provider pipeline and file-backed
verifier with disposable data. Actual media evidence remains separate from the
controlled shortlist candidates and injected gate used by SQL/browser checks.
The existing walkthrough installation is preserved throughout validation.

Both verifiers passed. The controlled-provider pipeline established its twelve
aggregate acquisition/recovery/authority facts, including actual preflight quality
refusal, shared discovery, bounded exhaustion and current-authority refusals.
The file-backed verifier passed authentic-audio apply, initial transcode review,
distinct changed-source worker refusal, collision refusal, folder recovery and
tooling recovery while retaining unrelated candidates.

Disposable Compose containers, networks and volumes were retired and absence
verified. Temporary workspaces were removed and absence verified. These fixtures
submit no live-provider work and do not establish public discovery or manual
accessibility acceptance for the shortlist journey.
