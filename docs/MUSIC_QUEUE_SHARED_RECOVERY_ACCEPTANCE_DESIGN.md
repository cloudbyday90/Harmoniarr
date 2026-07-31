# Music Queue Shared Recovery Acceptance

Status: **Implemented.**

Date: 2026-07-30.

This document extends
[MUSIC_QUEUE_SHARED_DISCOVERY_DOCKER_ACCEPTANCE_DESIGN.md](MUSIC_QUEUE_SHARED_DISCOVERY_DOCKER_ACCEPTANCE_DESIGN.md)
with the failure-and-fallback branch of a shared Music Queue release.

## Problem

Two people can want the same release while the provider work remains global.
When the selected match fails, the retry must remain one bounded provider
chain, not one chain per person. At the same time, each person must retain a
separate wanted-release route, a safe `Trying another match` story, and a
subsequent `Downloading` story without seeing sibling IDs or private policy
data.

## Official Sources Reviewed

| Source | Relevant guidance | Harmoniarr decision |
| --- | --- | --- |
| [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext) | Independent browser contexts isolate cookies, storage, and authenticated sessions. | Exercise two real disposable user sessions in separate contexts; never simulate one identity by mutating client state. |
| [Playwright assertions](https://playwright.dev/docs/test-assertions) | Web-first assertions retry until their expected state is observed. | Assert semantic queue labels and handoffs, then wait for the normal polling transition instead of adding a test-only refresh control. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Enforce object-level authorization on every request and deny by default. | Keep direct Music Queue reads scoped by `appUserId`; test both valid cross-user IDs for generic 404 responses. |
| [OWASP IDOR Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) | Non-guessable identifiers do not replace authorization checks. | Treat a sibling's valid wanted-release ID as hostile input in Docker and browser acceptance tests. |
| [Node.js test runner](https://nodejs.org/api/test.html) | Tests should bound asynchronous work and clean up owned resources. | Use bounded Activity polling, a run-specific fixture API key, temporary generated media, and guaranteed Compose/workspace cleanup. |

## Options Considered

### Test only one operator after recovery

Pros: shorter scenario.

Cons: cannot detect a second provider retry chain, missing Activity fan-out, or
sibling-policy leakage.

Decision: rejected.

### Test only the provider retry counters

Pros: proves global deduplication.

Cons: does not prove either operator can understand the normal recovery story
or reach the appropriate Music Queue route.

Decision: insufficient alone.

### Combine packaged provider evidence and isolated browser sessions

Pros: proves the real provider and database chain once, then verifies the
two-session UI composition, polling, route handoffs, and redaction boundary.

Cons: two focused acceptance layers must remain aligned.

Decision: adopted.

## Final Recommendation Stack

1. Seed one global discovery request linked to two different operator wanted
   releases with intentionally different private policy markers.
2. Use a synthetic FLAC fixture whose higher-ranked provider match fails and
   whose next eligible match is valid.
3. Require one provider search, one failed primary transfer, one fallback
   transfer, and exactly one persisted recovery record.
4. After primary reconciliation, require both scoped Music Queue details to
   report `Trying another match` with the automatic recovery handoff.
5. Require one `music_queue_match_retrying` Activity row per wanted release.
   Each row may carry its own wanted-release ID only; it must omit the sibling
   ID, account IDs, and private policy markers.
6. Start the one promoted fallback run and require both scoped Music Queue
   details to reach `Downloading` plus one release-scoped
   `music_queue_download_started` Activity row each.
7. Use two isolated browser contexts to assert the same normal labels and
   Music Queue handoffs, then open the sibling's valid deep link and require
   the generic unavailable state.

## Security Boundary

- The production Activity feed is intentionally household-level history. This
  work does not claim it is per-operator authorization. Instead, it proves
  every fanned-out lifecycle row carries only its own release correlation and
  no sibling or policy data.
- Direct Music Queue detail remains the object-authorized boundary. A sibling
  wanted-release ID returns the existing generic
  `music_queue_release_not_found` response.
- The controlled-provider evidence route is test-only, API-key protected, and
  not published to the host. Its key is generated per run and never included
  in result payloads.
- Browser fixtures contain deliberate private markers solely to detect client
  disclosure. All disposable sessions, routes, generated audio, bind mounts,
  containers, volumes, and temporary directories are released after testing.

## Implementation Outcome

- Added a `shared_recovery_fallback` synthetic fixture with a failed higher
  ranked match and a valid fallback.
- Preserved the durable `selection_reason = recovery_cascade` fact as a narrow
  `recoverySelectedCount` read-model signal. Music Queue now presents
  `Trying another match` only for an automatically promoted fallback; an
  ordinary manual selection remains `Checking matches` with its normal action.
- The packaged Docker verifier now proves singular search/recovery/transfer
  counts, two `Trying another match` projections, two `Downloading`
  projections, two redacted recovery Activity rows, two redacted download
  Activity rows, and reciprocal scoped 404 reads.
- The verifier's Activity wait helper can now target a particular operation
  run, so a fallback's download-start event cannot be mistaken for the failed
  primary's earlier event.
- Shared browser read fixtures support a bounded sequence of release
  projections. The new two-context browser acceptance proves normal polling
  advances both sessions from `Trying another match` to `Downloading` without
  a manual refresh or candidate-first navigation.
- Added a lifecycle unit regression proving recovery fan-out removes
  `wantedReleaseIds` from each persisted Activity payload.

## Validation

```text
npm run lint:scripts
npm run lint:test
node --test test/server/music-queue-lifecycle-activity-event-service.test.js
npm run build:client
node --test --test-concurrency=1 test/browser/music-queue-shared-recovery-browser-acceptance.test.js
npm run validate:docker-controlled-provider-pipeline -- --no-cache
```

## Next High-Value Item

Completed in
[MUSIC_QUEUE_SHARED_BOUNDED_STOP_ACCEPTANCE_DESIGN.md](MUSIC_QUEUE_SHARED_BOUNDED_STOP_ACCEPTANCE_DESIGN.md).
The next item is shared-release manual restart acceptance: prove one owner's
`Search again` action safely resets the shared bounded stop once, starts no
duplicate provider work, and returns both scoped releases to their normal
automatic story without exposing or changing sibling policy.
