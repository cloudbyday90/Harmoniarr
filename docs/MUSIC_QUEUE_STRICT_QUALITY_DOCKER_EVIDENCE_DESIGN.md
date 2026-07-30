# Music Queue Strict-Quality Docker Evidence

Status: **Implemented.**

Date: 2026-07-30.

This document completes the controlled-provider follow-up from
[MUSIC_QUEUE_COMPLETED_SOURCE_DISAPPEARANCE_DOCKER_EVIDENCE_DESIGN.md](MUSIC_QUEUE_COMPLETED_SOURCE_DISAPPEARANCE_DOCKER_EVIDENCE_DESIGN.md).

## Problem

The existing strict-quality browser and service contracts prove the intended
release experience, but they did not execute the real provider, download,
inspection, spectral proof, recovery, and library-add path in one isolated
environment. A strict lossless profile must reject a spectrally compromised
file before any library write, try only a separately eligible saved match, and
stop safely when no such match exists.

## Official Sources Reviewed

| Source | Relevant guidance | Harmoniarr decision |
| --- | --- | --- |
| [FFprobe documentation](https://www.ffmpeg.org/ffprobe-all.html) | `ffprobe` reports stream and container facts in a machine-readable form. | The proof preserves a genuine FLAC container and confirms its inspected codec before relying on the existing spectral proof. |
| [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | File names and claimed content types are not trustworthy; type and content checks should be layered. | A `.flac` extension is never acceptance evidence. The safe-add path must use inspection plus strict spectral evidence before a library move. |
| [Docker Compose overview](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-docker-compose/) | Compose owns a multi-container application lifecycle; volumes persist unless removed deliberately. | The test owns a unique project and temporary bind mounts, then runs `down --volumes --remove-orphans` and deletes only its workspace. |
| [Docker Compose `cp`](https://docs.docker.com/reference/cli/docker/compose/cp/) | Compose supports copying files between a service container and the host. | The validator does not write into the read-only application root. Instead, its test-only overlay mounts verifier modules read-only before the container starts. |
| [Playwright best practices](https://playwright.dev/docs/best-practices) | Isolated state improves reproducibility and avoids cascading failures. | Provider acceptance stays synthetic, self-cleaning, and separate from the live walkthrough or peer content. |

## Options

### Reject a file based only on its `.flac` extension

Pros: trivial fixture and fast test.

Cons: proves neither inspection nor quality verification, and would validate
the unsafe behavior Harmoniarr is intended to prevent.

Decision: rejected.

### Store MP3 bytes under a `.flac` name

Pros: proves codec/extension mismatch detection.

Cons: the import-plan retention policy blocks it before the strict safe-add
quality gate runs. It cannot prove quality recovery from the intended boundary.

Decision: retained as focused delivery-quality coverage, rejected for this
end-to-end recovery proof.

### Use a valid but spectrally limited FLAC

Pros: reaches the real automatic add worker, ffprobe sees FLAC, the pre-add
spectral proof rejects the constrained frequency ceiling, and no public audio
is needed.

Cons: it models a lossy source repackaged as FLAC rather than a malformed
container.

Decision: adopted.

### Download peer content from a live provider

Pros: exercises a public peer-to-peer network.

Cons: nondeterministic availability, rights concerns, slow tests, and no safe
cleanup guarantee.

Decision: rejected for automation. Keep it for manual walkthrough acceptance.

## Final Recommendation Stack

1. Generate a genuine FLAC with content deliberately limited to 12 kHz and a
separate full-spectrum FLAC fallback in the temporary downloads mount.
2. Dispatch the higher-ranked limited-spectrum match through the real search,
enqueue, completion reconciliation, safe automatic add, and spectral gate.
3. Require the primary to end `failed`, record one `qualityBlockedCount`, and
start exactly one quality recovery when a second advertised lossless match is
available.
4. Run that fallback through the full pipeline and require it to be the only
additional library file.
5. Repeat with no fallback. Require `qualityRecoveryExhaustedCount: 1`, no
active follow-up download run, a failed primary, and an unchanged library.
6. Keep detailed candidate evidence in the verifier and normal user language
in Music Queue. The existing browser contract owns `Quality choice needed` and
the focused release handoff.

## Implementation

- `fixture-13` is `quality_recovery`: a high-ranked, spectrally limited FLAC
  and a lower-ranked, full-spectrum FLAC fallback.
- `fixture-14` is `quality_exhausted`: the same limited-spectrum condition
  without another match.
- The provider fixture exposes both candidates using the existing slskd
  response contract. It copies only generated files from the disposable mount.
- The verifier asserts that ffprobe reports `flac`, then uses the actual
  safe-add worker counters to verify quality block, recovery start, exhaustion,
  candidate final state, and isolated-library file counts.
- `import-candidate-apply-run-store` now exposes the already-persisted
  `qualityBlockedCount`, `qualityRecoveryStartedCount`,
  `qualityRecoveryRediscoveryCount`, and `qualityRecoveryExhaustedCount` to
  the existing summary and activity read paths.
- The test-only Compose overlay mounts the verifier modules at `/validation`
  as read-only. This replaces a command-line-serialized copy step that could
  exceed the Windows process argument limit and does not weaken the
  application container's read-only root filesystem.

## Security Boundary

- No live provider endpoint, peer content, walkthrough folder, or operator
  music root is referenced.
- Each run generates a random, process-local provider key and does not print
  it.
- The provider has no published port, drops all Linux capabilities, uses
  `no-new-privileges`, and writes only to the unique temporary downloads mount.
- The application test modules are mounted read-only; the verifier only removes
  the unique temporary workspace in its `finally` block.
- The result reports bounded counts and statuses, never a provider secret or
  raw external path.

## Validation

```text
node --test test/server/import-candidate-apply-run-store.test.js \
  test/scripts/docker-controlled-provider-pipeline-validation.test.js
npm run lint:server
npm run lint:scripts
npm run lint:test
npm run validate:docker-controlled-provider-pipeline -- --no-cache
```

The fresh Docker command passed with 15 synthetic fixtures, 17 ingested
matches, four verified library additions, failed-transfer and quality fallback,
completed-source recovery, and strict-quality exhaustion without a library
write.

## Next High-Value Item

Extend the controlled-provider harness with a persisted wanted-release and a
real Music Queue read-model assertion for strict-quality exhaustion. That will
prove the backend outcome becomes the user-facing `Quality choice needed`
release state and release-scoped Activity handoff without relying only on a
browser fixture projection.
