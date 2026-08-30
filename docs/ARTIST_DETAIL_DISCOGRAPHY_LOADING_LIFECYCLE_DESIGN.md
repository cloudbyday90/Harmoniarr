# Artist Detail Discography Loading Lifecycle Regression Design

Status: Implemented
Date: 2026-08-30
Owner: Client quality engineering

## Decision

Add a browser regression to the existing delayed-local-metadata Artist Detail
scenario. The test must prove that the named `Discography` region is marked
busy while its release catalog is loading and that the busy state is removed
after a known release is rendered. It also retains the existing assertion that
the known artist profile remains visible throughout the local-metadata delay.

This is a verification change, not a cache, SWR, request, telemetry, or
production-UI change.

## Why this is the next item

The local presentation diagnostic has now measured three successful local
loads: the Discography region became ready in 172–179 ms, with the local
metadata request completing in 12–15 ms. That is useful evidence, but a
repeatable regression should protect the user-visible state transition that
the diagnostic observes. The existing browser fixture already holds local
Artist Detail metadata for two seconds, so it exposes the precise interval in
which an incorrect persistent loading state would be observable.

This is deliberately smaller and safer than changing cache behaviour without
an affected-account reproduction. It detects a client loading lifecycle
regression while preserving the verified local-projection path.

## Standards and research review

Reviewed on 2026-08-30 against current primary sources:

- [WAI-ARIA 1.3](https://www.w3.org/TR/wai-aria-1.3/) defines `aria-busy` as
  the state that indicates an element is being modified. The test treats the
  existing named Discography body as busy only while its content is changing;
  it does not introduce a second progress signal.
- [WCAG 2.2 Understanding Success Criterion 4.1.3: Status
  Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires relevant waiting and result information to be programmatically
  determinable without moving focus. The existing polite `role="status"`
  message remains the user-facing announcement. The regression confirms the
  associated structural state without asserting focus movement or visual-only
  effects.
- [Playwright Locator](https://playwright.dev/docs/next/api/class-locator)
  documents state-based locator waiting, including `visible` and `detached`.
  The test waits for those semantic states rather than using elapsed time,
  CSS classes, or layout position.

## Implementation

Extend `test/browser/artist-detail-progressive-shell-browser-verification.test.js`:

1. Install the existing fixture with a bounded two-second local metadata
   delay and navigate as the bootstrap administrator.
2. Locate the existing `article[aria-label="Discography"]` by its accessible
   `article` role and name.
3. After the established loading status is visible, wait for its descendant
   with `aria-busy="true"` to become visible and assert that there is exactly
   one such active region.
4. Wait for the known fixture release, then wait for the busy descendant to
   detach and assert that no busy descendant remains.
5. Preserve the assertion that the obsolete full-page loading copy is absent.

The test remains an ES module and reuses the repository's current browser
runtime and metadata fixture. A one-call-site helper would only obscure this
short semantic sequence, so no new test utility is introduced.

## Security and multi-user boundaries

- The scenario uses the existing isolated browser runtime and local metadata
  fixture. It does not contact an external metadata provider or alter a
  user's data.
- The locator is a fixed structural role/name and attribute. It neither
  captures nor persists profile data, release metadata, credentials, tokens,
  cookies, response bodies, or cross-user information.
- The seeded administrator is used only to establish an authorized local
  browser session. The test does not loosen ownership or role checks, expose
  another user's requests, or alter audit history.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Change SWR/cache logic now | May appear to address the original report | No failing local evidence identifies cache as the cause; risks invalidation, races, and regressions | Reject |
| Add a production loading dashboard | Can capture field timing | Adds disproportionate persistent telemetry to a home-hosted application | Reject |
| Unit-test only the Vue attribute | Fast and focused | Does not prove routing, fixture delay, or the final rendered lifecycle in a browser | Insufficient alone |
| Add a semantic delayed-metadata browser regression | Exercises the real user-visible lifecycle with deterministic local data and no production data collection | Browser test is slower than a unit test | Adopt |

## Open pull request assessment

Reviewed on 2026-08-30. No open pull request safely applies to this focused
client regression, so none is merged or copied into the worktree:

| PR | Proposal | Assessment |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | Node `24.19.0-alpine` to `26.7.0-alpine` | Separate major runtime migration; current declared engine range supports Node 24 only. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `docker/build-push-action` 7.1 to 7.2 | Superseded locally; the workflow already uses 7.3. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `docker/metadata-action` 6.0 to 6.1 | Superseded locally; the workflow already uses 6.2. |

## Final recommendation stack

1. Land the semantic browser regression for the Discography busy-to-ready
   transition.
2. Use the local timing capture under the affected account before altering
   cache or SWR behaviour.
3. If a repeated capture reports `still_loading` or `unavailable`, inspect
   the client request gate and render error path with the captured route
   evidence; otherwise reproduce the original affected case first.
4. Keep performance diagnosis local and administrator-operated rather than
   introducing cross-user or persistent telemetry.
