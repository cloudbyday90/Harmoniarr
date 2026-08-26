# Home artist-card release-plan status outcome

**Status:** implemented

**Completed:** 2026-08-26

## Outcome

Home no longer presents **Last reconciliation completed** as a green artist
card badge. The completed background policy run is an implementation event,
not an operator outcome or a next action. The card continues to show policy,
desired-release coverage, missing releases, and its accessible **Manage
_artist_** destination.

Only active or exceptional release-plan work now receives a compact, static
status pill:

| State | Visible card text | Tone |
| --- | --- | --- |
| Queued, pending, or running | Updating release plan | Warning |
| Failed | Release plan update needs attention | Danger |
| Cancelled | Release plan update stopped | Warning |
| Completed, idle, or unknown | No pill | N/A |

Artist Detail is the deeper operational surface. It now uses the
plain-language **release plan update** wording, adds a quiet saved-snapshot
timestamp after a completed update when one is available, and labels the
recovery action **Retry update**. A successful user-initiated retry announces
"Release plan update queued." once without moving focus.

## Implementation

- Added the pure ESM
  `src/client/lib/operator-artist-card-status-presentation.js` module for
  Home-card visibility, copy, and tone.
- Added the pure ESM
  `src/client/lib/operator-artist-release-plan-presentation.js` module for
  Artist Detail wording and timestamp presentation.
- Removed reconciliation copy from the broad card-presentation module, keeping
  policy and coverage helpers focused on card facts.
- Removed `role="status"` from the repeated per-release detail text. Static
  content is not a status announcement; only the result of the explicit retry
  action is announced through one nearby polite status region.

No API, authorization, cache, provider, or database contract changed. The UI
still reads the existing user-scoped artist projection, so no new data is
exposed and no mutation path was added.

## W3C and usability rationale

W3C WCAG requires headings and labels to describe their topic or purpose.
"Last reconciliation completed" does not tell an operator what changed or
what to do. The new labels name the actual release-plan effect. Completed work
is intentionally absent because the coverage line already conveys its useful
result.

W3C’s status-message guidance applies when content changes in place without a
change of context. The explicit retry has one concise, polite announcement;
initial rendering and automatic polling do not announce every artist or every
release. This avoids an unnecessarily chatty screen-reader experience while
keeping the action result available.

Sources checked 2026-08-26:

- [W3C WCAG 2.2 — Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
- [W3C WCAG 2.2 — Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
- [W3C WAI-ARIA — `status` role](https://www.w3.org/TR/wai-aria/#status)

## Alternatives considered

| Approach | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Keep a green completed badge | Exposes background activity | Adds jargon without outcome or action; encourages false "healthy" interpretation | Rejected |
| Show every reconciliation state on Home | Maximum operational visibility | Creates visual and assistive-technology noise on a compact overview | Rejected |
| Show only active and exceptional states | Preserves useful exceptions while keeping coverage primary | Completion time moves to Artist Detail | Adopted |

## Open PR assessment

The open Dependabot pull requests were inspected and not merged:

- PR #23 and PR #24 are already superseded on `main` by newer immutable action
  pins (`docker/metadata-action` v6.2.0 and `docker/build-push-action` v7.3.0).
- PR #40 changes only the Docker builder to Node 26.7.0 while the repository
  intentionally pins Node 24 LTS in `.nvmrc` and its npm engine contract. It
  is not safe to apply partially.

## Validation evidence

- Focused pure-presentation and component-contract tests: passed (12 tests).
- Client lint: passed.
- `npm test`: passed, including server, client, script, and integration suites.
- `npm run build`: passed for the production Vue client and server build.
- Walkthrough Compose rebuilt from the current repository and became healthy.
- Authenticated Playwright smoke check: passed. Home hid the completed badge,
  retained coverage and the named Manage link, Artist Detail showed **Release
  plan updated**, and 1440px, 768px, and 390px layouts had no horizontal
  overflow.
