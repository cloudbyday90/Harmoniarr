# Recovery Browser Backup Isolation — Design

**Status:** Implemented and remotely confirmed
**Date:** 2026-08-29

## Problem

The Linux Browser Validation workflow repeatedly completed the Create backup
interaction without rendering the subsequent **Review restore** action, even
after its bounded browser-action timeout increased from 15 to 30 seconds.
The browser integration runtime already gives each scenario its own temporary
workspace and database, but it did not set `HARMONIARR_BACKUPS`. The recovery
service therefore used its production default (`/app/data/backups`) instead of
a scenario-owned path. That leaves the test dependent on a shared path that
may be unwritable on the CI host and is not compatible with parallel test
isolation.

## Decision

1. Derive a `backups` directory from each integration scenario's existing
   temporary workspace and set `HARMONIARR_BACKUPS` only while that scenario
   creates the app.
2. Make the same isolation guarantee for `withIntegrationApp`, which owns one
   temporary workspace for a single integration application.
3. Expose the resolved test backup directory in the scenario context so an
   integration test can verify the artifact is owned by its workspace, without
   exposing it in application responses or CI summaries.
4. Keep production configuration unchanged: deployment operators continue to
   explicitly configure the persistent backup directory. Test-only environment
   setup must never alter production defaults.
5. Give the recovery screen a concise, polite status message while creation is
   in progress and an assertive error message when it fails. The primary
   visible recovery task remains unchanged; this only makes the result of the
   action clear to screen-reader and sighted users.

## Options considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Per-scenario backup directory | Reproducible, writable, parallel-safe, and cleaned with the scenario | Small test-runtime configuration change | **Adopt** |
| Shared `/app/data/backups` default | No code change | Host-dependent, cross-test contamination risk, may be unwritable | Reject |
| Longer browser timeout | Masks slow state changes | Does not fix a failed write or missing inventory response | Reject |
| Disable parallel workers | May avoid collisions | Hides an isolation defect and weakens CI coverage | Reject |
| Full traces/screenshots on every test | Deep failure evidence | Expensive and could preserve backup metadata | Reject for this repair |

## Accessibility and security model

The create action controls a `role="status"` region with explicit
`aria-atomic="true"`; it reports progress without moving focus. A failure is
exposed through `role="alert"` so the user receives the error without needing
to rediscover it visually. These choices follow W3C ARIA status-message
guidance. No filesystem paths, backup contents, credentials, or response
bodies are placed in the DOM, test output, or CI artifact.

The test directory exists only beneath the temporary workspace and is removed
with that workspace according to the existing test-artifact retention policy.
The application still validates backup artifact storage paths before reading
or restoring them.

## Recommendation stack

1. Isolate all filesystem side effects together with the already-isolated
   database and browser context.
2. Test the complete create → inventory → restore-review handoff against the
   real app and assert the generated backup remains under the scenario
   workspace.
3. Use semantic, bounded locator waits; do not add sleeps, retries, or broader
   timeouts.
4. After local validation, require a green two-worker Linux Browser Validation
   run before treating the recovery browser flow as confirmed.

## Official sources checked 2026-08-29

- [W3C ARIA22: Using `role=status` to present status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
- [WAI-ARIA status role](https://www.w3.org/WAI/PF/aria/terms)
- [Playwright best practices](https://playwright.dev/docs/best-practices)
- [Playwright continuous integration guidance](https://playwright.dev/docs/ci)
- [GitHub Actions workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts)
