# Music Queue File-Backed Docker Acceptance Design

Status: **Implemented 2026-07-26.**

## Goal

Prove the high-risk boundary that cannot be established with in-memory or
host-only tests:

1. A completed transfer reaches persisted Music Queue reconciliation.
2. A genuine lossless file is inspected with the runtime's real `ffprobe` and
   spectral analyzer, then safely added to the library.
3. A file that claims to be FLAC but was derived from low-quality MP3 audio is
   stopped before library placement.
4. Both outcomes leave durable Activity evidence.

The proof deliberately does not depend on a public Soulseek peer. Network
search and transfer availability are not deterministic test fixtures. Instead,
it starts from a local completed transfer, which is the boundary Harmoniarr
owns after slskd has written files into the configured download directory.

## Research

| Source | Relevant guidance | Decision |
| --- | --- | --- |
| [FFmpeg ffprobe documentation](https://ffmpeg.org/ffprobe.html) | `ffprobe` exposes stream and container metadata in machine-readable output and returns an error for unreadable input. | The verifier uses the production image's real `ffprobe`, through the normal media-inspection service. |
| [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) | Compose can wait for a service health check before dependent work starts. | The disposable project waits for the Harmoniarr health check before generating files or invoking the verifier. |
| [Testcontainers for Node container guidance](https://node.testcontainers.org/features/containers/) | Bind mounts are less portable, particularly with remote or nested Docker engines; copying content is the safer test fixture mechanism. | The host streams one trusted ESM verifier into the runtime container's writable temporary filesystem. Test media is generated inside the container. |
| [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | File extensions and claimed content types must not be trusted by themselves; validate file content. | The negative fixture has a valid FLAC container and filename but an MP3-derived spectrum, demonstrating content-level quality validation. |

## Alternatives Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Host Node integration test with mocked media tooling | Fast and already used by most focused tests. | Cannot prove the production ffmpeg/ffprobe boundary because the development host need not contain those tools. |
| Public slskd/Soulseek end-to-end test | Exercises search and transfer infrastructure. | Depends on remote peers, account state, queue behavior, and network availability. It is unsuitable as a deterministic release gate. |
| Bind-mount generated fixture files into a container | Straightforward on one machine. | Fragile for Docker Desktop, remote Docker, and CI engines. It also makes host file permissions part of the test contract. |
| **Disposable Compose runtime plus in-container media generation** | Uses the released runtime, actual media tools, the real database, worker services, and persistent Activity rows while remaining deterministic. | Slower than a unit/integration test and requires Docker. |

## Final Recommendation Stack

1. Keep focused Node tests for policy branches and worker behavior.
2. Run `npm run validate:docker-file-backed-music-queue` for release-candidate,
   Docker-image, media-toolchain, or safe-auto-add changes.
3. Keep provider acceptance as a separate optional validation because it needs
   a configured slskd provider and is not deterministic enough to replace this
   file-backed proof.
4. Preserve public-peer testing as manual walkthrough evidence only.

## Implementation

`scripts/validate-docker-file-backed-music-queue.js` is the command entry
point. `scripts/docker-file-backed-music-queue-validation.js` owns the
disposable Compose project lifecycle:

- creates isolated app-data, downloads, library, staging, and transcode roots;
- generates ephemeral VAPID keys and a private Compose project name;
- builds or uses the requested Harmoniarr image;
- waits for `/healthz`;
- creates a high-frequency FLAC fixture and an MP3-derived FLAC fixture inside
  `/data/downloads` using the image's own `ffmpeg`;
- streams the ESM verifier into `/tmp` through the container's `node` process,
  then executes it;
- removes Compose containers, volumes, and the host workspace in `finally`.

`testing/docker/file-backed-music-queue-verifier.mjs` executes inside the
running image. It uses production modules and the embedded PostgreSQL database
to seed two selected matches, reconcile a completed transfer, start a safe
automatic add run, and drive the real worker:

- **Verified FLAC:** transitions to `applied`, appears under `/data/music`, and
  records `download_completed` plus `release_added` Activity events.
- **MP3-derived FLAC:** keeps its lossless filename/container claim but fails
  the real spectral proof, transitions to recovery state, never reaches
  `/data/music`, and records `download_completed` plus
  `music_queue_quality_blocked` Activity events.

The verifier does not expose an application route, accept external input, or
ship in the runtime image. The harness streams the repository-controlled
verifier to the existing writable `/tmp` tmpfs only for the validation run;
`docker cp` is intentionally not used because the production root filesystem
is read-only. The Compose project uses
the repository's existing non-root, read-only, dropped-capability deployment
posture.

## Operation

```powershell
npm run validate:docker-file-backed-music-queue
```

For a prebuilt image, set `HARMONIARR_FILE_BACKED_VALIDATION_IMAGE` and run:

```powershell
npm run validate:docker-file-backed-music-queue -- --no-build
```

The command is destructive only to its own generated temporary Compose project
and workspace. It never uses configured user folders, database data, provider
credentials, or an external slskd instance.

## Outcome

This is the release-facing proof for the deterministic completed-transfer
boundary. It complements, but does not replace, browser, provider, migration,
and unit/integration validation.
