# Browser Validation Evidence Review — Design

**Status:** Approved for implementation
**Date:** 2026-08-29

## Purpose and scope

Browser Validation already records a deliberately small artifact for each run:
the browser-suite outcome, the fixed Node worker count, child-run duration, and
cleanup result. This design adds a local, repeatable review of **ten consecutive
Browser Validation runs** before any browser-capacity experiment.

The review answers one operational question: did the established two-worker
browser-validation configuration run cleanly across the selected sample? It is
not an accessibility conformance evaluation, a performance benchmark, or a
reason to change the self-hosted application's runtime configuration.

## Research and decision

W3C WCAG-EM 2.0 separates scope, sample selection, evaluation, and reporting.
Applied here, that means fixing the workflow configuration and sample method
before inspecting results, retaining every selected outcome, then creating a
machine-readable report. This is evidence for browser-test reliability only;
the methodology does not turn the sample into a WCAG conformance claim.

GitHub supports manual `workflow_dispatch` runs and per-run artifact download.
The existing workflow therefore remains the collection point. A new privileged
`workflow_run` collector is deliberately rejected: GitHub cautions against
using that trigger with untrusted pull-request code or artifacts. Manual or
read-only artifact retrieval keeps the review outside a secret-bearing,
cross-workflow execution path.

## Design

The implementation consists of three small ESM files:

- `scripts/browser-test-evidence-review.js` owns the strict manifest contract,
  review calculation, and JSON report persistence.
- `scripts/review-browser-test-evidence.js` is a thin direct CLI entrypoint.
- `test/scripts/browser-test-evidence-review.test.js` covers valid and invalid
  manifests, review outcomes, descriptive duration statistics, safe paths, and
  console-summary wording.

The CLI reads these environment variables:

| Variable | Required | Meaning |
| --- | --- | --- |
| `HARMONIARR_BROWSER_TEST_EVIDENCE_REVIEW_INPUT_PATH` | Yes | Workspace-relative JSON manifest containing collected run evidence. |
| `HARMONIARR_BROWSER_TEST_EVIDENCE_REVIEW_OUTPUT_PATH` | Yes | Workspace-relative JSON path for the generated review report. |

Both paths reuse the existing workspace-bound resolver. The command never
downloads archives, invokes GitHub, extracts files, runs artifact content, or
accepts paths outside the checkout.

### Manifest and report contract

The input manifest has schema version 1 and an allow-listed array of samples:

```json
{
  "schemaVersion": 1,
  "samples": [
    {
      "runId": 33246937282,
      "evidence": {
        "browserTest": { "durationMs": 300000, "status": "passed", "workerCount": 2 },
        "cleanup": {
          "attempts": 1,
          "browserTestProcessCount": 0,
          "maxWaitMs": 25000,
          "status": "clean",
          "testcontainerCount": 0
        },
        "generatedAt": "2026-08-29T12:00:00.000Z",
        "schemaVersion": 1
      }
    }
  ]
}
```

Each `runId` is a unique positive safe integer. Each `evidence` object must
pass the pre-existing browser-evidence contract, so no user, request, log,
path, URL, credential, container ID, or command line can enter either the
manifest or the report.

The report records the supplied count, an allow-listed per-run outcome,
descriptive duration values (minimum, median, p95, and maximum), and the
review result:

- `baseline_confirmed` — exactly ten samples; every browser test passed,
  cleanup was clean, and worker count was two.
- `incomplete` — fewer than ten samples and no other discrepancy.
- `review_required` — a failed test, non-clean cleanup, worker-count change,
  or more than ten samples was supplied.

The statistics are descriptive only. There is intentionally no duration
threshold: hosted-runner timing varies, whereas a non-clean teardown or altered
worker count is immediately actionable.

### Fixed sample method

1. Retain the existing `Browser Validation` workflow configuration: two Node
   workers, 25-second bounded cleanup inspection, and its current job ceiling.
2. On `main`, dispatch the workflow ten times in sequence with no browser-test
   configuration change between the first and final run. Do not omit a failed,
   cancelled, or non-clean result from the selected set.
3. For each completed run, download only the
   `harmoniarr-browser-isolation-evidence` artifact before its 14-day retention
   period expires. If an artifact is unavailable, stop and mark the review
   incomplete; do not substitute an older run.
4. Copy each JSON evidence file into one manifest with its GitHub run ID.
5. Run `npm run review:browser-evidence`. Treat `baseline_confirmed` as the
   evidence result; otherwise inspect the named run IDs and retain the current
   two-worker limit.

This is deliberately a structured, reproducible operational sample—not a
random accessibility sample and not an attempt to discard unfavorable runs.

## Security and multi-user boundaries

- Browser evidence remains anonymous operational data. The review does not
  collect account, requester, administrator, session, release, provider, or
  library information.
- Artifact acquisition uses GitHub's normal UI or a caller-managed read-only
  token; Harmoniarr stores no GitHub token and grants no new workflow
  permissions.
- Strict JSON parsing, exact field allow-lists, numeric run identifiers, and
  workspace-relative paths keep malformed input from becoming shell code,
  arbitrary filesystem writes, or retained sensitive data.
- The report establishes a CI reliability baseline only. It neither changes
  multi-user authorization rules nor substitutes for requester and
  administrator accessibility evaluation.

## Options considered

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Inspect job summaries manually | No code | Error-prone, not reproducible, weak audit trail | Rejected |
| Collect artifacts in a `workflow_run` workflow | Automated history | Broader privilege and unsafe artifact boundary | Rejected |
| Store raw logs and system details | More diagnostics | Retains unnecessary environment data | Rejected |
| Local strict-manifest review | Repeatable, bounded data, no new CI privilege | Operator downloads ten small artifacts | **Adopted** |
| Raise worker count now | Potential faster runs | No stability baseline | Deferred |

## Recommendation stack

1. **Adopt the local strict-manifest review** and retain only the existing
   bounded evidence fields.
2. **Collect ten consecutive fixed-configuration runs**, recording every
   selected outcome and its GitHub run ID.
3. **Treat cleanup or worker-count drift as a review failure**; inspect the
   relevant run rather than retrying or increasing timeouts blindly.
4. **Keep timing descriptive** until a separately designed capacity experiment
   establishes a meaningful threshold and resource budget.
5. **Continue W3C-guided human accessibility evaluation** for representative
   requester and administrator flows; this operational review does not replace
   it.

## Official sources checked 2026-08-29

- [W3C WCAG-EM 2.0](https://www.w3.org/TR/wcag-em-2/)
- [GitHub: manually running a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [GitHub: downloading workflow artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)
- [GitHub: Actions artifact REST API](https://docs.github.com/en/rest/actions/artifacts?apiVersion=2026-03-10)
- [GitHub: secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
