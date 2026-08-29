# Browser Validation CI Compatibility — Outcome

**Status:** Local validation complete; remote recovery-workflow investigation required
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

## Next recommended item

Instrument the backup creation and inventory/readback path in the operator
browser scenario so a Linux failure records the bounded UI error or the
specific missing request/state transition. Repair that root cause, then obtain
one green remote run before beginning the planned ten-run bounded evidence
review. Do not change browser concurrency until that sample remains clean and
its timing is reviewed.
