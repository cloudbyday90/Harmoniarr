# Local Docker quality-review search rebuild

Executed October 24, 2026 following the preserved-state path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The
[implementation outcome](QUALITY_REVIEW_SEARCH_OUTCOME.md) records behavior and limits.

## Build and preserved installation

- A fresh disposable buildx builder used --pull --no-cache --load; builder removal
  and absence were verified.
- Previous image: 5f7162eae1f9d49a8d94ee67732b533fda4ac9991a5488434364d9f633930493.
- New immutable image: 8f487b8f50e8b7bf295e10db80788ce4dc66d27ccf6e72931048f51fb91035bd.
- Compose up --wait --no-build passed. The app is healthy at
  http://127.0.0.1:47956, on Linux amd64 as UID 1000 with a read-only root filesystem.
- Existing administrator, data and all five actual bind mounts were preserved,
  including the existing download source through the documented override.
- The one-shot bootstrap recognized the existing administrator and retired.
  Startup verified 112 applied migrations and zero pending; no new migration ran.
- Authenticated readiness-only validation passed without provider search/transfer
  submission. The password-only temporary file was outside the repository;
  deletion and absence were verified.

## Runtime comparison and qualification scope

The image contains 918 server files, 11 shared files and 155 client files. Fifteen
intended server files differ; all remaining server/shared bytes are unchanged.
Packaged client bytes match the validated local build. Root manifests, the exact
Node binary, Node 24.22.1, npm 12.0.2, 110 production npm packages and 151 APK
packages are unchanged, with no package additions.

Native media/artwork workers and their dependencies are unchanged. Prior native
allocation and deployment-memory qualifications are retained on exact source/runtime
comparison; this round makes no new memory-sizing or whole-container OOM claim.

Private evidence is under .tmp/quality-review-search-2026-10-24. The final inventory
covers 22 changed source/test files. The broader PostgreSQL source fingerprint is
3404 files, SHA-256 1b2503d55dbfccfe9131f3f4572993ea17f7b638d9bb7d9930ddbb09abac39f6.

## Isolated packaged checks

The immutable image is used for the controlled-provider pipeline and file-backed
verifier with disposable data. Their media evidence is separate from synthetic
replacement/search candidates and controlled query/ingestion assertions. The live
walkthrough is preserved during isolated validation.

Both verifiers passed. The controlled-provider pipeline established its twelve
aggregate acquisition/recovery/authority facts, including actual FLAC preflight
refusal, shared discovery, bounded quality exhaustion and three current-authority
refusals. The file-backed verifier passed authentic-audio apply, initial transcode
review, distinct changed-source worker refusal, collision refusal, folder recovery
and tooling recovery while leaving unrelated candidates unchanged.

Compose container/network/volume absence and temporary workspace retirement were
verified. These isolated fixtures do not submit live-provider work. Their actual
media evidence does not substitute for the scoped SQL/browser restart cases or
prove public discovery and manual accessibility acceptance.
