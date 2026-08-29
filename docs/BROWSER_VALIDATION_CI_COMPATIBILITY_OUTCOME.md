# Browser Validation CI Compatibility — Outcome

**Status:** Recovery filesystem isolation remotely confirmed
**Date:** 2026-08-29

## Delivered result

The Current automation disclosure now stacks its explanatory and status
content at the mobile breakpoint and permits its heading to shrink and wrap.
This removes the Linux-detected horizontal overflow while preserving native
`details` semantics and its keyboard focus treatment.

Browser scenarios now receive a dedicated 30-second browser-action timeout,
separate from the 15-second HTTP request budget. The integration runtime
supplies that validated configuration to each scenario, while direct runtime
use keeps the same bounded fallback. No timeout is disabled and no sleep or
retry is added.

## Validation record

- The three previously failing browser files passed together at two-worker
  concurrency.
- The full local two-worker browser suite passed: **89 tests**, **63 suites**,
  **0 failures**, in **316.8 seconds**.
- Client, server, and test linting passed.
- Browser timeout resolution and integration runtime configuration unit tests
  passed.

Remote Browser Validation runs identified a real unresolved recovery-workflow
problem under Linux two-worker concurrency. Run 3 timed out after 15 seconds
and run 4 after the dedicated 30-second action budget while waiting for the
semantic "Review restore" control; the control never appeared. Dependency
setup, strict installation, evidence-summary publication, and evidence-artifact
upload succeeded in both runs. This is not sufficient evidence to raise a
timeout again or reduce worker count.

## Recovery follow-up

The investigation identified the missing isolation boundary: every scenario
received a temporary database and workspace, but recovery backup creation
silently fell back to the shared `/app/data/backups` production path. The test
runtime now supplies a scenario-owned `HARMONIARR_BACKUPS` directory, and the
real recovery route test verifies that the persisted artifact is inside it.

The Settings recovery screen now gives a concise status while a backup is
being made, confirms completion, and announces failures as alerts. This makes
the action result clear without adding a retry, sleep, timeout increase, or
path disclosure. The full design and local validation record are in
[Recovery Browser Backup Isolation — Design](RECOVERY_BROWSER_BACKUP_ISOLATION_DESIGN.md)
and [Recovery Browser Backup Isolation — Outcome](RECOVERY_BROWSER_BACKUP_ISOLATION_OUTCOME.md).

[Browser Validation run 5](https://github.com/cloudbyday90/Harmoniarr/actions/runs/33246937282)
passed on the Linux two-worker runner after the repair. The browser suite,
evidence summary, and isolation-evidence artifact all completed successfully.

## Next recommended item

Begin the planned ten-run bounded evidence review without changing the worker
count or action timeout. Review suite duration and the artifact after the
sample before considering a capacity change.
