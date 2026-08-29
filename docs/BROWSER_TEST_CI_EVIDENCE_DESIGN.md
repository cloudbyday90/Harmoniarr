# Browser Test CI Evidence — Design

**Status:** Approved for implementation
**Date:** 2026-08-28

## Purpose

Harmoniarr's browser suite has a measured two-worker default. The next
improvement is not more concurrency: it is durable evidence that each CI run
finishes within the expected resource boundary. This design records the suite
runtime and verifies that the Testcontainers and browser-test Node processes
created by the run have exited.

The design applies only to automated validation. It does not change
Harmoniarr's self-hosted runtime, Compose topology, user accounts, requests,
library data, provider credentials, or normal local `npm run test:browser`
behavior.

## Research and decision

Node's test runner uses child-process execution for test files and exposes a
concurrency control. Playwright documents isolated browser contexts, which is
important because Harmoniarr's browser coverage exercises both requester and
administrator workflows. W3C's WCAG-EM model calls for scoped evaluation,
representative coverage, reporting, and user involvement; browser automation
is useful evidence, but not a claim of WCAG conformance.

GitHub Actions provides a per-step job-summary file and artifacts for bounded
CI reporting. The selected workflow writes a concise summary and retains a
minimal machine-readable artifact for 14 days. A fixed performance threshold
is deliberately not used: hosted-runner timing varies, while a resource leak
is an actionable correctness failure.

## Design

The implementation is split into small ESM modules:

- `scripts/browser-test-runner.js` starts the fixed-worker Node test child and
  measures only that child-run duration.
- `scripts/browser-test-evidence.js` owns evidence validation, safe
  workspace-relative paths, Docker/process inspection, bounded cleanup polling,
  JSON persistence, and summary rendering.
- `scripts/write-browser-test-evidence-summary.js` is a thin direct entrypoint
  that appends the validated summary to GitHub's provided job-summary file.
- `.github/workflows/browser-validation.yml` prepares Chromium, runs the
  existing browser command, publishes the summary, and uploads the JSON when
  present.

The evidence path is opt-in through
`HARMONIARR_BROWSER_TEST_EVIDENCE_PATH`. When absent, local browser tests keep
their prior behavior. When present, the path must resolve below the working
directory. The optional cleanup wait defaults to 25 seconds and cannot exceed
60 seconds.

```text
Node browser test child (two workers)
            |
            v
     duration measured
            |
            v
Docker Testcontainers + Node process inspection
            |
            v
bounded JSON evidence -> CI job summary + 14-day artifact
```

The persisted schema contains only:

- pass/fail status, fixed worker count, and duration in milliseconds;
- cleanup status, check count, configured maximum wait, and two resource
  counts; and
- schema version and generation timestamp.

It explicitly excludes command lines, container IDs, host paths, logs, URLs,
credentials, user identities, request data, and browser/session data.

## Options considered

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| No CI browser evidence | No workflow cost | Regressions in cleanup or timing are hard to compare | Rejected |
| Fixed runtime pass/fail threshold | Simple signal | Hosted-runner variability causes flaky failures | Rejected |
| Artifact raw logs, IDs, and command lines | More debugging detail | Unnecessarily retains environment and potential sensitive context | Rejected |
| Bounded summary and minimal artifact | Comparable timing, leak detection, low retention, low data exposure | Requires a dedicated browser job | **Adopted** |
| Increase beyond two workers | Potentially faster | Needs a new capacity and isolation assessment | Deferred |

## Security and multi-user boundaries

- Evidence is contained to the checkout so environment configuration cannot
  write arbitrary files.
- The workflow has read-only repository permissions and uses full commit SHA
  pins for third-party actions.
- Artifact content is allow-listed and numeric where possible. It never stores
  an actor, requester, administrator, release title, provider configuration,
  auth token, or filesystem location.
- The cleanup check detects only browser-test Node command shapes and persists
  their count, not process details. It checks Testcontainers by label and also
  stores a count only.
- A failed cleanup check fails the browser validation job. A failed test still
  writes its bounded evidence when inspection is possible, then preserves the
  original test failure.

The browser test isolation model remains unchanged: per-file runtimes and
temporary data boundaries, plus non-persistent Playwright browser contexts,
prevent cross-scenario authentication or data leakage. This validation does
not replace server-side authorization tests.

## W3C accessibility evaluation model

The CI job supports current semantic, keyboard, focus, dialog, and status
browser coverage by keeping feedback prompt and reliable. It is not an
accessibility certification mechanism. Each substantive UI change still needs
human evaluation of representative requester and administrator journeys,
including assistive-technology use where applicable, following the W3C
WCAG-EM scope, sampling, evaluation, and reporting model.

## Recommendation stack

1. **Use exactly two browser-test workers** and retain the serial script for
   constrained hosts or race diagnosis.
2. **Run dedicated browser CI** with read-only permissions, pinned actions,
   a 20-minute job ceiling, and Chromium system dependencies installed before
   the suite.
3. **Persist only bounded evidence**: child-run duration and cleanup counts;
   use the 14-day artifact for trend review rather than raw logs.
4. **Treat non-clean cleanup as a failure**, not as a warning or automatic
   retry condition.
5. **Review evidence across at least 10 representative CI runs** before any
   capacity experiment; do not raise the default worker count without a new
   isolation, memory, database, Docker, and accessibility assessment.

## Sources checked 2026-08-28

- [Node.js test runner execution model](https://nodejs.org/download/release/latest-jod/docs/api/test.html)
- [Playwright browser contexts](https://playwright.dev/docs/browser-contexts)
- [GitHub Actions workflow commands: job summaries](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions?tool=powershell)
- [GitHub Actions variables reference](https://docs.github.com/en/actions/reference/workflows-and-actions/variables)
- [W3C WAI: evaluating web accessibility](https://www.w3.org/WAI/test-evaluate/)
- [W3C WCAG-EM overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/)
- [W3C WCAG-EM 2.0](https://www.w3.org/TR/wcag-em-2/)
