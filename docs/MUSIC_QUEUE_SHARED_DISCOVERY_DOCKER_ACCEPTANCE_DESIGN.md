# Music Queue Shared Discovery Docker Acceptance

Status: **Implemented.**

Date: 2026-07-30.

This document turns the shared-discovery correlation design into packaged-runtime
acceptance evidence. It extends
[OPERATOR_SHARED_DISCOVERY_CORRELATION_FANOUT_DESIGN.md](OPERATOR_SHARED_DISCOVERY_CORRELATION_FANOUT_DESIGN.md).

## Problem

One metadata release can be wanted by more than one household operator. The
system must perform provider work once while each operator retains a private,
release-scoped Music Queue result. Focused unit and database integration tests
proved the data model, but they did not prove the assembled Docker runtime
started exactly one provider search and transfer or that the real provider
boundary did not reintroduce policy leakage.

## Official Sources Reviewed

| Source | Relevant guidance | Harmoniarr decision |
| --- | --- | --- |
| [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) | Dependency order alone does not establish readiness; health conditions make startup dependencies explicit. | Keep the controlled provider in the existing Compose validation stack, define its internal health check, wait for Compose health, then run the verifier inside the packaged application container. |
| [Docker volumes](https://docs.docker.com/engine/storage/volumes/) | Volume data outlives containers unless explicitly removed. | Use a unique temporary bind-mounted workspace per run, remove the Compose project with volumes, then recursively remove the workspace in `finally`. |
| [PostgreSQL `SELECT`](https://www.postgresql.org/docs/current/sql-select.html) | `SKIP LOCKED` is suitable for queue-like consumers but does not provide a globally consistent queue view. | Assert one claimed shared request and one provider operation in an isolated database rather than inferring deduplication from concurrent test timing. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Enforce least privilege, deny by default, and test authorization for every object reference. | Exercise both cross-operator Music Queue detail reads and require the established `404 music_queue_release_not_found` result. |
| [OWASP Insecure Direct Object Reference Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) | Object identifiers must be authorized for each user, including guessed identifiers. | Use each operator's valid ID against the other operator's wanted-release ID; opaque UUIDs are not treated as authorization. |
| [Node.js test runner](https://nodejs.org/api/test.html) | Tests should use isolated asynchronous execution with explicit completion and timeout behavior. | Keep deterministic generated media, bounded polling, and a machine-readable verifier result so Docker evidence fails closed. |

## Options Considered

### Infer deduplication from database candidates

Pros: no provider fixture change.

Cons: it cannot prove the provider received one search or accepted one
transfer; a retry or duplicate provider request could remain invisible.

Decision: rejected.

### Use a public metrics endpoint on the provider fixture

Pros: simple to inspect from a host test.

Cons: unnecessarily exposes test observability outside the Docker network and
does not exercise the packaged application container.

Decision: rejected.

### Add an internal, API-key-protected fixture evidence endpoint

Pros: directly counts deterministic provider searches and accepted transfers;
the verifier calls it from the packaged application container; no production
route or host port is added.

Cons: test fixture code gains a narrowly scoped observability surface.

Decision: adopted.

## Final Recommendation Stack

1. Seed one metadata release, one global automatic discovery request, and two
   distinct operator-owned wanted releases linked by the durable junction
   table.
2. Give each link an intentionally distinct private policy marker, then
   require the candidate to contain only the strict shared profile and the two
   release correlation IDs.
3. Use a normal generated FLAC fixture and call the actual search, automatic
   selection, transfer, and completed-transfer reconciliation services.
4. Read provider evidence before and after the scenario; require deltas of
   exactly one search and one accepted transfer.
5. Read each operator's Music Queue detail through the production scoped
   service; require both to reach `Ready to add` with the same safe next
   action.
6. Attempt both cross-operator release reads and require object-level 404
   responses.
7. Wait for the real shared completion fan-out. Require two Activity rows, one
   per wanted release, without sibling correlation IDs, account IDs, or policy
   markers.

## Security Boundary

- `/_fixture/evidence` exists only in the controlled-provider test server. It
  requires the run-specific `X-API-Key` and the Compose overlay publishes no
  provider port to the host.
- The temporary API key is generated for each validation run and never written
  to the repository or evidence payload.
- The verifier is run inside the `harmoniarr` container against the packaged
  server modules and real PostgreSQL schema, not mocked application services.
- The fixture catalog uses synthetic artist/release names and generated tones.
  The validation runner removes all generated downloads, music files, Docker
  volumes, containers, and temporary directories on completion.
- Candidate evidence may include wanted-release IDs solely for durable shared
  release correlation. It excludes operator account IDs, link evidence, and
  private fallback or quality-policy values. Activity fan-out retains only the
  event's own release handoff ID.

## Implementation Outcome

- `testing/docker/controlled-provider-fixture-server.mjs` exposes a
  test-only authenticated counter for one fixture's search and transfer
  operations.
- `controlled-provider-pipeline-verifier.mjs` seeds two users with one shared
  wanted metadata release and two link-local policy markers. It proves one
  provider search, one transfer, two scoped `Ready to add` Music Queue
  projections, reciprocal 404 detail-read denials, and sanitized candidate and
  Activity payloads.
- `docker-controlled-provider-pipeline-validation.js` generates the additional
  deterministic FLAC source and fails closed unless the shared-discovery
  evidence summary is complete.
- The acceptance run exposed a stale execution-item status: reconciliation
  changed a candidate to `import_pending` but retained the initial `queued`
  run-item status. The new migration expands the terminal provider-state
  vocabulary and repairs persisted snapshots; reconciliation now writes the
  current provider outcome. Music Queue can therefore project `Ready to add`
  truthfully, and diagnostics label completed, downloading, failed, missing,
  and rejected transfers consistently.
- The verifier reads the exact run ID it started before reconciling provider
  state. It does not use a global "current run" summary, which can legitimately
  move to a recovery run after a terminal transfer outcome.
- The Docker run also exposed a normal lease-contention race: a duplicate
  execution-worker invocation previously marked a run failed when another
  worker already owned its lease. The worker now exits without changing or
  releasing a lease it did not acquire; a focused regression test prevents a
  concurrent scheduler and caller from converting normal coordination into a
  failed download.

## Validation

```text
npm run lint:scripts
npm run lint:test
node --test test/scripts/docker-controlled-provider-pipeline-validation.test.js
npm run validate:docker-controlled-provider-pipeline -- --no-cache
```

## Next High-Value Item

Add a two-session browser acceptance journey for a shared Music Queue release.
It should sign in as each operator separately, verify that both normal Music
Queue views receive the shared status and own Activity handoff, and verify that
a copied release-detail URL returns the normal not-found state for the other
operator. This closes the remaining UI and route-layer gap after the packaged
provider/runtime proof.
