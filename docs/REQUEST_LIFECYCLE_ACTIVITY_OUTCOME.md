# Request lifecycle Activity outcome

Recorded September 12, 2026. See the separate [design and official-source research](REQUEST_LIFECYCLE_ACTIVITY_DESIGN.md).

Subsequent work: the [transactional lifecycle design](TRANSACTIONAL_REQUEST_LIFECYCLE_DESIGN.md) replaces best-effort cancellation/reassignment publication with a strict same-database commit. The historical results below describe the earlier repair; see the [new outcome](TRANSACTIONAL_REQUEST_LIFECYCLE_OUTCOME.md) for current guarantees and priorities.

## Implemented behavior

Successful cancellation and reassignment can now appear in household Activity as `Music request cancelled` and `Music request reassigned`. Both event types are registered across the server, PostgreSQL constraint, client normalization, filtering, and presentation. The forward-only migration brings the schema snapshot to 99 migrations and preserves all previously accepted event types.

A shared native ESM projection retains event, actor, request identifiers and time while excluding titles, artists, reasons, notes, provider URLs, recipient fields, and arbitrary payloads. It runs before optional publication, before database insertion, on feed reads, and in client normalization. Restricted request history retains its existing detailed information and authorization. Each event's native `Open requests` link opens the viewer's scoped list. No new ARIA feed role, live region, or focus movement was introduced.

The small publication helper contains synchronous exceptions, rejected promises, void returns, and pending callbacks so optional Activity delivery cannot change a successful mutation result. Cancellation remains an intent change, not evidence of media deletion or transfer termination.

## Verification

- Focused server/client tests passed for public projection, contaminated stored rows, labels, filters, and scoped links.
- Publisher and request-service regression tests passed: 53 tests, including callback failures and preservation of private audit/history behavior.
- Real PostgreSQL lifecycle integration passed all 4 tests without skips: successful routes, sequential no-ops, authorization/CSRF/fresh-credential failures, constraint enforcement, and unrelated household viewer privacy.
- Client production build and both Activity browser scenarios passed. The new scenario verifies generic rendering, Requests filtering, and keyboard activation of the scoped link.
- Schema snapshot refresh and isolated schema-bootstrap validation passed all 99 migrations.
- Security validation passed with zero reported vulnerabilities.
- Full `npm run validate` passed: 8,101 tests (3,417 server, 4,205 client, 378 script, 101 integration), zero failures or skips, repository checks, and production builds.

The aggregate `validate:database` command could not authenticate to its default local database: the configured SCRAM client password was not a string. It stopped during readiness checks. Isolated schema bootstrap and real PostgreSQL integration tests passed; the aggregate command itself is not reported as passing. No deployment credentials were changed.

Independent production review found no concrete blocker in privacy projection, publication handling, authorization, or navigation. These checks do not establish atomic delivery, concurrent-action serialization, or historical event recovery. This slice does not replay the prior 98-migration immutable container acceptance against the new 99-migration source.

## Open PR review

All three open PRs were reviewed through GitHub MCP; none contains an applicable update for this slice. No PR was merged or applied locally.

| PR and reviewed head | Finding |
| --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40), `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Node 26 fixture update conflicts with the retained Node 24 LTS release baseline. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24), `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push action 7.2 is superseded by local 7.3. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23), `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata action 6.1 is superseded by local 6.2. |

## Next recommendations and final stack

| Priority | Recommendation | Benefit | Cost or limitation |
| --- | --- | --- | --- |
| 1 | Make cancellation/reassignment state and restricted history transactional; design a recoverable, deduplicated Activity outbox. | Removes partial-write and lost-publication windows; supports deterministic retries. | Requires transaction ownership, concurrency tests, retry policy, and migration design. |
| 2 | Run immutable candidate acceptance for the final source and an accepted published baseline, including provenance. | Ties release evidence to the shipped artifact and real upgrade path. | Needs accessible registry artifacts and a selected baseline; prior local evidence is insufficient. |
| 3 | Complete live provider acceptance with saved eligible connections and a public test playlist. | Proves provider behavior beyond mocks and disabled-connection diagnostics. | Depends on provider access, quotas, and deployment configuration. |
| 4 | Complete operator recovery acceptance for the release candidate. | Demonstrates practical recovery with preserved request/library state. | Requires an isolated rehearsal and retained evidence. |
| 5 | Measure large-library and Activity retention behavior under representative load. | Establishes pagination, query, and migration-lock budgets. | Needs representative data and explicit release performance thresholds. |

Retain Node 24 LTS, modular ESM services, PostgreSQL 18 with database constraints and explicit transactions, Vue Composition API, shared public-event projection, authorized detailed request history, and native W3C-aligned controls. Add the transactional lifecycle/outbox design next; keep its delivery guarantees separate from this best-effort repair. Release approval still depends on candidate-specific acceptance, provider access, recovery, and scale evidence.
