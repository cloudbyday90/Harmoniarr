# Music Queue Release Progress Browser Acceptance Design

Status: **Implemented.**

Date: 2026-07-26.

## Goal

Prove the normal home-user experience as one release-level story:

`Searching -> Downloading -> Ready to add -> Adding to library -> In library`

The user should understand progress from Music Queue without opening candidate,
run, or import controls. Detailed diagnostics remain available only after an
explicit disclosure in release details.

## Official Sources Reviewed

| Source | Design input |
| --- | --- |
| [Playwright best practices](https://playwright.dev/docs/best-practices) | Use role and text locators with controlled dependencies, rather than DOM-shape assertions or timing waits. |
| [Playwright locators](https://playwright.dev/docs/locators) | Chain a release row locator from its accessible role and visible release title, so assertions remain scoped to the user-visible release. |
| [W3C disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | The optional diagnostic disclosure uses a button with `aria-expanded` and `aria-controls`; tests prove it starts closed and changes state only after activation. |
| [MDN details disclosure reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details) | Progressive disclosure keeps optional information out of the normal scan path while retaining keyboard-operable access. |

## Recommendation

Keep the normal Music Queue proof release-centered and deterministic:

1. Mock only asynchronous first-party read models in an isolated browser
   runtime. Do not depend on public Soulseek peers, a provider account, or
   timing-sensitive workers.
2. Advance one stable release through the five visible states via user-initiated
   refreshes.
3. Assert user-facing labels, explanations, and appropriate handoffs at each
   stage.
4. Assert the normal queue does not use `candidate` language or expose the
   advanced route. The `Advanced diagnostics` handoff appears only after the
   user opens the explicitly labelled evidence disclosure.

## Alternatives

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep separate search/download and post-transfer checks only | Focused failures and lower setup cost. | Does not prove a user sees one coherent release journey or the diagnostics boundary across it. | Keep as focused coverage, but insufficient alone. |
| Run this browser check against public peers | Exercises external search and transfers. | Non-deterministic, slow, and exposes the release gate to remote availability. | Reject. |
| Make the candidate workspace the acceptance surface | Reuses existing diagnostic controls. | Reintroduces implementation language and manual work into the normal workflow. | Reject. |
| Release-scoped browser acceptance with explicit diagnostics disclosure | Tests the user journey and the information boundary with deterministic fixtures. | Does not replace file-backed worker validation. | Adopt. |

## Security And Accessibility

- This test does not turn UI hiding into an authorization boundary. Candidate
  and run APIs remain protected by the application’s existing authenticated
  diagnostic routes and API authorization.
- The normal Music Queue projection exposes only release-level title, artist,
  quality outcome, progress, and next action. It does not render candidate IDs,
  provider user names, filesystem paths, secrets, or raw provider payloads.
- The evidence control keeps its semantic button behavior and correctly
  reflects closed/open state through `aria-expanded`.
- The test uses a disposable application/database runtime and route fixtures
  only for first-party read models; no real credentials or provider calls are
  used.

## Implementation

`testing/browser/music-queue-browser-fixtures.js` centralizes the configured
provider-health fixture shared by Music Queue browser scenarios.

`test/browser/music-queue-release-progress-browser-acceptance.test.js` proves
one release transitions through all five normal states. It verifies:

- `Searching` shows a release detail action rather than candidate navigation;
- `Downloading` offers the normal Downloader handoff;
- `Ready to add` and `Adding to library` remain automatic and do not offer a
  library-add workbench action;
- `In library` offers the normal Library handoff;
- candidate terminology and the diagnostics route remain absent until the
  user explicitly expands matching and quality details.

The existing automatic-download and post-transfer browser suites now consume
the shared fixture instead of maintaining duplicate provider-health mocks.

## Final Recommendation Stack

1. Keep the focused handoff, post-transfer, and diagnostics-boundary suites.
2. Keep this release-progress acceptance contract as the cross-stage UI proof.
3. Keep the file-backed Docker acceptance command as the separate proof of real
   media inspection and safe library mutation.
4. Use the next browser slice to prove a strict-quality failure blocks the
   failed match, promotes the next eligible match, and visibly returns Music
   Queue to forward progress without a manual candidate workflow.
