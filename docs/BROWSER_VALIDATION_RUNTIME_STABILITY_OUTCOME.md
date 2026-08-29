# Browser Validation Runtime Stability — Outcome

**Status:** Implemented locally; awaiting CI verification
**Date:** 2026-08-29

## Delivered change

Browser Validation now uses the existing serial browser-test command in CI.
The implementation changes only the Node test-file concurrency used by that
workflow. It leaves the browser test set, evidence artifact, cleanup check,
workflow permissions, and self-hosted application behavior intact.

## Validation record

- Browser workflow contract test passed locally.
- `git diff --check` passed locally.
- The completed fixed-SHA two-worker sample recorded 3 passing and 7 failing
  browser suites across ten serial runs. All ten artifacts reported clean
  teardown, so the change targets test-file runtime contention rather than
  cleanup policy. The retained manifest and strict review report are linked
  from [Browser Validation Serial Collection Outcome](BROWSER_VALIDATION_SERIAL_COLLECTION_OUTCOME.md).
- A post-change workflow dispatch is required before this outcome can be
  marked verified.

## Security outcome

The change does not add credentials, broaden GitHub token permissions, change
artifact contents, or expose any multi-user Harmoniarr data. It keeps the
existing read-only workflow permission and pinned actions.

## Next item

Verify one serial Browser Validation workflow at the committed change. If that
run passes with clean teardown, investigate the two-worker runtime separately
before any future capacity increase; do not treat a serial pass as proof that
the two-worker configuration is healthy.
