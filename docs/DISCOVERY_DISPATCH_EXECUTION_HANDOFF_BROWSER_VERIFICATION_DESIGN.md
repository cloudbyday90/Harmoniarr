# Discovery Dispatch Execution Handoff Browser Verification Design

Status: Implemented
Date: 2026-06-27
Owner: Library automation + Import Review

## Purpose

Wanted releases do not create Downloader activity by themselves. They must be
dispatched to Soulseek search, and returned search results must become Import
Review candidates before operators can select, download, and import media.

This design adds deterministic browser evidence for that handoff:

1. Wanted shows queued discovery work.
2. The operator starts discovery dispatch.
3. The client sends the protected dispatch mutation with CSRF.
4. Wanted refreshes to the latest completed dispatch run.
5. Import Review exposes the downstream candidate created from that dispatch.

## Research Sources

Official sources reviewed for the June 2026 implementation:

- slskd configuration documentation:
  https://github.com/slskd/slskd/blob/master/docs/config.md
- slskd relay/controller documentation:
  https://github.com/slskd/slskd/blob/master/docs/relay.md
- OWASP CSRF Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP API Security 2023 API5 Broken Function Level Authorization:
  https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/
- Playwright auto-waiting documentation:
  https://playwright.dev/docs/actionability
- Playwright locator documentation:
  https://playwright.dev/docs/locators

Relevant findings:

- slskd automation should be driven by explicitly configured API keys, not
  browser login credentials.
- The Soulseek network is not deterministic enough for required CI/browser
  proof; peer availability and search results vary.
- State-changing Harmoniarr routes remain admin-gated and CSRF-protected.
- Browser verification should use role/text locators and Playwright auto-waiting
  assertions instead of fixed sleeps.

## Options

### Option A: Live slskd End-To-End Browser Test

Run the real provider against a configured slskd instance and assert search
results appear.

Pros:

- Highest fidelity when a healthy Soulseek peer returns data.
- Exercises the real provider client.

Cons:

- Flaky by design because public peer availability changes.
- Requires external credentials and network state.
- Not suitable as a required browser test.

### Option B: Unit-Only Dispatch Service Tests

Keep validation at the server dispatch service and route levels.

Pros:

- Fast and deterministic.
- Good for query construction and candidate-ingestion contracts.

Cons:

- Does not prove the operator-facing browser path.
- Does not verify the manual Wanted action or Import Review handoff UX.

### Option C: Fixture-Backed Browser Execution Proof

Use the existing browser fixture system to model a configured slskd dispatch
returning one import candidate.

Pros:

- Deterministic in CI and local validation.
- Proves the user-visible flow from Wanted to Import Review.
- Verifies the client sends a CSRF header for the dispatch mutation.
- Avoids storing provider secrets in tests.

Cons:

- Does not replace optional live slskd walkthrough testing.
- Provider-client behavior still depends on lower-level service tests.

## Recommendation Stack

Use Option C as required validation, with Option A reserved for manual
walkthrough evidence when slskd is configured locally.

Implementation stack:

- Extend `testing/browser/wanted-browser-fixtures.js` with discovery-summary
  state and a fixture-backed `POST /api/v1/library/discovery-runs` response.
- Reuse the existing metadata/import-review fixture storage so the dispatch
  action can seed a downstream Import Review candidate.
- Add
  `test/browser/discovery-dispatch-handoff-browser-verification.test.js`.
- Keep the production mutation path unchanged: the server route remains
  admin/fresh-session/CSRF protected.
- Fix singular discovery-summary copy while touching the dispatch summary
  contract.

## Implemented Behavior

The browser scenario proves:

- Wanted renders `Discovery dispatch` with ready work.
- `Run discovery now` sends one `POST /api/v1/library/discovery-runs` request.
- The recorded browser request includes `X-CSRF-Token`.
- Wanted refreshes to a completed run with dispatched and candidate counts.
- Import Review can load the candidate created by the simulated dispatch.

The summary service now renders singular ready copy as:

`1 discovery request is ready to search now.`

## Security Posture

- No slskd API key is stored in the browser fixture or documentation.
- The production dispatch endpoint remains server-side and protected.
- The browser test checks the client-side CSRF header without exposing token
  values in snapshots.
- Import Review candidate data stays fixture-local and does not depend on the
  public Soulseek network.

## Validation

Focused validation:

- `node --test test/server/library-discovery-summary-service.test.js`
- `node --test --test-concurrency=1 test/browser/discovery-dispatch-handoff-browser-verification.test.js`

The first browser run also surfaced overly broad text assertions; the final
test scopes repeated candidate text through stable Playwright locator behavior.
