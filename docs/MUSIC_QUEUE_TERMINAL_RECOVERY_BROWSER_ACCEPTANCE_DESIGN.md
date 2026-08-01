# Music Queue Terminal Recovery Browser Acceptance Design

Status: **Implemented.**

Date: 2026-07-30.

This document completes the browser-acceptance follow-up from
[MUSIC_QUEUE_TERMINAL_MATCH_RECOVERY_DESIGN.md](MUSIC_QUEUE_TERMINAL_MATCH_RECOVERY_DESIGN.md).
It proves the normal, release-first presentation of terminal Music Queue
outcomes without depending on public Soulseek peers or making the candidate
workbench part of the routine workflow.

## Goal

The durable recovery service now classifies terminal outcomes safely. The
browser contract must prove that a person sees the correct result:

- a timed-out transfer advances automatically to another safe match;
- a completed source that disappears before library add advances automatically
  to another safe match;
- exhausted strict-quality recovery stops at a quality decision; and
- a library collision stops at a library-add decision.

The browser is not an authority for fallback eligibility. It validates the
already-projected Music Queue and Activity read models, plus the user-visible
handoffs they provide.

## Official Sources Reviewed

| Source | Relevant guidance | Harmoniarr decision |
| --- | --- | --- |
| [Playwright best practices](https://playwright.dev/docs/best-practices) | Test visible user behavior, isolate tests, control external dependencies, and use traces for failures rather than continuously recording every run. | Each matrix case receives an isolated browser/database scenario and mocks only first-party read APIs. Assertions use accessible text and roles rather than component internals. |
| [Playwright fixtures](https://playwright.dev/docs/test-fixtures) | Fixtures establish only the environment a test needs and are isolated between tests. | One ESM fixture pack owns terminal-outcome payloads; the shared browser runtime still creates an isolated scenario per case. |
| [Playwright assertions](https://playwright.dev/docs/test-assertions) | Web-first assertions retry until the visible state is ready. | Automatic fallback waits for Music Queue's normal polling transition instead of adding sleeps or pressing `Refresh`. |
| [Playwright network mocking](https://playwright.dev/docs/network) | Native routing can deterministically fulfill API traffic. | Fixtures replace only the Music Queue and Activity read models, never a live provider or transfer endpoint. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Event data should be sanitised and should exclude unnecessary sensitive values such as paths, network details, and secrets. | Browser payloads and assertions use release-scoped outcome codes only. They never include provider usernames, paths, peer responses, credentials, or raw exception text. |

## Acceptance Matrix

| Terminal outcome | Music Queue outcome | Normal action | Activity handoff | Must not appear |
| --- | --- | --- | --- | --- |
| Timed-out transfer | `Trying another match` becomes `Downloading` through polling. | `View recovery`, then `Open Downloader`; no user retry. | `Open Music Queue`. | Candidate controls, diagnostics, provider timeout text. |
| Completed source disappeared | `Trying another match` becomes `Downloading` through polling. | `View recovery`, then `Open Downloader`; no user retry. | `Open Music Queue`. | Candidate controls, file paths, provider source details. |
| Strict-quality recovery exhausted | `Quality choice needed`. | `Review quality choice`. | `Review quality choice` returns to the selected release. | Download/library-success actions or candidate navigation. |
| Collision before library add | `Needs help`. | `Review library conflict` opens the selected release; `Advanced diagnostics` is secondary. | `Review library add plan` returns to the selected release. | Automatic retry, library-success action, raw collision paths, candidate-first handoff. |

## Approaches Considered

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Reuse generic failed-transfer coverage only | Smallest test change. | Cannot prove timeout and disappeared-source policy remain distinct server outcomes with the same calm user experience; does not cover import collision stopping. | Reject. |
| One live-provider browser test | Exercises a real provider. | Peer availability, content, queues, and source state are non-deterministic; it could acquire real media. | Reject. |
| Four independent browser files with copied payloads | Strong isolation. | Repeats fixture data and browser setup, obscuring the common safety contract. | Reject. |
| One fixture pack with four isolated browser scenarios | Keeps the matrix explicit, reuses only deterministic payload construction, and preserves per-scenario database/browser isolation. | Adds a focused fixture module and acceptance suite. | Adopt. |

## Final Recommendation Stack

1. Keep terminal classification and promotion authority in the server-side
   Music Queue services.
2. Create one ESM browser fixture pack with stable release-only payloads for
   the complete terminal-outcome matrix.
3. Use each case in its own Docker-backed application scenario, authenticated
   through the real UI.
4. Mock only first-party read-model APIs and provider-health readiness.
5. Use accessible, retrying browser assertions for queue status, actions, and
   Activity handoffs.
6. Prove automatic fallback without a `Refresh` click; prove stop states have
   exactly one focused repair action.
7. Assert normal surfaces do not expose candidate terminology, raw provider
   data, filesystem paths, or diagnostics links by default.

## Implementation

`testing/browser/music-queue-terminal-recovery-browser-fixtures.js` provides
the four fixed terminal-outcome fixtures. It returns a fresh Music Queue
payload on every read and contains no credentials, network locations, or file
names.

`test/browser/music-queue-terminal-recovery-browser-acceptance.test.js` runs
each case in an isolated real application scenario. It verifies background
polling for the two safe automatic paths, release-specific stopping actions for
quality and collision paths, and the Activity-to-Music-Queue handoff. The
collision case verifies its direct library-add route without using candidate
navigation.

## Security Boundary

- The test never calls slskd, a peer, or a transfer mutation route.
- The temporary PostgreSQL database and browser context are created and cleaned
  by the existing integration runtime per scenario.
- Fixture event payloads carry only a release ID and a stable terminal-outcome
  code. They omit source identity, raw errors, paths, and secrets.
- Assertions explicitly reject candidate language and diagnostics links from
  the normal automatic and quality-stop surfaces.

## Validation

```text
npm run build:client
node --test test/browser/music-queue-terminal-recovery-browser-acceptance.test.js
npm run lint:test
npm run lint:client
```

Executed on 2026-07-30:

- the targeted browser suite passed all four matrix cases against real
  application sessions, isolated temporary PostgreSQL databases, and headless
  Chromium;
- `npm run validate` passed, including ESM consistency, migration/schema
  checks, all node and integration suites, and production builds; and
- `npm run validate:security` passed with zero reported npm vulnerabilities.

## Next High-Value Item

Implemented in
[MUSIC_QUEUE_COMPLETED_SOURCE_DISAPPEARANCE_DOCKER_EVIDENCE_DESIGN.md](MUSIC_QUEUE_COMPLETED_SOURCE_DISAPPEARANCE_DOCKER_EVIDENCE_DESIGN.md).
The controlled-provider harness now proves the real completed-source
disappearance path with disposable generated FLAC files, durable recovery, no
primary library write, and safe fallback promotion.

The next high-value item is a controlled-provider Docker proof for
strict-quality rejection before library add. It should complement this browser
matrix by exercising the actual quality gate and its safe stop on exhaustion.
