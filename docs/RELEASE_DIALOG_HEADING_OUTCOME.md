# Release dialog heading outcome

## Delivered

Artist review item 11 replaces the hidden generic dialog heading with a persistent visible release title in the header. The native dialog references that unique heading through aria-labelledby. Loaded nonblank titles take precedence over card titles; `Release details` is the final fallback. The duplicate hero title is removed.

The header wraps long titles up to three visible lines while retaining the complete accessible name and tooltip. Close remains available beside the heading. Async data does not move focus, and existing loading/error regions, Escape handling, and opener focus restoration remain in place.

## Evidence

All 4,248 client tests, client lint, and client/server production builds passed. Twenty browser scenarios passed with no skips: eight modal/retry/edition scenarios, seven artist-policy/library/operator scenarios, and five request-action scenarios. They cover heading-linked names during loading/error/retry, edition title updates, and long-title/Close bounds at 390, 800, and 1280 pixels in light/dark themes. Mobile screenshots were visually reviewed. Scoped test lint passed. Docker rebuilt and bootstrapped with existing data preserved: container healthy and `/healthz` returned HTTP 200 at http://127.0.0.1:47956. Image: `sha256:b2f8a54a8af02ca87f5cd19c38f738cbf9675ee53cdaef3ad792beb40c482cff`. Browser locators now identify the actual release, including shared request-action helpers. This presentation change does not modify database or server logic, so database integration tests are not repeated.

## Recommendation and limits

Keep the existing release composable, a small computed fallback, setup-time useId, and semantic heading markup. This provides one visible and accessible naming source without a new runtime service or dependency. The tradeoff is that very long titles are visually clamped; their full text remains programmatically available. This is focused browser evidence, not a complete screen-reader certification.

Official W3C/Vue sources and alternative approaches are in the [design](RELEASE_DIALOG_HEADING_DESIGN.md). No applicable open PR patch was available; none was merged.

Next: artist review item 14, catalog pagination and large-discography query cost. Provide bounded progressive loading beyond the first catalog page, retain accurate totals and selection state, and verify behavior on large artists before release.
