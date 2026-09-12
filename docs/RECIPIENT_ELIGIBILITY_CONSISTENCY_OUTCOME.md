# Recipient eligibility consistency outcome

Recorded September 12, 2026. See the separate [design and official-source research](RECIPIENT_ELIGIBILITY_CONSISTENCY_DESIGN.md).

## Implemented behavior

A narrow ESM store now coordinates transactional eligibility through existing user rows. Readers acquire ordered shared guards, then read joined account/profile data in a separate statement. Plex profile writers acquire conflicting `FOR NO KEY UPDATE` guards before insertion, refresh, relink, or removal. This covers both present and absent profiles, and avoids unnecessary conflicts with foreign-key key-share checks.

Request creation locks every selected recipient before rechecking eligibility inside its transaction. A recipient that became ineligible causes the entire selected family to fail before request/history/audit/planning writes. Reassignment inherits the guarded fresh reader. Existing eligibility rules and privacy-safe Activity remain unchanged; an early check or preview is not treated as commit-time authorization.

Linked-account reconciliation rereads current identity under its writer guard. Directory refresh and conflict relink compare a fresh guarded identity snapshot with the reviewed preview and return `plex_directory_preview_stale` when it changed. A stale directory refresh cannot overwrite a newly relinked profile. Network preview fetching remains outside database locks.

The implementation requires the platform's READ COMMITTED transaction default, which the owning transactions inherit. Customized database isolation defaults are outside this validation: REPEATABLE READ does not provide the fresh-command snapshot guarantee used here. User/profile state remains protected until the transaction ends. This is a local commit-time guarantee: later Plex revocation, remote preview freshness, and already committed request execution remain separate concerns. It does not change how an absent profile is classified by the existing policy or retroactively revoke previously accepted requests.

## Validation

- `node --test --test-concurrency=1 test/integration/recipient-eligibility-consistency.test.js` passed all 9 real PostgreSQL scenarios with zero skips: refresh/insertion before waiting reassignment; readers protecting existing/absent profiles; single/multi-recipient creation rejection; unlink blocking; stale-directory rejection; and batch writer versus reversed recipient-order creation.
- `npm run validate:security` passed image/topology policies and npm audit with zero reported vulnerabilities.
- Final focused service/store validation passed 99 tests, with zero failures or skips.
- Final `npm run test:server` passed all 3,426 server tests, including regressions added after the broader run began. Final test lint, hygiene, and copyright checks passed.
- `npm run validate` passed repository policies, lint, 8,124 tests at that run's discovery point (3,418 server, 4,205 client, 378 script, 123 integration), and client/server production builds. The final server rerun above includes all subsequent regression additions: the final suite totals are 3,426 server + 4,205 client + 378 script + 123 integration = 8,132 tests, all passing with zero skips.

The tests use injected Plex previews and the actual database-backed writer services. They do not call a live Plex deployment or change saved provider connections. No schema change was required; the snapshot remains at 99 migrations. This slice does not produce new immutable image or live-provider acceptance evidence.

Independent review found no remaining concrete blocker in the inspected lock order, profile writer coverage, stale-identity checks, or creation validation. It confirmed the READ COMMITTED requirement and the need to keep every future profile writer in the shared protocol.

## Open PR review

GitHub MCP returned three open PRs on September 12. Complete patches and current heads were reviewed. None was applicable, so no PR was applied locally or merged.

| PR | Reviewed head | Disposition |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Node 26 fixture conflicts with the retained Node 24 LTS baseline. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push action 7.2 is superseded by local 7.3. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata action 6.1 is superseded by local 6.2. |

## Next five priorities

| Priority | Recommendation | Benefit | Cost or limitation |
| --- | --- | --- | --- |
| 1 | Run final immutable candidate acceptance against published digests, verified provenance, and an accepted release baseline. | Validates the artifact users install and its upgrade path. | Requires registry access, selected baseline, and supported-platform evidence. |
| 2 | Complete live provider acceptance with saved eligible connections and a public test playlist. | Verifies real access, pagination, and provider behavior. | Depends on provider permissions, quotas, and deployment configuration. |
| 3 | Complete operator recovery acceptance for that exact candidate. | Demonstrates recoverable request/library state in the shipped runtime. | Requires an isolated rehearsal and retained evidence. |
| 4 | Measure representative large-library and multi-recipient contention workloads. | Establishes latency, lock-wait, pagination, and retention budgets. | Requires representative data and explicit release thresholds. |
| 5 | Review execution-time recipient eligibility after later access revocation. | Makes the policy for already accepted work explicit and testable. | Needs a defined distinction between accepted intent, new provider work, and existing acquired media. |

## Final recommendation stack

Retain Node 24 LTS, native ESM service/store factories, PostgreSQL 18 with explicit transaction ownership, ordered user-row guards, lock-first/read-second eligibility checks, strict transactional request lifecycle records, shared privacy projection, and existing Vue/native W3C-aligned feedback.

The shared parent-row protocol is recommended over profile-only or advisory locks because it covers absent profiles using an existing durable identity. Its tradeoff is additional SQL and waiting between conflicting operations; every profile writer must continue participating. Keep provider I/O outside locks and preserve stable batch order. The next release item is final immutable candidate acceptance; representative contention measurement is the next useful performance proof for this change.
