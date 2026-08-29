# Browser Validation Runtime Stability — Outcome

**Status:** Verified
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
- Full repository tests completed after the change, followed by successful
  client/server build, ESM, copyright, migration, schema-snapshot, and Compose
  topology checks.
- The walkthrough Compose image rebuilt and the forced recreation of its one
  Harmoniarr service completed healthy; bootstrap retained the existing
  walkthrough administrator.
- Push-triggered [Browser Validation run 33255343725](https://github.com/cloudbyday90/Harmoniarr/actions/runs/33255343725)
  passed on commit `998472c520076af5406592b8a546f6fe81d38a0a`.
  Its bounded artifact records one worker, a passing browser suite, 329.8
  seconds duration, zero browser-test processes, zero Testcontainers, and
  `cleanup.status: clean` after the existing 25-second cleanup window.

## Security outcome

The change does not add credentials, broaden GitHub token permissions, change
artifact contents, or expose any multi-user Harmoniarr data. It keeps the
existing read-only workflow permission and pinned actions.

## Next item

Investigate the two-worker runtime separately with a deliberately scoped,
instrumented experiment before any future capacity increase. Do not treat this
serial pass as proof that the two-worker configuration is healthy.
