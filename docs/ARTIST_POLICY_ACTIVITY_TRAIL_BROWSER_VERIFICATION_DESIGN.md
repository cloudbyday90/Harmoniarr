# Artist Policy Activity Trail Browser Verification Design

Status: Implemented
Last updated: 2026-06-27
Owner: Product + app architecture

## Purpose

Saved Artist Policy changes now emit `artist_policy_saved` Activity events. This
slice verifies the operator-facing browser trail end to end:

1. Open Artist Detail for a monitored artist.
2. Repair a saved track override that needs review.
3. Save Artist Policy through the existing UI mutation path.
4. Open Household Activity.
5. Confirm the saved-policy Activity row summarizes the repair.
6. Follow `Open artist policy` back to Artist Detail.

This closes the gap left after the activity-event implementation: the event was
covered by service and client presentation tests, but not by a real browser
handoff across Release Detail, Artist Detail, Activity, and router navigation.

## Official Source Review

Reviewed official sources as of June 2026:

- Playwright best practices:
  `https://playwright.dev/docs/best-practices`
- Playwright locators:
  `https://playwright.dev/docs/locators`
- Playwright auto-waiting:
  `https://playwright.dev/docs/actionability`
- Vue testing guidance:
  `https://vuejs.org/guide/scaling-up/testing.html`
- WAI-ARIA Authoring Practices Guide:
  `https://www.w3.org/WAI/ARIA/apg/`
- OWASP Web Security Testing Guide:
  `https://owasp.org/www-project-web-security-testing-guide/`

## Options Considered

### Service-Only Coverage

Pros:

- fast
- deterministic
- already proves the save service emits bounded event payloads

Cons:

- does not prove the operator can find the event in Activity
- does not prove router link handoff back to Artist Detail
- does not exercise the actual Release Detail repair action before save

Decision: keep existing service coverage, but it is not sufficient for this
workflow.

### Client Unit Coverage Only

Pros:

- good for label/detail/link helper contracts
- isolates Activity presentation logic

Cons:

- cannot prove cross-view state refresh
- cannot prove real keyboard/click behavior through modal, save, Activity, and
  router navigation

Decision: keep existing helper coverage, but add browser verification.

### Focused Browser Scenario

Pros:

- covers the real operator path through Release Detail, Artist Detail save,
  Activity feed rendering, and router link-back
- uses role and text locators rather than implementation-only selectors
- stays deterministic through the existing metadata browser fixture
- avoids adding another production route or mutation surface

Cons:

- slower than unit tests
- requires browser runtime availability

Decision: selected.

## Final Stack

- Browser coverage lives in
  `test/browser/artist-policy-activity-trail-browser-verification.test.js`.
- The metadata browser fixture now persists bounded `artist_policy_saved`
  events when the existing `PUT /api/v1/metadata/artists/:id/operator` fixture
  path is exercised by `Save policy`.
- The fixture Activity feed path responds to `GET /api/v1/activity/feed` using
  the same response shape consumed by `useActivityFeed`.
- The browser test repairs `Roygbiv` with `Keep this track`, saves Artist
  Policy, verifies the Activity row detail, clicks `Open artist policy`, and
  confirms the app returns to `/app/artists/mb-artist-boards`.

## Security Notes

- No new production endpoint was added.
- The scenario uses the existing authenticated browser runtime and existing
  Artist Detail save API boundary.
- The fixture event stores only summary counts and artist identifiers; it does
  not persist the full policy draft or raw track metadata.
- Activity remains an authenticated route. Requester route restrictions are
  unchanged.

## Outcome

The saved policy Activity trail is now covered in a real browser. Operators can
repair a reviewed track override, save policy, see the resulting
`artist_policy_saved` Activity entry, and follow the event back to Artist Detail.

## Validation

Focused validation:

```text
node --test --test-concurrency=1 test/browser/artist-policy-activity-trail-browser-verification.test.js
```

Result: passed.

## Next Step

The next high-value item is browser verification for a no-op Artist Policy save
path: save a policy change that queues reconciliation but produces no desired
release changes, then verify Activity and Background Jobs present the no-op
reevaluation clearly without implying downloads started.
