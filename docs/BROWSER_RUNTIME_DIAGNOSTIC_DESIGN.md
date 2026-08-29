# Browser Runtime Diagnostic — Design

**Status:** Implemented locally; workflow verification pending
**Date:** 2026-08-29

## Decision

Keep the protected Browser Validation workflow serial. Add a separate,
manual-only two-worker diagnostic that collects a bounded record only when a
browser scenario fails. Its purpose is to distinguish Node test-file
contention from a product, metadata-cache, or test-data fault before changing
the concurrency policy again.

The diagnostic is not part of Harmoniarr's self-hosted runtime. It does not
change artist-detail SWR behavior, Discography data, user access, music
requests, acquisition, or the UI. It is not a WCAG conformance evaluation.

## Scope and method

The diagnostic follows the useful parts of the W3C WCAG-EM evaluation model:
document the scope, choose a representative process, evaluate it, and report
the result. It does **not** reuse WCAG-EM as a claim about accessibility.

| Evaluation step | This diagnostic |
| --- | --- |
| Scope | One exact source revision; the existing complete browser suite; exactly two Node test-file workers; an Ubuntu Actions runner. |
| Sample | Existing browser scenarios cover artist detail, requests, Missing Music, acquisition, discovery, settings, and other full processes. |
| Evaluation | A failed scenario emits a structured readiness/network/timing category. A passed suite emits zero records. |
| Report | The workflow step summary and 14-day artifact state result, duration, worker count, bounded records, and parser integrity counts. |

The normal Browser Validation workflow remains the release signal and runs one
test file at a time. This diagnostic can be manually dispatched only after the
workflow file is on the default branch. Its workflow-level concurrency group
prevents overlapping shared-resource experiments.

## Evidence contract

Each failed scenario can emit one record. The runner accepts at most 50 valid
records, counts excess or invalid records, and never retains raw child output.
The artifact allows only these values:

- scenario and route **categories**, never scenario names, URLs, IDs, titles,
  usernames, request values, or page text;
- an error category (`timeout`, `assertion`, `navigation`, or `other`) and a
  generic readiness target (`heading`, `button`, `text`, `client_navigation`,
  or `other`);
- aggregate API request/response/failure and response-family counters;
- aggregate console and page-error counters;
- document readiness and rounded Navigation Timing values; and
- suite duration, status, worker count, generated time, and parser counters.

The browser runtime obtains `domContentLoaded` and `load` values from the
standard navigation performance entry. It stores those rounded numbers rather
than an event trace. This is enough to evaluate readiness contention without
collecting browsing history or application content.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Restore two workers in protected CI | Faster when healthy | The retained ten-run baseline failed in unrelated readiness scenarios | Rejected |
| Increase browser timeouts or retry CI | Smallest change | Masks a capacity signal and produces less actionable evidence | Rejected |
| Persist screenshots, traces, raw URLs, or raw console logs | Rich debugging context | Increases artifact volume and could expose self-hosted user or request data | Rejected |
| Manual two-worker run with bounded structured evidence | Separates investigation from the gate, retains useful timing/network categories, and limits data exposure | Requires a deliberate dispatch and still needs repeated samples before a policy change | **Adopted** |

## Security controls

- The workflow has `contents: read` only, uses no secrets, and is not triggered
  by `push` or `pull_request`.
- Checkout and artifact actions remain pinned to immutable commit SHAs.
- The manual workflow uses a repository-wide non-cancelling concurrency group,
  so it does not overlap another diagnostic run.
- Artifact retention is explicitly 14 days. The artifact contains structured
  counters only, not logs, screenshots, traces, command lines, local paths,
  browser URLs, or product data.
- The evidence writer resolves its path inside the workspace and rejects extra
  schema fields, including a URL field.

## Implementation

- `testing/browser/browser-runtime-diagnostic.js` observes a Playwright page
  only when the explicit diagnostic environment flag is set and emits a single
  marked, sanitized record on a scenario failure.
- `scripts/browser-runtime-diagnostic-evidence.js` parses marked output,
  validates the allow-list schema, applies the record limit, writes the JSON,
  and produces the Actions summary.
- `scripts/browser-test-runner.js` switches child-process output from inherited
  streams to streamed forwarding only when diagnostic evidence is enabled; it
  does not buffer ordinary test output.
- `.github/workflows/browser-runtime-diagnostic.yml` invokes
  `test:browser:diagnostic`, which explicitly uses two workers, while
  `.github/workflows/browser-validation.yml` continues to invoke the serial
  command.

All implementation code is ES modules. The diagnostic is divided between the
browser observer, evidence schema, runner integration, and workflow contract
rather than a singleton script.

## Validation and interpretation

1. Run the focused schema, runner, observer, and workflow-contract tests.
2. Run repository tests and build checks before committing.
3. Push the manual workflow and dispatch it once at that exact commit.
4. Inspect the artifact only through its schema-valid JSON. Record the source
   SHA, suite outcome, cleanup outcome, record count, and categories.
5. Repeat fixed-SHA samples only if needed. Do not change the protected
   two-worker policy from a single pass or failure.

Interpretation is deliberately narrow:

- A failed two-worker run with a timeout record and a clean teardown supports
  the existing contention hypothesis but does not identify a root cause.
- A passed run with zero records shows only that this sample was healthy.
- A product assertion failure or non-2xx aggregate can direct a separately
  scoped investigation; it is not proof that artist-detail caching is wrong.

## Open PR review

Open PRs were reviewed before implementation:

- #40 changes a controlled-provider fixture from Node 24 LTS to Node 26
  Current. Node's release policy recommends an Active or Maintenance LTS for
  production, so that change is not applicable to the project's Node-24 LTS
  policy.
- #23 and #24 propose older Docker action SHAs. `main` already pins newer
  `docker/metadata-action` 6.2.0 and `docker/build-push-action` 7.3.0, so
  applying either locally would regress those actions.

No open PR was safe and applicable to apply in this round. None was merged.

## Official sources checked 2026-08-29

- [W3C WCAG-EM 2.0](https://www.w3.org/TR/wcag-em-2/) — documented scope,
  representative sampling, complete processes, and reporting structure.
- [W3C Navigation Timing Level 2](https://www.w3.org/TR/navigation-timing-2/)
  — the navigation performance entry and its privacy considerations.
- [Node.js test runner](https://nodejs.org/download/release/v24.13.1/docs/api/test.html)
  and [Node CLI `--test-concurrency`](https://nodejs.org/download/release/v24.0.2/docs/api/cli.html)
  — Node runs isolated matching test files as child processes and bounds their
  concurrency through the CLI flag.
- [GitHub manual workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
  [workflow syntax and permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
  and [workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts)
  — manual dispatch, least-privilege permissions, and bounded debugging
  artifacts.
- [Node.js release policy](https://nodejs.org/en/about/previous-releases) —
  Node 24 is LTS and Node 26 is Current as of this review.
