# Music metadata security update outcome

Status: Compatible update and combined application validation complete
Recorded: October 8, 2026
Design: [MUSIC_METADATA_SECURITY_UPDATE_2026_10_DESIGN.md](MUSIC_METADATA_SECURITY_UPDATE_2026_10_DESIGN.md)

## Actual change

The direct floor is now `music-metadata: ^11.16.0`; the installed/locked version
changes from 11.15.0 to 11.16.0. Exactly one package version changed. No new
dependency, override, major upgrade, platform/native family update or first-party
CommonJS code was introduced. The existing tag-extraction/artwork adapter remains.

Fresh audit identified one moderate affected package through two MP4/EBML
advisories. The configured gate originally passed while reporting that finding.
The maintainer's current release lists both parser fixes; older advisory narrative
still describes master/open-fix status. Dependency removal is supported by the
published release/current audit, not a claim that the historical MP4 proof was
reproduced against Harmoniarr's installed 11.15.0 or that all parser inputs are safe.

## Executed evidence

```powershell
npm.cmd install music-metadata@11.16.0 --ignore-scripts
npm.cmd ci --ignore-scripts
npm.cmd run validate:security
node --test test/server/library-tag-extraction-service.test.js test/server/library-embedded-artwork-service.test.js
```

The clean install adds 453 packages and reports zero vulnerabilities. The final
security gate passes image/tag and Compose topology policies with **zero reported
vulnerabilities at every severity**. Focused extraction/artwork tests pass **6/6**,
zero failures/skips, on local Node 24.18.1/npm 12.0.2.

Actual test-owned WAV, MP3, AAC/M4A and FLAC/Matroska controls are generated using
the local FFmpeg fixture with network disabled. On Windows x64, the patched ESM
parser reads expected artist/title, duration and sample rate from all four.
The real extraction adapter persists four extracted snapshots through an
in-memory persistence boundary; this is parsing/service evidence, not SQL proof.

Two small malformed MP4/EBML controls run in separate Node processes with a
64 MiB V8 heap limit, five-second parent deadline and bounded captured output.
Both reject with `UnexpectedFileContentError` in the final execution (15 ms and
13 ms respectively). The controls do not execute against an old parser or run
unbounded allocation/loop proofs inside the application. The heap limit is not
a claim of a universal cap on external-buffer memory.

Ignored evidence is under `.tmp/fallback-recovery-2026-10/`:
`npm-audit-before.json`, install/clean-install logs, `security-after.log`,
`metadata-focused.log`, `metadata-compat.log` and the ESM control harness/files.
Combined frozen-source validation passes **8,880 tests**, zero failures/skips,
all repository policy/lint checks and both builds. The rebuilt browser module
passes **21/21** and final audit remains zero at every severity. The
[fallback recovery outcome](MUSIC_QUEUE_FALLBACK_RECOVERY_OUTCOME.md) records
the application evidence and original-failure triage separately.

## Recommendation and limits

Retain this ordinary supported update and validate tag/artwork consumers with
parser changes. The benefit is removal of currently reported affected versions;
the cost is verifying real parsing compatibility in the existing consumers.
Maintain process/resource isolation as a separate future concern when broader
untrusted-media exposure warrants it; an async catch cannot interrupt every
synchronous parser failure.

This result is time-bound advisory/compatibility evidence. It does not establish
application exploit reachability, universal vulnerability absence, all malformed
format behavior, Linux/arm64 execution or published-image acceptance. No parsing
policy expansion, release, tag, branch, PR merge or image publication occurred.
