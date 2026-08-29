# Browser Runtime Diagnostic — Outcome

**Status:** Local two-worker sample verified; GitHub Actions result pending
**Date:** 2026-08-29

## Delivered

The repository now contains a separate, manual-only two-worker Browser Runtime
Diagnostic. It leaves the protected Browser Validation workflow serial and
does not modify Harmoniarr's self-hosted application or artist-detail cache.

On a failed browser scenario, the diagnostic writes one bounded structured
record with category-level readiness, aggregate API status families, aggregate
browser-error counts, document readiness, and rounded navigation timing. It
does not retain browser titles, IDs, URLs, user names, request content, raw
console output, screenshots, traces, paths, or command lines.

The workflow uses a read-only token, pinned actions, a no-overlap concurrency
group, and 14-day artifact retention. It records empty diagnostics on a healthy
two-worker run and keeps the normal serial browser workflow unchanged.

## Local two-worker sample

`npm run test:browser:diagnostic` passed locally with the bounded artifact
enabled. The exact full browser suite reported 89 passing tests across 63
suites in 529.6 seconds at two workers. Its diagnostic artifact contained zero
records, zero invalid records, and zero discarded records. The standard cleanup
artifact reported zero browser-test Node processes and zero Testcontainers after
seven checks, with `cleanup.status: clean`.

This is a healthy local sample, not a capacity conclusion. It does not revise
the fixed-SHA ten-run GitHub baseline that motivated keeping the protected
workflow serial.

## Local validation

The following passed after implementation:

- Focused Node tests for the browser observer, evidence schema, runner
  integration, and manual-workflow contract: 17 tests passed.
- `npm run lint:test`
- `npm run lint:scripts`
- `npm run check:esm`
- `npm test` — full server, client, script, and real PostgreSQL integration
  suites passed.
- `npm run build`
- `npm run check-copyright`
- `npm run migration:check`
- `npm run check:schema-snapshot`
- `npm run check:compose-topology`
- `npm run check:image-tags`
- `npm run validate:security` — package audit reported zero vulnerabilities.
- `git diff --check`

The manually dispatched workflow result is recorded after the initial commit is
pushed.

## Open PR outcome

No open PR was applied because none was applicable without regression:

- #40 moves a fixture to Node 26 Current, while the project intentionally uses
  Node 24 LTS.
- #23 and #24 carry Docker action versions older than the immutable SHAs
  already present on `main`.

This satisfies the requested review without merging or locally regressing an
open Dependabot PR.

## Next item

Dispatch the new workflow at the committed source SHA. Use its bounded artifact
to decide whether a larger fixed-SHA two-worker sample is warranted. Keep
Browser Validation serial until that sample provides a reproducible capacity
finding.
