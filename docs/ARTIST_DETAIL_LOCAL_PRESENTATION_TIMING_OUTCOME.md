# Artist Detail Local Presentation Timing Outcome

Status: Implemented
Date: 2026-08-30

## Outcome

The secure, local Artist Detail diagnostic now establishes whether the
visible Discography loading region has completed alongside its critical request
path. It starts one privacy-bounded presentation observation immediately after
navigation and adds its result to every capture:
`ready`, `still_loading`, or `unavailable`, with only the rounded
navigation-relative time at which that result was observed.

This closes the gap between request timing and the reported user-visible
loading state. It does not alter SWR, metadata caching, API sequencing,
Vue loading behavior, user ownership, or normal product UI.

## Implementation

- `scripts/artist-detail-local-presentation-evidence.js` owns the strict ESM
  contract for the fixed state and bounded observation time.
- `scripts/artist-detail-local-presentation-observer.js` owns the Playwright
  semantic observation. It finds the named Discography article and waits at
  most two seconds for its existing `aria-busy="true"` descendant to detach.
- `scripts/measure-artist-detail-local-timing.js` starts that observation in
  parallel with the allowlisted request path, so route classification cannot
  inflate the navigation-relative result.
- The individual and batch local timing artifacts are now schema version 2.
  Batch evidence adds fixed presentation-state counts, consistency, and a
  bounded observation-time summary. Version 1 request-only artifacts are not
  accepted as proof of presentation readiness.
- Focused evidence, observer, single-artifact, batch-artifact, and CLI tests
  prove the strict field boundaries, timeout outcomes, deterministic summary,
  and workspace-only persistence behavior.

## Accessibility and security outcome

The implementation follows the same semantic state that communicates progress
to assistive technology. `aria-busy` remains the declaration that the
Discography region is updating, while the existing polite `role="status"`
message remains responsible for user-facing status feedback. No focus is
moved, no duplicate status message is added, and the diagnostic stores no DOM
text.

The loopback-only URL validation, file-only password, service-worker block,
fresh browser contexts, fixed request allowlist, and workspace-only evidence
writer are unchanged. The new field accepts neither URLs, identifiers, page
content, usernames, credentials, headers, bodies, cookies, cache keys, nor
absolute time values. The operator projection remains observed under one
authenticated account, preserving multi-user boundaries.

## Verification

Focused evidence and integration tests passed on 2026-08-30, along with
script/test lint and `git diff --check`. The complete repository validation
and security policy/audit checks also passed before the documented walkthrough
rebuild.

The walkthrough rebuild followed
[Local Docker Walkthrough](LOCAL_DOCKER_WALKTHROUGH.md):

```powershell
docker compose -f compose.walkthrough.yaml build harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap
```

The container reported healthy and the bootstrap helper safely recognized the
existing disposable administrator. Three fresh authenticated browser contexts
then returned a consistent `local_projection` and `ready` presentation state:

| Signal | Minimum | P50 | P95 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Local metadata request | 12 ms | 15 ms | 15 ms | 15 ms |
| Per-user operator projection request | 16 ms | 17 ms | 20 ms | 20 ms |
| Observed Discography-ready state | 172 ms | 176 ms | 179 ms | 179 ms |

No provider Discography fallback, persistent loading state, or unavailable
Discography region occurred. The local evidence artifact stayed ignored under
`.tmp`; the temporary password-only file was deleted immediately after the
capture.

## Recommendation retained

Use three local samples under the affected account before changing cache or
request behavior. A repeated `still_loading` result warrants a focused client
state/render investigation; a repeated `ready` result with fast requests
means the original case must be reproduced before touching SWR. Keep this
manual diagnostic local to the home-hosted deployment rather than creating a
production performance dashboard.
