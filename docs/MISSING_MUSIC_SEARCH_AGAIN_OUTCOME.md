# Missing Music Search Again outcome

Implemented October 3, 2026. The separate
[design](MISSING_MUSIC_SEARCH_AGAIN_DESIGN.md) records researched sources,
alternatives, and the accepted command contract.

## Delivered behavior

The inspector now offers Search again for permitted `failed`,
`no_matches_left`, and `quality_choice_needed` releases. Its canonical POST
resolves ownership on the server and preserves own-account access for
non-administrators and household access for administrators. The browser sends
an empty body and uses the existing fresh-session, CSRF, and durable idempotency
contracts. The bounded response describes queued search preparation.

New small ESM policy, command, guarded transaction, and SQL-store modules reuse
the existing acquisition retry and operation dispatch infrastructure. Direct
wanted-ID lookup removes the former first-500 dependency. The write boundary
checks maintenance, locks target eligibility and owned wanted/discovery/link
rows, rereads current evidence, and atomically persists intent and its required
audit. A committed ready intent survives immediate dispatch failure so the
existing heartbeat can retry it.

Discovery remains shared by canonical release. Concurrent eligible target
commands coalesce, while each selected user's link records the current retry
cycle. A command for one target does not mark a sibling's link as requested.

Inspector reads now deduplicate, cancel obsolete responses, retain the current
snapshot after transient failures, and poll after completion at a 30-second
cadence. Hidden/disposed reads stop; visible focus revalidates. Commands and
the confirmation dialog pause background reads. Page Refresh updates both
decision surfaces and summaries. Current user-command results have accessible
status feedback; background refresh preserves keyboard focus.

The shared mutation composable prevents competing inspector commands,
retains keys for uncertain same-intent retries, and clears them when command,
match, or route intent changes. Public failures use fixed safe copy.

## Verification findings

Independent review caught two races, both fixed with regression cases:
navigating during a paused command could delay the new detail until polling;
changing match intent could replay an unresolved old idempotency result.
Browser acceptance also caught the disabled page Refresh button losing its
invoker's focus. Focus is now restored only when that invoker remains connected
and the user has not moved focus elsewhere.

Real PostgreSQL acceptance caught a missing `searchMode` in the enriched
discovery projection. Restoring that field lets retries recognize the current
shared cycle instead of treating queued work as an unsupported state.

## Validation

`npm.cmd run validate` passed all repository policy checks, all five lint
areas, test hygiene, both production builds, and 8,623 tests:

| Suite | Passed | Failures | Skips |
| --- | ---: | ---: | ---: |
| Server | 3,648 | 0 | 0 |
| Client | 4,304 | 0 | 0 |
| Scripts | 513 | 0 | 0 |
| PostgreSQL integration | 158 | 0 | 0 |

`npm.cmd run validate:security` also passed with zero reported vulnerabilities
after the three compatible dependency fixes. ESM consistency passed. No schema
change was made; the existing 104-migration snapshot remained current. The
combined validation log is retained locally at
`.tmp/canonical-actions-2026-10/validate.log`.

Focused client verification passed 41 tests with zero failures or skips.
The rebuilt targeted browser module passed all six scenarios: search command
and safe request shape, refreshed status/worklist, page Refresh and focus,
transient retained snapshots, safe failure and uncertain-key retry, permission
gating, and the retained match/download journeys. Independent patch review
found no remaining material issue in the reviewed code.

The browser command ran after `npm.cmd run build:client`:

```powershell
node --test --test-concurrency=1 test/browser/missing-music-decision-detail-browser-acceptance.test.js
```

Focused backend verification passed 76 tests, followed by a nine-test
module/store check. The three full-app PostgreSQL scenarios passed with zero
skips. They prove recipient ownership beyond 500 rows; fresh-session/CSRF and
out-of-scope refusal; same-key durable replay; disabled, maintenance,
missing-link, and active-state refusal; concurrent target coalescing; and
later-cycle marker refresh. Required audit and intent use one existing
transaction runner; a new audit-failure injection scenario was not executed.

The full-app focused command was
`node --test --test-concurrency=1 test/integration/missing-music-search-again.test.js`.
The standalone action replay and 20 release-script checks are recorded in
their separate PR outcome. Focused results overlap the combined suite and are
not added to its total.

## Recommendation stack and tradeoffs

| Layer | Final recommendation | Benefit | Cost or limit |
| --- | --- | --- | --- |
| Product surface | Canonical Missing Music commands and server permissions | Completes visible next steps with one ownership model | Each remaining action needs its own explicit eligibility contract |
| Client | Vue composables, shared command gate, bounded background revalidation | Keeps status current and retries coherent | Lifecycle and navigation races require focused tests |
| API/domain | Express ESM adapters and narrow injectable services | Reuses current platform and isolates policy from transport | More small modules and explicit dependency wiring |
| Persistence/work | Existing PostgreSQL transactions, locks, idempotency, operation queue | Durable target intent and coalesced shared work | Correct lock order and fresh projections remain essential |
| Tooling | Compatible dependency fixes and official immutable action pins | Addresses known advisories without a broad upgrade | Audit results are time-bound; local replay is narrower than hosted CI |
| AI workflow | Versioned canonical-actions skill | Carries these boundaries into the next action slice | One independent planning scenario is not exhaustive evaluation |

This stack retains the current Vue/Express/PostgreSQL/slskd architecture. No
additional queue or framework is justified by this slice. See the separate
[dependency outcome](DEPENDENCY_SECURITY_UPDATE_2026_10_OUTCOME.md),
[random PR outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md), and
[skill outcome](CANONICAL_ACTION_SKILL_OUTCOME.md) for their specific evidence.

## Remaining scope and next item

Next implement canonical quality-choice/fallback handling, beginning with a
guarded target-owned write and bounded quality evidence in the inspector.
The retained fallback store can mutate shared discovery without proving the
selected target link was updated; simply exposing its old endpoint would
repeat the ownership risk this slice closes. Apply the new canonical-actions
skill and the same PostgreSQL/session/browser validation pattern.

Initial Find matches, folder/setup repair, and safe library-add recovery remain
separate actions. The Home first-page cap and the planned quality-upgrade loop
also remain later work. Search preparation is not proof of a live provider
search, completed download, or safe library add. Controlled tests do not close
published-image, real-provider, or operational recovery gates.

Work is on main. No migration, branch, PR merge, tag, release, or workflow
dispatch is part of this change.
