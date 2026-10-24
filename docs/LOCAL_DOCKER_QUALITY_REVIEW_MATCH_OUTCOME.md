# Local Docker quality-review alternative rebuild

Executed October 23, 2026 following the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) and its preserved-state rebuild
path. Implementation and scope are in the [selection outcome](QUALITY_REVIEW_MATCH_OUTCOME.md).

## Build and preserved startup

- Fresh disposable buildx builder; --pull --no-cache --load. The builder was
  removed and its absence verified after building.
- Previous image: c4ba006b87569253176aaded5a36ae9facbd97cd1e847f72d4d2a979d8dba4ce.
- New immutable image: 5f7162eae1f9d49a8d94ee67732b533fda4ac9991a5488434364d9f633930493.
- Compose up --wait --no-build succeeded. The app is healthy, read-only, Linux
  amd64 UID 1000 and published only at http://127.0.0.1:47956.
- The existing administrator and data were preserved. Before/after inventories
  verified all five actual bind mounts unchanged, including the existing download
  source passed through the walkthrough override. No reset or volume deletion ran.
- The one-shot bootstrap recognized the existing administrator and retired.
  Startup verified 112 applied migrations and zero pending; no new migration ran.
- Authenticated readiness-only validation passed without search or transfer
  submission. Its password-only temporary file was outside the repository and
  deletion/absence were verified.

## Exact runtime comparison

The packaged inventory contains 916 server files, 11 shared files and 155 client
files. Nine intended server files differ, including the new selection service;
all other server/shared bytes are unchanged. The packaged client matches the local
validated build byte for byte. Root manifests match source; 110 production npm
packages and 151 APK packages remain unchanged, with no additions.

Node 24.22.1, npm 12.0.2 and the exact Node binary are unchanged, along with native
media/artwork/worker code and dependencies. Prior allocation and native memory
qualifications are retained on that exact comparison. This round does not claim
new deployment sizing or whole-container memory qualification.

Private evidence is under .tmp/quality-review-match-2026-10-23. Final code inventory
covers 19 changed source/test files; the broader PostgreSQL source fingerprint is
3399 files, SHA-256 2040b8e1271f1667bbe49a9a0de7c6b174aadbb69aa0522983ed720dc1460ce9.

## Isolated packaged validation

The controlled-provider pipeline and file-backed verifier use this immutable image
with disposable data, keeping actual measurement separate from injected SQL and
browser gates. Final results and resource-retirement checks are recorded with the
private image evidence.

The controlled-provider pipeline passed its twelve aggregate acquisition/recovery
and authority facts, including actual FLAC preflight refusal, shared discovery and
bounded quality exhaustion. Its disposable Compose containers, networks, volumes
and workspace were retired and absence verified. This does not claim a native
provider-discovery or measured-audio result for the synthetic replacement fixture.

The file-backed verifier also passed actual authentic-audio apply, measured initial
transcode refusal plus a distinct changed-source worker refusal, collision refusal,
folder recovery and tooling recovery. Both recovery cases left the unrelated
candidate import_pending. Its project resources and temporary workspace were
removed and absence verified. No live-provider transfer was submitted by these
isolated fixtures or the preserved-installation readiness-only check.
