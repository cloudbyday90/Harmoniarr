# Music Queue Strict-Quality Release Projection Docker Evidence

Status: **Implemented.**

Date: 2026-07-30.

This document completes the release-projection follow-up from
[MUSIC_QUEUE_STRICT_QUALITY_DOCKER_EVIDENCE_DESIGN.md](MUSIC_QUEUE_STRICT_QUALITY_DOCKER_EVIDENCE_DESIGN.md).

## Problem

The controlled-provider proof already showed that strict quality verification
stops an unsafe library add. It did not prove the durable result was visible to
the operator through the real Music Queue read model. A generic candidate or
execution state is insufficient: the user needs one release-centred stop,
`Quality choice needed`, and a safe Activity handoff back to that release.

The first implementation exposed a precedence flaw. The execution item remains
recorded as `queued` after transfer reconciliation, even after the candidate
later fails the safe-add quality gate. Treating that historical execution row as
live work caused Music Queue to say `Downloading` instead of surfacing the
terminal quality decision.

## Official Sources Reviewed

| Source | Relevant guidance | Harmoniarr decision |
| --- | --- | --- |
| [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) | A committed query result is a consistent view of committed data. | The Docker proof reads the public Music Queue service only after the apply worker completes; it does not infer a result from intermediate writes. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Logs and events need useful correlation while avoiding sensitive or unsafe data. | The Activity event uses the wanted-release ID and route only. Provider folder paths, usernames, credentials, and raw diagnostics do not enter the normal event payload. |
| [Playwright best practices](https://playwright.dev/docs/best-practices) | Isolated state and user-visible outcomes make tests reliable. | The provider fixture remains synthetic and disposable; the contract asserts the release-facing service output rather than a live peer or implementation-only table. |
| [Docker Compose overview](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-docker-compose/) | Compose owns repeatable multi-container lifecycle management. | The validator creates an isolated project and workspace, then removes containers, volumes, and generated files in `finally`. |

## Options Considered

### Assert only worker counters

Pros: fast and directly confirms the quality gate ran.

Cons: cannot prove a user sees a correct release state or follows Activity back
to it.

Decision: insufficient on its own.

### Query tables directly from the verifier

Pros: exact and simple to diagnose.

Cons: duplicates application read-model logic, bypasses authorization behavior,
and can pass while Music Queue shows an incorrect state.

Decision: rejected as acceptance evidence.

### Exercise Music Queue and Activity services with persisted data

Pros: validates the same scoped release projection and route payload consumed by
normal application routes while retaining deterministic fixture data.

Cons: requires a small temporary app-user and wanted-release seed in the
controlled provider verifier.

Decision: adopted.

## Final Recommendation Stack

1. Treat the claimed `library_wanted_releases.id` as the authoritative release
   correlation for an automatic discovery request. Preserve it in candidate
   Music Queue context, ahead of optional recovery metadata.
2. Project a historical execution row as active only when candidate state still
   says `downloading`. A selected recovery candidate remains current work;
   terminal quality evidence outranks stale `queued` execution evidence.
3. Assert Music Queue list and detail reads return the same persisted wanted
   release with `quality_choice_needed` and `review_quality_choice`.
4. Assert a different app-user cannot read that release.
5. Record the quality-block Activity event against the wanted release with an
   allow-listed `music-queue-release` route, and reject provider path or
   username fields from that normal payload.
6. Keep the end-to-end proof isolated and self-cleaning; never use live
   Soulseek content or a walkthrough music folder.

## Implementation

- `library-discovery-dispatch-service` now carries the claimed
  `wantedReleaseId` into automatic candidate context. The database relation is
  preferred over recovery evidence, which prevents stale JSON from replacing
  the current release correlation.
- `acquisition-pipeline-status-service` now checks active candidate state
  before historical execution state. A genuine fallback candidate in
  `downloading` continues to show `Downloading`; an exhausted quality failure
  with only a stale execution row shows `Quality choice needed`.
- The controlled provider verifier seeds one disposable app user and wanted
  release for strict-quality exhaustion, then reads Music Queue list/detail and
  the Activity feed through their ESM services.
- The verifier proves cross-user reads return the existing 404 contract, the
  release ID survives the pipeline, the Activity route points to that release,
  and no library file is written.

## Security Boundary

- Scope enforcement is asserted with a different random app-user ID. The
  verifier cannot use an unscoped release read.
- The Activity payload contains a release ID and allow-listed route parameters
  only. It excludes provider usernames, folder paths, URLs, and credentials.
- Fixture credentials are process-local and generated at run time. The test
  environment is removed even when an assertion fails.
- The normal read-model assertion uses durable committed state. It does not
  expose raw candidate, transfer, or provider diagnostics in the product path.

## Validation

```text
node --test test/server/acquisition-pipeline-status-service.test.js \
  test/server/library-discovery-dispatch-service.test.js \
  test/server/acquisition-pipeline-service.test.js \
  test/server/music-queue-quality-activity-presentation-service.test.js
npm run lint:server
npm run lint:scripts
npm run validate:docker-controlled-provider-pipeline -- --no-cache
```

All commands passed. The fresh Docker run verified 15 generated fixtures, 17
ingested matches, four safe library additions, recovery branches, and strict
quality exhaustion with no library write, a scoped Music Queue quality stop,
and a release-scoped Activity handoff.

## Next High-Value Item

Design and implement operator-scoped shared-discovery correlation fan-out. A
single global discovery request can serve several operators that want the same
release; the current claim attaches one deterministic wanted-release ID. The
next design should preserve shared provider work while recording each relevant
operator's release correlation, outcome, Activity visibility, and authorization
boundary without duplicating downloads or leaking one operator's policy.
