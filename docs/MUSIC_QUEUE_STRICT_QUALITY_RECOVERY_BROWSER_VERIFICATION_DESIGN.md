# Music Queue Strict-Quality Recovery Browser Verification

Status: **Implemented.**

Date: 2026-07-26.

This document records the browser-level acceptance contract for a strict audio
quality failure after a download has completed. Harmoniarr should reject the
bad match, automatically continue with the next safe match when one exists,
and require a quality decision only when there is no safe successor. The normal
flow remains release-centered; raw match diagnostics stay behind intentional
advanced disclosure.

---

## 1. Official Sources Reviewed

| Source | Why it matters | Harmoniarr decision |
| --- | --- | --- |
| [Sonarr quality profiles](https://wiki.servarr.com/sonarr/settings#quality-profiles) | Home media automation needs deterministic profile and cutoff policy. | A `Lossless archive` stop remains strict: a failed verification cannot quietly fall back to a lossy match. |
| [Sonarr download clients and failed-download handling](https://wiki.servarr.com/sonarr/settings#download-clients) | A failed transfer should move to another eligible release rather than repeatedly retrying a known-bad result. | Harmoniarr blocks the failed match and continues with a separately eligible match when available. |
| [Playwright best practices](https://playwright.dev/docs/best-practices) | Browser tests should target user-visible behavior with resilient locators and independent test state. | The contract asserts release state, single user-facing actions, and release-scoped Activity handoffs rather than candidate implementation details. |
| [PostgreSQL `SELECT`](https://www.postgresql.org/docs/current/sql-select.html) | Concurrent queue claims need a deliberate locking boundary. | This browser slice relies on the existing operation-run recovery boundary; it does not create a second queue or direct browser mutation path. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Recovery history must remain useful without leaking sensitive provider data. | Activity assertions use release name, outcome, and Music Queue handoff only. Candidate IDs, source paths, provider responses, and credentials remain absent. |

---

## 2. Recommendations

1. Keep strict-quality failure terminal for the bad match.
   A file that fails verified lossless checks must not be retried or treated as
   an acceptable fallback.

2. Continue automatically only with an eligible successor.
   When the recovery service has promoted a safe next match, Music Queue should
   show `Trying another match` followed by `Downloading`; it should not pause at
   `Quality choice needed` because stale quality evidence still exists.

3. Preserve one clear terminal stop.
   When the recovery cascade has no eligible successor, Music Queue must show
   `Quality choice needed` with `Review quality choice`, not an empty queue,
   ambiguous retry control, or a Downloader handoff.

4. Keep Activity release-scoped and actionable.
   Recovery events explain that Harmoniarr is trying another match and link to
   Music Queue. A terminal quality event links to the selected release's quality
   decision. Neither route exposes raw match diagnostics by default.

5. Test engine semantics and browser presentation separately.
   The server recovery test verifies the durable failed/promoted/exhausted
   behavior. The browser test verifies the same outcomes are understandable in
   the user interface without duplicating server internals in the client.

---

## 3. Options Considered

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Stop for review after every strict-quality failure | Simplest visible state and lowest automation risk. | Forces a user into a workflow even when a safe next match already exists. | Rejected. |
| Requeue the same failed match | Smallest implementation change. | Repeats a known bad result and can loop indefinitely. | Rejected. |
| Promote the next quality-eligible match and present forward progress | Maintains strict policy while preserving automation. | Requires clear status precedence so stale failure evidence does not mask recovery. | Adopted. |
| Show raw match details in the normal release row | Gives maximum immediate detail. | Makes the primary workflow noisy and exposes source-oriented terms. | Rejected. |
| Keep compact release state with optional advanced diagnostics | Keeps normal operation understandable while preserving operator evidence. | Requires a deliberate extra step for deep inspection. | Adopted. |

---

## 4. Final Recommendation Stack

- `import-candidate-recovery-service`
  - marks the strict-quality failure before recovery;
  - excludes the failed match;
  - promotes only a quality-eligible match within the same release/search scope;
  - queues one existing follow-up execution run.
- `acquisition-pipeline-status-service`
  - projects `Trying another match` or `Downloading` when recovery is active;
  - retains `Quality choice needed` only when no safe successor is active.
- Music Queue
  - shows one release-level state and action;
  - sends recovery to a focused release review and live transfers to Downloader;
  - keeps matching and quality internals behind the existing evidence disclosure.
- Activity
  - uses plain-language, release-scoped recovery/quality events;
  - hands off to Music Queue rather than a candidate workbench.
- Acceptance tests
  - server test proves quality-recovery exhaustion performs no follow-up run;
  - Docker-backed Playwright test proves recovery to `Downloading` and the
    terminal quality stop in the normal user experience.

Security posture:

- recovery remains scoped by metadata release and source search identifiers on
  the server;
- the browser fixture contains no provider credentials or filesystem paths;
- Activity copy contains bounded outcome text only;
- normal UI assertions reject candidate wording and diagnostic links;
- the test uses the existing authenticated app runtime and provider-ready test
  fixture rather than opening a real provider connection.

---

## 5. Implementation Outcome

Added:

- `test/server/import-candidate-recovery-service.test.js`
  - proves a strict-quality failure remains terminal and creates no recovery
    execution run when no quality-eligible successor exists.
- `test/browser/music-queue-quality-recovery-browser-verification.test.js`
  - proves `Trying another match` automatically becomes `Downloading` with no
    manual candidate action;
  - proves release-scoped Activity gives an `Open Music Queue` recovery handoff
    and contains no candidate/diagnostic navigation;
  - proves recovery exhaustion remains `Quality choice needed`, offers only
    `Review quality choice`, and has no Downloader handoff.

Focused validation:

```text
node --test test/server/import-candidate-recovery-service.test.js
node --test test/browser/music-queue-quality-recovery-browser-verification.test.js
```

Both commands pass against the local Docker-capable browser runtime.

---

## 6. Next High-Value Item

Implement the remaining Activity-history browser contract: prove initial and
direct-route loads populate the timeline without manual refresh, filters keep
the release context intact, and each history event continues to hand off to
Music Queue, Downloader, Library, or Settings instead of advanced diagnostics.
