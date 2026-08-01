# Music Queue Safe Add Docker Recovery Acceptance

Status: **Implemented and validated.**

Date: 2026-08-01.

## 1. Purpose

The release-scoped safe-add recheck has focused service, route, and browser
coverage. This acceptance slice proves the same safety model in a packaged
Harmoniarr container with real mounted files, FFmpeg/FFprobe inspection,
embedded PostgreSQL, and the durable operation-run worker.

It covers a completed download that exists in the Docker-mounted downloads
folder but is initially unreachable through an incorrect provider-to-container
path mapping. After that mapping is repaired, Harmoniarr must resume only that
one failed release. A library collision and a strict lossless-quality stop must
remain in review and must not create a new automatic add run.

## 2. Official Sources Reviewed

Sources were reviewed on 2026-08-01 against the requested June 2026 baseline.

| Source | Design input |
| --- | --- |
| [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) | Bind mounts are appropriate when the host and container must share completed downloads. They are writable by default, so the acceptance fixture uses an isolated temporary host directory and cleanup. |
| [Docker storage](https://docs.docker.com/engine/storage/) | Container writable layers are ephemeral; mounted storage is required to prove the same completed-download data is visible to the packaged runtime. |
| [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) | A health-confirmed startup is required before fixture generation or verification. The existing validator uses Compose `--wait` and the application health endpoint. |
| [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | File names and claimed extensions are insufficient evidence. The fixture retains actual FFprobe and spectral quality checks before any library mutation. |
| [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) | The acceptance proof verifies the server derives the recovery candidate from the release scope; it does not submit paths or candidate identifiers as user-controlled inputs. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Unit-test only the scoped recheck service | Fast and focused. | Cannot prove Docker mount visibility, deployed media tools, real PostgreSQL persistence, or operation-worker scope. | Reject. |
| Add a separate Compose stack for recovery only | Fully isolated naming. | Duplicates the maintained file-backed runtime harness and increases drift. | Reject. |
| Extend the existing file-backed Music Queue validator with a recovery acceptance matrix | Reuses the packaged image, temporary mount lifecycle, health gates, real media fixtures, and cleanup while adding the missing recovery proof. | Makes one verifier broader and requires clear scenario boundaries. | Adopt. |

## 4. Final Recommendation Stack

1. Create disposable host directories for downloads, music, staging, and app
   data, then mount them into the canonical Compose deployment.
2. Generate real lossless and transcoded FLAC fixtures inside the packaged
   Harmoniarr container after it is healthy.
3. Seed an operator-owned wanted release and candidate context through the real
   PostgreSQL schema.
4. Configure a deliberately incorrect provider-to-Harmoniarr mapping so the
   completed source is mounted but unreachable by its reported provider path.
5. Verify the automatic add stops as `source_path_unavailable`, leaving the
   candidate failed and creating no broad apply run.
6. Repair the mapping, invoke the release-scoped recheck, inspect persisted
   operation input for one candidate only, and run the real apply worker.
7. Verify only the repaired candidate is added; an unrelated ready candidate
   remains `import_pending` and untouched.
8. Verify a collision and a strict lossless-quality failure return the same
   review-only result, remain failed, and do not create automatic add runs.

## 5. Security And Cleanup Rules

- The verifier uses generated UUIDs and temporary directories; no personal
  library or provider data is mounted.
- It passes no candidate ID or filesystem path through a browser/API boundary.
  The recovery service resolves the candidate from the authenticated
  wanted-release scope.
- Assertions inspect raw database state only inside the disposable verifier;
  no raw paths, operation inputs, or source-user identifiers are exposed by
  application endpoints.
- `finally` always tears down the Compose project, removes volumes, and deletes
  the temporary host mount root, including on a failed assertion.

## 6. Acceptance Matrix

| Scenario | Expected result |
| --- | --- |
| Fixed mapping with a real lossless FLAC | Exactly one scoped safe-auto run adds the repaired candidate. |
| Unrelated ready completed download | Remains `import_pending`; no library file or apply-run item is created. |
| Existing library target | Candidate remains failed and no new automatic add run is created. |
| Transcoded file that claims FLAC/lossless | Candidate remains failed and no new automatic add run is created. |

## 7. Validation Command

```powershell
npm run validate:docker-file-backed-music-queue
```

The command builds an isolated image by default. Use `--no-build` only with an
explicit locally available `HARMONIARR_FILE_BACKED_VALIDATION_IMAGE` tag.

## 8. Outcome

Implemented on 2026-08-01.

- The release diagnostic lookup now falls back to a bounded
  `source_path_unavailable` candidate event only when there is no apply-run
  outcome. It verifies wanted-release ownership first and returns only the
  allow-listed blocker code and candidate ID; event reasons, paths, and raw
  JSON remain private to diagnostics storage.
- The existing file-backed Docker verifier now seeds an operator-owned wanted
  release, simulates a completed provider folder with an invalid mapping, then
  repairs the mapping and proves the durable apply-run scope contains exactly
  that candidate. Its unrelated ready completed download stays
  `import_pending` and receives neither an apply-run item nor a library file.
- The same proof verifies a true FLAC succeeds, a transcoded file that claims
  FLAC remains quality-blocked, and an existing library target remains a
  collision review state. Neither review-only state creates an additional
  automatic apply item.
- `npm run validate:docker-file-backed-music-queue` passed against the
  packaged runtime. The validator stages its verifier through the disposable
  `/data/staging` bind mount because the application root filesystem is
  intentionally read-only, then removes the Compose project, volumes, and
  temporary host directories on completion.

The next complementary acceptance slice is a Docker-backed media-tooling
recovery test: make the audio-inspection prerequisite unavailable, restore it,
and prove the same one-release recheck behavior without widening the apply
scope.
