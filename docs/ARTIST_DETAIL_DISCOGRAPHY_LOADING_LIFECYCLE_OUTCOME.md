# Artist Detail Discography Loading Lifecycle Regression Outcome

Status: Implemented
Date: 2026-08-30

## Outcome

The Artist Detail browser suite now preserves a regression guard for the
accessible Discography loading lifecycle: the named Discography region is busy
while its delayed local release catalog is updating, it settles after the
known fixture release appears, and the obsolete full-page loading state remains
absent.

No production behavior, cache policy, SWR configuration, metadata request,
user data, role boundary, or telemetry was changed. This is intentional: the
current local evidence showed a fast ready state, and this regression protects
that evidence before any narrower affected-account reproduction justifies a
runtime change.

## Implementation

`test/browser/artist-detail-progressive-shell-browser-verification.test.js`
now identifies the existing Discography `article` by its accessible role and
name. During the existing two-second local-metadata delay it waits for the
single descendant with `aria-busy="true"`. After the known release `Music Has
the Right to Children` is rendered, it waits for that busy descendant to
detach and asserts that the semantic busy state is absent.

The test keeps the established assertions that the artist heading remains
visible and the obsolete `Loading artist detail...` copy does not return. The
result is a browser-level proof of the user and assistive-technology lifecycle,
not a brittle timing, style, or layout assertion.

## Accessibility and security outcome

The test checks existing ARIA semantics only. It does not add a duplicate live
announcement, move focus, inspect rendered metadata beyond the known fixture
release, or introduce any production telemetry. The existing polite loading
status remains the status-message mechanism, while `aria-busy` defines the
bounded update state of the related content region.

It continues to run through the repository's isolated local browser runtime
and fixtures. No external provider, credential, cookie, request body, user
profile, cross-user projection, or persistent artifact is added.

## Verification

Passed on 2026-08-30:

```text
npm run validate:artist-detail-progressive-loading
```

The command built the Vue client and passed the browser scenario in 8.8 seconds
(3.97 seconds for the delayed-metadata test). Complete repository and security
validation evidence is recorded with the associated commit.

## Recommendation retained

Use the local presentation timing capture under the affected account before
changing cache or SWR behavior. If it repeatedly reports `still_loading` or
`unavailable`, investigate the client request gate and render error path. If
it remains `ready`, reproduce the original affected case before altering the
verified cache path.
