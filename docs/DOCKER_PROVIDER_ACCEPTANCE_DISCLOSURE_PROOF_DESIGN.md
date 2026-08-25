# Docker Provider Acceptance Disclosure Proof Design

Date: 2026-08-25

## Decision

Keep advanced Import Review controls collapsed by default, and teach the local
provider-acceptance validator to open the existing native `details` disclosure
before it verifies the visible download-acceptance diagnostic. The validator
uses the disclosure's visible heading and its native `summary`; it does not add
a second control, change the operator workflow, or bypass the UI with a hidden
API assertion.

## Why this is the next item

The strict local check accurately reported that no current Downloader transfer
was linked to Music Queue. The normal, read-only check then exposed a separate
test-path regression: it attempted to assert text inside the intentionally
collapsed advanced diagnostics panel. Fixing that regression restores the
baseline evidence path without creating an external transfer or expanding the
product surface.

## Official sources reviewed

- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  supports exposing state changes programmatically without moving focus. The
  native disclosure preserves its own expanded/collapsed state.
- [W3C WCAG 2.2 Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion)
  calls for a correction when one is known and safe. The strict validator
  reports the specific missing Music Queue transfer without attempting to
  download on the operator's behalf.
- [WCAG 2.2](https://www.w3.org/TR/wcag/) requires meaningful structure and
  instructions where user action is needed. The validator locates the visible
  `Run history and controls` heading before opening its native control.
- [Playwright locators](https://playwright.dev/docs/locators) recommends
  user-facing locators and avoiding brittle positional selectors. The proof
  removes `.first()` and scopes assertions to the opened disclosure.
- [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/)
  keeps the validator a post-health-check probe of the existing local stack.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Leave the probe targeting hidden text | No code change | Produces a false failure after the UI correctly collapses advanced work | Rejected |
| Automatically expand diagnostics for every operator | Makes the diagnostic immediately visible | Adds noise to the ordinary Music Queue workflow | Rejected |
| Add a new diagnostics route or API-only proof | Could avoid disclosure interaction | Duplicates the operator surface and weakens browser proof | Rejected |
| Open the existing native disclosure in the validator | Small, accessible, faithful to operator behavior | Keeps a small structural locator for the known disclosure | Chosen |

## Final stack

- ESM browser-probe helper:
  `scripts/docker-provider-acceptance-evidence.js`
- Focused helper coverage:
  `test/scripts/docker-provider-acceptance-evidence.test.js`
- Operator walkthrough:
  `docs/LOCAL_DOCKER_WALKTHROUGH.md`
- Outcome record:
  `docs/DOCKER_PROVIDER_ACCEPTANCE_DISCLOSURE_PROOF_OUTCOME.md`

## Security boundary

The correction is read-only after authentication. It opens an in-app
disclosure and reads existing bounded diagnostics. It does not send a download
request, alter provider settings, add queue work, write a secret, or record
provider endpoints, paths, transfer identities, or raw payloads in evidence.
