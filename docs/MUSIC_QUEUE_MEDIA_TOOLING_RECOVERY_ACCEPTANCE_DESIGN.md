# Music Queue Media Tooling Recovery Acceptance

Status: **Complete.**

Date: 2026-08-01.

## 1. Purpose

Music Queue must not add a completed lossless download while audio inspection
cannot run. When FFprobe becomes available again, the existing release-scoped
safe-add recheck may resume that one release only after a fresh preview and the
strict quality gate pass. A library collision or suspicious-lossless result
must remain in review.

This acceptance slice proves that behavior in the packaged Harmoniarr runtime
with real audio files, FFprobe execution, embedded PostgreSQL, and the durable
apply worker. It deliberately simulates temporary FFprobe loss through a
disposable binary copy on the validator's staging bind mount; it never modifies
the packaged image or a user-provided media-tool installation.

## 2. Official Sources Reviewed

Sources were reviewed on 2026-08-01 against the requested June 2026 baseline.

| Source | Design input |
| --- | --- |
| [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) | Bind mounts are writable by default. The validator must use isolated temporary directories and must restore or remove every test artifact. |
| [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) | Fixture generation and validation must wait for the packaged service health check rather than infer readiness from container startup. |
| [FFprobe documentation](https://ffmpeg.org/ffprobe.html) | FFprobe provides machine-readable stream and container data, and returns a non-zero result when input cannot be opened or recognized. It remains the authoritative inspection prerequisite. |
| [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Claimed extensions and metadata are not enough; validate actual content with defense in depth before moving files into a library. |
| [OWASP OS Command Injection Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html) | Keep binary execution allow-listed and use argument arrays without a shell. The product's media command service already follows that rule; the validator must not weaken it. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Unit-test only the recheck service | Fast and precise. | Does not prove the packaged FFprobe, mounted audio, worker, or database behavior. | Reject. |
| Temporarily remove the system FFprobe binary from the container | Closely resembles a broken image. | Mutates the image filesystem, depends on container privilege, and risks cleanup failures. | Reject. |
| Inject a Boolean-only unhealthy status into the verifier | Simple and stable. | Does not prove the media command path observes a real unavailable executable. | Reject. |
| Use a copied FFprobe binary under the disposable staging mount | Exercises real status probing and real FFprobe inspection without touching the package or host installation. | Adds controlled fixture setup and restore work. | Adopt. |

## 4. Final Recommendation Stack

1. Start the disposable Compose deployment and wait for the health endpoint.
2. Copy the image's allow-listed FFprobe binary into the validator-owned
   staging mount and configure the verifier's media services to use that copy.
3. Remove only the staging copy before a completed download reaches safe add.
4. Verify reconciliation records the bounded `media_verification` /
   `audio_check_failed` stop before an apply run can begin, leaves the
   candidate failed, and writes no library file.
5. Restore the staging copy, verify media-tooling health, then invoke the
   release-scoped recheck.
6. Inspect the durable run scope, execute the worker, and verify that only the
   affected release reaches the library.
7. Recheck collision and suspicious-lossless releases after tooling recovery;
   they must remain review-only and create no new automatic apply item.

## 5. Security And Cleanup Rules

- Use a generated temporary Compose project and host mounts. Never use
  walkthrough downloads, the personal library, or the provider container.
- Do not accept a candidate ID, path, binary location, or run scope from a
  user-facing boundary. The release recheck resolves the owned candidate on
  the server and persists its one-candidate scope.
- Keep FFprobe execution through the existing allow-listed, shell-free media
  command service. The verifier copies a known package binary only into its
  isolated staging directory.
- Restore the copied binary before the recovery recheck. The outer validator
  removes its Compose project, volumes, and host mount root on success or
  failure, including when the verifier cannot reach the restoration step.

## 6. Acceptance Matrix

| Scenario | Expected result |
| --- | --- |
| FFprobe staging copy temporarily unavailable | No apply run is created; a bounded `media_verification` / `audio_check_failed` event leaves the release failed and no library file is created. |
| FFprobe staging copy restored | Recheck creates one candidate-scoped run and adds only the affected release. |
| Unrelated ready completed download | Remains `import_pending` without an apply-run item or library file. |
| Existing library target | Remains in collision review and creates no automatic apply run. |
| Transcoded file claiming lossless | Remains in quality review and creates no automatic apply run. |

## 7. Validation Command

```powershell
npm run validate:docker-file-backed-music-queue
```

## 8. Implementation Outcome

- The safe-auto boundary now recognizes `media_inspection_unavailable` as an
  environmental prerequisite stop rather than allowing the generic
  `ready_with_warnings` rejection to disappear without recovery metadata.
- The candidate transition persists only `media_verification` and
  `audio_check_failed`. It stores no source path, provider response, FFprobe
  output, or unbounded error text.
- The existing owned-release recheck consumes that bounded event after media
  tooling is healthy, re-previews the same candidate, reruns the strict
  quality gate, and queues one scoped apply run only when it is still safe.
- The Docker verifier now proves the unavailable and restored paths with a
  real executable loss, and separately asserts collision and strict-quality
  stops do not reopen.

Packaged Docker evidence passed on 2026-08-01 through
`npm run validate:docker-file-backed-music-queue`: real FFprobe loss stopped
the affected candidate, restored tooling rechecked and added that release only,
and the collision and strict-quality fixtures remained blocked.
