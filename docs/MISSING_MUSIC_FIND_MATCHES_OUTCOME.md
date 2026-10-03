# Missing Music Find matches outcome

Status: Implemented and locally validated
Recorded: October 3, 2026
Design: [MISSING_MUSIC_FIND_MATCHES_DESIGN.md](MISSING_MUSIC_FIND_MATCHES_DESIGN.md)

## Result and ownership

An eligible due, never-searched release now appears in the default action
worklist and exposes **Find matches** in its canonical inspector. The guarded
POST resolves the recipient on the server, records that recipient's initial
intent and required audit atomically, then requests existing discovery dispatch.
The refreshed decision leaves the action worklist and reports current progress.
Unavailable initial `search_now` actions project `nextAction: null` rather than
advertising a control that cannot be used.

The shared automatic request was already ready before the click. The command
does not create another search queue or reset the shared request's history,
counters, deadlines, quality preferences, or another recipient's evidence.
`searchPreparationStarted` identifies newly saved recipient intent;
`searchAlreadyQueued` describes the existing ready automatic request, including
on the first accepted click. A different-key saved intent is a truthful no-op
without another audit or dispatch. Same-key durable replay returns the original
response after state advances.

One pure initial-search policy drives permission, worklist classification, and
the owning write. It refuses missing links, prior candidates/search/recovery,
active handoffs, future dates/deadlines, manual requests, blocked work, ignored
or completed releases, unknown evidence, and disabled history. Requester and
operator actions remain in their own scope; administrators may act for a
household recipient. The route retains fresh-session, CSRF, rate limiting, an
empty body, and decision-scoped durable idempotency.

## Architecture and standards applied

New small ESM modules own initial eligibility, link intent persistence, the
guarded library command, its canonical adapter, and discovery-run coordination.
The client adds a narrow API wrapper/composable and reuses the shared mutation
gate, retry intent, refresh, and route/disposal guards. There is no migration,
new worker, or enlarged acquisition singleton.

Immediate discovery start now obtains the existing maintenance guard and a
transaction-scoped advisory lock before active-run lookup, creation, and required
audit. Failed audit rolls back creation. All discovery-run producers share the
creation lock; deferred recovery producers retain intentional future scheduling.
The proved property is coalescing concurrent immediate starters, not uniqueness
of every scheduled discovery run. Post-commit dispatch failure leaves accepted
ready work for the existing heartbeat.

| Practice | Owner and implemented behavior | Evidence and limit |
| --- | --- | --- |
| W3C keyboard/focus and WHATWG native controls | Native typed Find matches button; scoped focus ownership; meaningful Current status destination | Enter/Space, focus visibility and user-moved/background focus checked in Chromium. |
| W3C status guidance | Persistent polite/atomic feedback outside the busy status snapshot | DOM exists before message updates and has no busy ancestor. Actual assistive-technology announcement remains untested. |
| OWASP object authority and CSRF | Fresh-session route, server target resolver, locked current target eligibility | Cross-recipient forgery, CSRF, reauthentication, disabled/maintenance/stale refusals exercised. |
| IETF HTTP semantics and project durable replay | POST command with stable uncertain-retry intent | Lost-response retry retains the same key; same-key replay and different-key no-op proved. |
| PostgreSQL transaction/locking guidance | Selected-link intent/audit and immediate-run creation/audit under owning locks | Real rollback, concurrent recipients and worker-first/intent-first scenarios pass. |

