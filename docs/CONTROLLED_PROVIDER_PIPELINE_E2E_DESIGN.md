# Controlled Provider Pipeline E2E Design

## Status

Implemented on 2026-07-26. This document defines the deterministic, cleanup-safe proof for the automatic Music Queue path.

## Problem

The previous Docker file-backed validation began with manually persisted candidates. It proved media inspection and safe library addition, but it did not prove that a real provider search produces candidates, that an eligible result is automatically selected, or that the actual enqueue and transfer-reconciliation contracts lead to an import.

Live Soulseek is the wrong acceptance-test dependency: results, availability, queue timing, and rights are outside Harmoniarr's control. The test must also never write to an operator's configured music or download folders.

## Research

- [Docker Compose overview](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-docker-compose/) documents Compose as the service definition and lifecycle boundary used for the isolated application and provider containers.
- [Docker volumes](https://docs.docker.com/engine/storage/volumes/) documents that data lifecycle is independent from a container by default. The validation therefore uses a fresh temporary host workspace and runs `docker compose down --volumes --remove-orphans` before deleting that workspace.
- [Playwright best practices](https://playwright.dev/docs/best-practices) recommends isolated tests and explicit setup/teardown. The same principle applies here: every run owns its project name, mounts, credentials, and cleanup.
- [FFmpeg audio filters](https://www.ffmpeg.org/ffmpeg-filters.html) documents `aevalsrc`, which generates the short synthetic tone used for controlled lossless media evidence. No third-party recordings are downloaded or retained.
- [slskd configuration](https://github.com/slskd/slskd/blob/master/docs/config.md) is the authoritative configuration reference for the external provider. The fixture intentionally implements only the request shapes Harmoniarr already uses, rather than guessing undocumented behavior.

## Options

### Live provider acceptance test

Pros: proves a real peer-to-peer service connection.

Cons: nondeterministic results, long waits, rights concerns, possible writes outside the test workspace, and no reliable cleanup guarantee.

Decision: retain for manual operator walkthroughs only. Do not automate content acquisition from it.

### Manually seed a candidate

Pros: fast and stable.

Cons: bypasses search response normalization, automatic selection, and provider enqueue behavior.

Decision: retain the existing file-backed test for focused safe-add coverage, but not as end-to-end evidence.

### Controlled slskd-compatible provider fixture

Pros: uses the real Harmoniarr client/service/dispatch/selection/enqueue/reconciliation/apply modules; has deterministic responses; can prove delayed response polling; and owns all generated files.

Cons: validates Harmoniarr's provider contract, not every behavior of a live slskd release.

Decision: adopt as the primary automated pipeline acceptance test.

## Recommendation Stack

1. Run `npm run validate:docker-controlled-provider-pipeline -- --no-cache` for a fresh image, real production service path, and cleanup proof.
2. Keep `npm run validate:docker-file-backed-music-queue` as focused media-inspection and safe-add coverage.
3. Use the local walkthrough with a separately configured provider only for manual connection and operational observations.
4. Keep all peer credentials and provider configuration out of test logs and source. The controlled test uses a random process-local API key.

## Fixture Matrix

The catalog has 15 explicitly synthetic artist/release records, divided across headliner, established, and emerging ranking tiers. Those labels exercise display and ranking shapes only; they do not represent real artists.

| Tier | Fixture count | Formats | Purpose |
| --- | ---: | --- | --- |
| Headliner | 5 | FLAC, ALAC, WAV, MP3 | delayed lossless response, lossless preference, and high-quality fallback shapes |
| Established | 5 | AAC, Opus, OGG, FLAC | lossy policy, claimed-lossless, and locked-file shapes |
| Emerging | 5 | FLAC, ALAC, WAV, MP3 | normal response, fallback, and no-response diagnostics |

Only the first FLAC fixture is downloaded and added. The remaining catalog entries exercise real search-response normalization and ingestion without copying media. This limits run time and keeps the proof focused while still testing every fixture input.

## Quality Handoff Decision

An advertised FLAC, ALAC, or WAV result can now enter automatic download handoff for a lossless profile. It remains ineligible for automatic library addition until the downloaded file passes actual media inspection and spectral proof. This removes a circular deadlock where the application demanded post-download evidence before it would download a file, while preserving the strict anti-transcode library gate.

## Cleanup and Security

- The validation creates a unique temporary directory for app data, downloads, music, staging, and transcode files.
- The provider fixture is an internal Compose service with no published ports.
- It runs read-only except for the ephemeral shared downloads mount, drops Linux capabilities, and uses `no-new-privileges`.
- It accepts only a random API key generated for the process and never prints it.
- Teardown removes the Compose project and volumes, then recursively deletes the unique workspace even after a failed assertion.
- The test never references the live walkthrough, external slskd endpoint, or an operator-owned music directory.

## Outcome

The new validation proves this production path:

`discovery request -> provider search -> delayed response polling -> candidate ingestion -> automatic quality-aware selection -> enqueue -> completed transfer reconciliation -> media inspection -> safe automatic library add`

It also verifies a no-response case produces bounded ingestion diagnostics instead of a candidate.
