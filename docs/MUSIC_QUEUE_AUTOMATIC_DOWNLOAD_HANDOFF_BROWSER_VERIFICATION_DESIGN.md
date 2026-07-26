# Music Queue Automatic Download Handoff Browser Verification Design

Status: **Implemented.**

Date: 2026-07-26.

This document records the browser contract for the normal automatic path that
follows folder recovery: a release moves from searching to downloading when a
policy-compliant source is selected, and the user can open Downloader without
visiting diagnostics. It also documents the two safety stops that must not
produce a download handoff: an unacceptable quality result and a disabled
Soulseek provider.

---

## 1. Official Sources Reviewed

| Source | Why it matters | Harmoniarr decision |
| --- | --- | --- |
| [Radarr quality profiles](https://wiki.servarr.com/radarr/settings) | Quality profiles determine eligible releases and the quality cutoff for automatic media acquisition. | Treat the release quality policy as an eligibility gate before automatic selection; a strict lossless policy never hands an MP3-only result to Downloader. |
| [Sonarr quick start](https://wiki.servarr.com/sonarr/quick-start-guide) | The download client owns live transfer mechanics while the media manager owns desired releases and import lifecycle. | Music Queue links to Downloader for live transfer state rather than exposing candidate operations in the normal workflow. |
| [Playwright locators](https://playwright.dev/docs/locators) | User-facing, role-based locators are resilient and test accessible behavior. | Verify headings, buttons, links, status text, and a native transfer progress bar instead of component classes or timing delays. |
| [Playwright best practices](https://playwright.dev/docs/best-practices) | Web-first assertions reduce flaky end-to-end tests. | The test waits for the visible `Searching`, `Downloading`, quality, and Downloader states rather than using fixed sleeps. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Tests and observability should not expose credentials or sensitive provider payloads. | Browser fixtures contain bounded status, quality, and transfer projections only; no provider credentials, hostnames, or raw search payloads are asserted or persisted. |

---

## 2. Recommendations

1. Verify the normal product path at the release level.
   The normal user experience is `Searching -> Downloading -> Downloader`, not
   candidate selection. The test starts at Music Queue and confirms the
   `Open Downloader` route only appears once the release is downloading.

2. Keep decision logic and UI proof at separate boundaries.
   Server tests remain responsible for asserting candidate ranking, strict
   quality eligibility, provider readiness, and execution-run startup.
   The browser test verifies the resulting read model is clear and actionable.

3. Prove safety stops as negative handoffs.
   A strict lossless release with only below-minimum results must display one
   quality review action and no Downloader link. A disabled provider must show
   one bounded Connections handoff and no Downloader link.

4. Use Docker-backed browser execution with fixture-backed external state.
   The app and PostgreSQL runtime are real through the existing browser smoke
   runtime. The changing Music Queue and Downloader provider projections are
   deterministic fixtures, so a public Soulseek network response cannot make
   the assertion flaky or leak external data.

---

## 3. Options Considered

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Server tests only | Fast and precise for selection logic. | Does not prove the user sees the automatic path or correct route handoff. | Rejected as sufficient coverage. |
| Require users to choose candidates before Downloader | Makes each source visible. | Reintroduces the candidate-first workflow the Music Queue redesign removes. | Rejected. |
| Browser fixture of the release state and live transfer projection | Deterministic, validates routes and accessibility, and isolates third-party network behavior. | Does not prove a public peer will provide a file. | Adopted for the UI contract. |
| Browser test against a public Soulseek result | Closest to an uncontrolled deployment. | Nondeterministic, potentially slow, and unsuitable for automated tests. | Rejected. |

---

## 4. Final Recommendation Stack

- `import-candidate-auto-selection-service.js`
  - ranks reviewed candidates by composite score after the release quality
    policy removes ineligible matches.
- `import-candidate-auto-download-run-service.js`
  - requires enabled automatic downloads, validated folders, and a healthy
    provider before creating the candidate-scoped execution run.
- `library-discovery-dispatch-service.js`
  - records bounded selection and run-start evidence as part of a normal
    discovery dispatch.
- `MusicQueueView.vue` and `MusicQueueReleaseRow.vue`
  - show release progress and one primary next action; `Open Downloader` is
    only available for a downloading release.
- `DownloaderView.vue`
  - owns the live transfer list and progress display.
- `music-queue-automatic-download-handoff-browser-verification.test.js`
  - proves the normal handoff and both no-download safety stops in a
    Docker-backed browser runtime.

Security posture:

- browser fixtures never include API keys, provider addresses, real peer names,
  or raw provider payloads
- test assertions use public product text, accessibility roles, and bounded
  transfer fields
- strict quality and provider readiness are enforced by server code before the
  UI projection, not by client-side controls
- the test does not bypass authorization; it signs in through the existing
  operator bootstrap flow

---

## 5. Implementation Outcome

Added:

- `test/browser/music-queue-automatic-download-handoff-browser-verification.test.js`

The three scenarios verify:

1. A release starts as `Searching`, refreshes to `Downloading` with a
   `Lossless archive` quality profile, and reaches a visible active transfer in
   Downloader through `Open Downloader`.
2. A `below_minimum` strict-lossless result remains at `Quality choice needed`,
   presents `Review quality choice`, and has no Downloader handoff.
3. A disabled provider remains at `Needs setup`, presents `Test Soulseek` to
   Connections, and has no Downloader handoff.

This is intentionally not an Internet/Soulseek acceptance test. The existing
server tests prove the automatic selection and run-start calls; this browser
test proves those safe outcomes are understandable in the product UI.

---

## 6. Next High-Value Item

Implement a deterministic Docker walkthrough acceptance fixture for the
**post-transfer path**: a completed eligible download becomes `Ready to add`,
is inspected, passes the quality gate, enters the library, and appears as a
clear Activity event. Include one unsafe media case that stops with a single
repair action. That closes the remaining user-visible automation gap after the
Downloader handoff without depending on a public Soulseek peer.
