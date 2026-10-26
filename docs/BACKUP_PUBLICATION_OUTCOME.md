# Backup publication outcome

October 25, 2026. See [design and tradeoffs](BACKUP_PUBLICATION_DESIGN.md),
[official-source research](BACKUP_PUBLICATION_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_BACKUP_PUBLICATION_OUTCOME.md).

## Result

Backup promotion now creates an exclusive hard link rather than renaming over a
destination. A destination created in the verification/publication gap is held
for confirmation; its bytes and the temporary backup are preserved, and no
inventory row is published. Final verification precedes temporary-name cleanup.
Cleanup requires regular files with matching bigint device/inode identities;
unrelated temporary files are preserved. An absent temporary name remains valid
for legacy rename records and already-cleaned recovery.

Production publish, delete and recovery share one PostgreSQL session advisory
owner. The scoped service uses that same pinned client for journal/catalog SQL,
including a pool configured for one connection. Phase writes remain autocommit.
Competing mutations return a fixed conflict; competing recovery reports ownership
busy explicitly. Ownership checks refuse future mutation admission after a lost
connection. Work settles before unlock/release; lost, uncertain-acquisition and
failed-unlock sessions are discarded. Original work Error/null takes precedence
over cleanup failure.

Two small ESM factories separate session ownership and production composition
from the existing workflow, file service and SQL stores. This runs inside the
existing app. No schema, dependency, version, branch or release change.

## Validation and evidence

- A controlled baseline fixture observed `ENOENT` for the destination, created
  unrelated destination bytes, then reproduced their replacement by baseline
  promotion. This is fixture evidence, not a reported production incident.
- All 27 focused service/store/export/ownership tests pass. They include exclusive
  collision preservation, unsupported-link refusal, temporary identity mismatch,
  lock lifetime, busy admission, uncertain acquisition and error precedence.
- Every fast-gate stage passes on the frozen source, with the full server suite
  invoked explicitly as `node --test --test-concurrency=8 "test/server/**/*.test.js"`.
  Totals: 6,031 server, 4,485 client and 700 script tests; zero failures, skips or
  cancellations. Lint, baseline/migration/schema/ESM/image/topology/hygiene checks
  and build pass. This is a bounded equivalent invocation, not a claim that the
  unchanged `npm run validate:fast` command was executed. Server wall time was
  about 74 seconds; it is not a general CI performance benchmark.
- The new native publication entry and existing journal-failure entry pass on
  the final image in separate networkless, read-only 3 GiB/two-CPU containers,
  with disposable PostgreSQL and read-only source mounts. Packaged module bytes
  independently match those sources. Actual PostgreSQL/filesystem proof covers
  destination collision, interruption after linking, dual-name recovery, foreign
  temporary preservation, competing production operations and a one-client pool.
  A terminated qualification backend cannot perform a later link or regress the
  replacement owner's completed journal. Advisory locks and helpers retire.
- A disposable probe using the packaged file service also passes on the live
  configured backup root: exclusive linking, same-inode cleanup, collision byte
  preservation and mode `0600`. Its directory is removed. This is file-service
  capability proof, not a full live backup/restore execution.
- Exact source/test and packaged-runtime review retains 44 unrelated native
  entries (including structured filesystem failures), 42 SQL checks, eleven
  recent and nine earlier review browser checks, and controlled-provider and
  file-backed evidence. These are retained proofs, not new executions. Native
  codec allocations and unrelated SQL/browser matrices were not repeated.

Frozen source: 3,531 files,
`d978fb0d5f27e1a4ba38738b55dcb95fa4c2d749203b91c42be0aaec32af2c3a`.
Private logs, manifests, baseline reproduction, inventories and final audit are
under `.tmp/backup-publication-2026-10-25/`.

GitHub MCP found no open PRs for `cloudbyday90/Harmoniarr` on the initial and final
checks. No PR was available to apply, rebase, close or merge. Work stays on `main`.

## Recommendation stack and limits

Adopt durable journal intent → one shared session owner/pinned client → exclusive
link → byte/manifest verification → inode-owned cleanup → catalog/completion.
The benefit is preservation and recoverability across cooperating operations; the
cost is serial backup work and a hard-link-capable filesystem. Unsupported links
fail closed. The design document compares alternatives and their pros/cons.

Destination creation is atomic on the qualified filesystem. The overall
filesystem/SQL workflow is not atomic or power-loss qualified. Trusted storage
directories remain required; arbitrary same-UID pathname replacement is not fully
fenced. W3C guidance informs distinct busy/held/completed states; there is no new
UI, screen-reader or physical-device acceptance claim.

## Next recommended item

Completed for the current process by the [I/O drainage outcome](BACKUP_IO_DRAIN_OUTCOME.md),
which owns the current follow-up and qualification limits. Original recommendation:

Qualify connection loss **during already-admitted filesystem work**, especially
deletion, before choosing a stronger ownership/drain protocol. The current native
test terminates the owner before link admission. PostgreSQL releases a lost
session's lock, while a previously admitted OS call can still settle; checking
the connection cannot retroactively cancel it. Add a held-I/O replacement-owner
fixture, preserve both outcomes and use that evidence to decide the next guard
inside the existing application. Do not infer distributed fencing from this work.

Separately, profile slow test fixtures and compare bounded runner settings before
changing the default fast gate. This task keeps native qualification opt-in and
avoids repeating unchanged broad matrices.