The [design's official-source table](MISSING_MUSIC_FIND_MATCHES_DESIGN.md#official-source-research)
records discovered URLs and October 3 consultation. WCAG Understanding/APG and
OWASP guidance are distinguished from normative specifications and project
conventions. Six light/dark captures at 390, 800, and 1280 CSS pixels were visually
reviewed; the action and explanation are visible, focus is outlined, there is no
horizontal overflow, and the mobile control satisfies the project's 44-pixel
convention. This is not a full WCAG conformance or repository security audit.

## Executed validation

| Final focused boundary | Result |
| --- | --- |
| Server policy, guard, route, projection, dispatch and existing consumers | 125 passed, zero failed/skipped |
| Client API, normalization, presentation, mutation/retry and focus | 52 passed, zero failed/skipped |
| New real PostgreSQL Find matches scenarios | 5 passed, zero failed/skipped |
| Existing real PostgreSQL Search again/fallback-quality regressions | 10 passed, zero failed/skipped |
| Rebuilt canonical inspector browser acceptance | 11 passed, zero failed/skipped |

Complete `npm.cmd run validate` passed on the stable runtime source: 3,688 server,
4,328 client, 513 script, and 170 integration tests, totaling **8,699** with zero
failures/skips. Copyright, migration/schema policy, ESM consistency, image/topology
policy, all lint/test-hygiene checks, and both builds passed. The initial-search
browser fixture was subsequently aligned with the actual public queued status;
its final 11-case browser run and test lint passed without runtime changes.
`npm.cmd run validate:security` passed, including zero reported npm vulnerabilities.
Final staged diff and 101 local Markdown links across 12 documents passed checks.
Ignored full-gate/audit logs are under `.tmp/find-matches-2026-10/`.

Executed database/browser commands:

```text
node --test --test-concurrency=1 test/integration/missing-music-find-matches.test.js
node --test --test-concurrency=1 test/integration/missing-music-search-again.test.js test/integration/missing-music-fallback-quality.test.js
node --test --test-concurrency=1 test/browser/missing-music-decision-detail-browser-acceptance.test.js
```

The five new database scenarios cover actual paged action filtering beyond 500
rows; ownership/auth/replay and historical no-op; concurrent recipient intent
with byte-equivalent shared request state and one immediate dispatch; current
state refusals; both required-audit rollback boundaries and post-commit dispatch
failure; and real worker claim-first versus intent-first locking. Browser
scenarios cover worklist entry, keyboard, persistent status, competing-action
exclusion, uncertain retry, denied/disabled states, detail/worklist refresh,
navigation, and focus ownership.

Focused totals overlap the broader repository gate and must not be added to it.
Browser journeys use controlled public API fixtures with the real local app,
session and PostgreSQL runtime. They do not execute a live Soulseek search or
prove screen-reader announcement. Local captures are under ignored
`.tmp/missing-music-find-matches/`.

## Recommendation stack and tradeoffs

Keep the existing Vue/Express/Node 24 ESM/PostgreSQL platform and durable workers.
Use native semantic controls and narrow command/feedback modules in the client;
server-authoritative recipient policy and durable replay at the HTTP boundary;
transaction-owned intent/audit and current locks at persistence; and focused
browser plus real database evidence before the repository gate.

This stack preserves shared acquisition policy and avoids a duplicate queue. Its
cost is explicit initial-state evidence and coordinated writer participation.
Automated accessibility evidence covers selected browser behavior only. The
candidate-history EXISTS predicate is a conservative correctness check; this
slice does not establish its latency at production collection scale.

The practical [web-standards skill outcome](WEB_STANDARDS_SKILL_OUTCOME.md) and
[PR 24 local replay outcome](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md) separately record
their design, evidence, and limits. Development remains on main, without a
release, PR merge, hosted workflow dispatch, or image publication.

## Independent review and next work

Independent source review found no blocking correctness/security regression in
the policy, transaction/lock consumers, public projection, mutation lifecycle,
feedback, focus, or corresponding tests. This is a scoped review, not a full
security scan. It confirmed the immediate-dispatch concurrency limit above.

Next: canonical **library-add recovery**, starting with **Check the files again**
after media/tooling or folder repair. The worklist advertises `add_to_library` and
`recheck_library_add`, and acquisition already owns safe-add recheck/manual-add
services, but the canonical Missing Music module and inspector expose neither.
That leaves a downloaded release's final library failure without its own command.

Reuse those service owners through narrow recipient-authorized commands, current
measured-quality/filesystem eligibility, durable replay and required audit. Add
bounded refreshed outcomes and a Settings repair/return handoff before exposing
manual Add to library with its existing safety gate. Prove real staging/quality
and rollback behavior rather than bypassing failed verification or promising
completion from accepted intent. This has higher immediate value than another
search abstraction because the existing pipeline already supplies the work.
