# Music Queue Completed-Source Disappearance Docker Evidence

Status: **Implemented.**

Date: 2026-07-30.

This document completes the Docker-backed evidence follow-up from
[MUSIC_QUEUE_TERMINAL_MATCH_RECOVERY_DESIGN.md](MUSIC_QUEUE_TERMINAL_MATCH_RECOVERY_DESIGN.md).

## Problem

A download provider can report a successful completed transfer while the local
file is removed, relocated, or otherwise unavailable before Harmoniarr builds
its library-add plan. This is materially different from a provider-reported
transfer failure: the completed candidate has reached `import_pending`, but it
must never be added from a missing source or leave the release silently stuck.

The browser matrix already proves the calm, release-first presentation. This
slice proves the real service path with a controlled provider, PostgreSQL,
media inspection, safe-add planning, and isolated filesystem mounts.

## Official Sources Reviewed

| Source | Relevant guidance | Harmoniarr decision |
| --- | --- | --- |
| [Docker Compose `down` reference](https://docs.docker.com/reference/cli/docker/compose/down/) | `down --volumes` removes Compose-owned named and anonymous volumes; external volumes are not removed. | Every evidence run owns a unique project and temporary bind-mount workspace, runs `down --volumes --remove-orphans`, then deletes only that workspace. |
| [Docker Compose CLI reference](https://docs.docker.com/reference/cli/docker/compose/) | `-p` selects the Compose project lifecycle boundary. | Generate a unique project name per run so containers, network, temporary API key, and fixture data cannot overlap another environment. |
| [Node.js file-system promises](https://nodejs.org/api/fs.html) | `fs/promises` provides asynchronous filesystem APIs; concurrent modifications require deliberate ownership. | The verifier exclusively owns the test workspace and removes exactly one known synthetic source after its completion state is observed. |
| [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Use defense in depth, validate content, store files with least privilege, and do not trust filenames or file type alone. | A provider-completed source remains untrusted until the resolved local source exists and passes the existing inspection and safe-add gates. A missing file creates no library write. |
| [slskd configuration documentation](https://github.com/slskd/slskd/blob/master/docs/config.md) | Provider transfer state and completed-directory configuration are provider concerns. | The fixture is slskd-compatible only for Harmoniarr's used requests. It does not contact live peers, depend on public content, or reinterpret provider configuration. |

## Options

### Unit-test the recovery policy only

Pros: fastest and precise for a pure decision.

Cons: cannot prove the source is missing at the actual pre-add boundary,
durable candidate state changes, recovery-run creation, or library write
prevention.

Decision: retain focused unit coverage, but reject it as end-to-end evidence.

### Reuse provider-reported transfer failure

Pros: existing controlled fixture already proves automatic fallback.

Cons: bypasses the `import_pending` to pre-add transition; it cannot expose a
regression where a locally missing completed file is incorrectly added or does
not recover.

Decision: retain as a separate terminal condition, but reject it as proof for
this condition.

### Use a configured live slskd and peer content

Pros: reaches a real peer-to-peer provider.

Cons: non-deterministic availability, rights concerns, potentially slow
transfers, and no guarantee that generated data or cleanup stay inside the
test boundary.

Decision: reject for automated acceptance. Keep live-provider observations in
the local walkthrough only.

### Extend the controlled-provider Docker harness

Pros: exercises production service modules, real PostgreSQL, the actual
download mapping, inspection, recovery, and safe add. It can delete exactly
one generated file after a completed transfer and assert all side effects.

Cons: does not prove every slskd release's implementation details.

Decision: adopt.

## Final Recommendation Stack

1. Keep provider failure, missing transfer record, and missing completed source
   as distinct terminal observations.
2. Use a unique Compose project and temporary local mounts for every Docker
   acceptance run.
3. Generate short first-party FLAC tones only; never acquire public audio.
4. Remove the primary source only after the real worker records a completed
   provider transfer and before reconciliation constructs its safe-add preview.
5. Require a durable `source_disappeared` outcome, failed primary candidate,
   zero primary library writes, and a new run for a different eligible match.
6. Require the fallback to download, pass the existing inspection gates, and
   be the only additional file added to the isolated music root.
7. Tear down containers, volumes, and the temporary workspace on both success
   and assertion failure. Do not print API keys, filesystem paths, or provider
   credentials in the result.

## Implementation

The controlled fixture catalog keeps fifteen synthetic releases. Fixture 12
now represents `completed_source_disappears` and returns two lossless matches.
The higher-ranked match completes successfully; the lower-ranked match is an
eligible fallback. The fixture server copies only generated FLAC files from
the private test downloads mount.

`controlled-provider-pipeline-verifier.mjs` performs this evidence sequence:

1. Dispatch the release and confirm automatic selection of the higher-ranked
   primary match.
2. Run the real download worker and wait for the provider-completed transfer.
3. Confirm the exact generated source exists, remove it from the isolated
   downloads mount, and confirm the path is absent.
4. Reconcile the execution summary. The normal auto-add preflight must detect
   the missing source and persist `source_disappeared` rather than start an
   apply run.
5. Assert the primary candidate is `failed`, a different candidate has a
   follow-up download run, and the music-root file listing is unchanged.
6. Run the promoted fallback through real download reconciliation and safe
   automatic library addition. Assert exactly one new library file is present.

The existing provider-reported failed-transfer fixture remains intact. The
full harness therefore proves three successful isolated library additions:
the base automatic path, failed-transfer fallback, and completed-source
fallback.

## Security Boundary

- The provider fixture has no published port, drops all Linux capabilities,
  uses `no-new-privileges`, and has a read-only root filesystem.
- Its only writable location is the test's temporary shared downloads mount.
- The provider API key is generated in memory per run and is not logged.
- The verifier imports its own catalog and executes only inside the temporary
  Compose service. It never references walkthrough paths or any operator
  library.
- Source removal uses an exact fixture-derived path after an existence check;
  it cannot compute a path from a provider response or user-controlled name.
- Cleanup removes only the generated Compose project, its volumes, and its
  unique temporary workspace.

## Validation

```text
node --test test/scripts/docker-controlled-provider-pipeline-validation.test.js
npm run lint:scripts
npm run validate:docker-controlled-provider-pipeline -- --no-cache
```

The last command builds a fresh image and executes the complete controlled
provider path. Its `finally` block tears down the temporary Compose project
and workspace even when an assertion fails.

## Next High-Value Item

Completed in
[MUSIC_QUEUE_STRICT_QUALITY_DOCKER_EVIDENCE_DESIGN.md](MUSIC_QUEUE_STRICT_QUALITY_DOCKER_EVIDENCE_DESIGN.md).

Next, add a persisted wanted release to the strict-quality exhaustion fixture
and assert its actual Music Queue release projection and release-scoped
Activity handoff through the controlled-provider runtime.
