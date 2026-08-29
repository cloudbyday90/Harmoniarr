# Browser Validation Runtime Stability — Design

**Status:** Implemented locally; CI verification pending
**Date:** 2026-08-29

## Decision

Run the existing Browser Validation suite serially in GitHub Actions with
`npm run test:browser:serial`. The application, its caches, the browser test
coverage, workflow permissions, evidence artifact, and cleanup limit remain
unchanged.

The browser runner still exposes `npm run test:browser` with its normal
two-worker setting for intentional local investigation. CI is the protected
reliability signal, so it uses the serial command until a new, representative
capacity study supports a different setting.

## Evidence and scope

The unchanged two-worker baseline is being collected through the serial
ten-run evidence process documented in
[Browser Validation Serial Collection Design](BROWSER_VALIDATION_SERIAL_COLLECTION_DESIGN.md).
The completed retained sample produced 3 passes and 7 failures from ten
serially dispatched two-worker runs at one commit. Failures timed out while
waiting for rendered content in unrelated scenarios, despite clean process and
Testcontainers cleanup in every artifact. This is a browser-runtime stability
concern; it is not evidence that Discography, related artists, or their
server-side SWR cache contract returned incorrect data.

The change is CI-operational only. It does not modify the self-hosted product,
authorization, multi-user request visibility or history, acquisition behavior,
or any user-facing interaction. It is not a W3C accessibility conformance
claim.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep two workers in CI | Fastest typical wall-clock time | The fixed-baseline evidence shows intermittent, unrelated navigation/readiness timeouts | Rejected |
| Raise UI wait timeouts | Minimal edit | Hides a resource-contention signal, lengthens failures, and does not make the runtime deterministic | Rejected |
| Run browser test files serially in CI | Uses Node's supported test-runner isolation control; preserves all coverage and bounded cleanup evidence | Longer CI duration | **Adopted** |
| Remove cache sample coverage | Faster suite | Would discard the regression coverage that detected the issue | Rejected |
| Add privileged cross-workflow automation | More remote orchestration | Expands the CI trust boundary without resolving the runtime contention | Rejected |

## Implementation boundaries

- `.github/workflows/browser-validation.yml` invokes the existing
  `test:browser:serial` package command.
- `scripts/browser-validation-workflow-contract.js` asserts that the workflow
  keeps the serial command and existing security/evidence controls.
- The workflow remains read-only (`contents: read`), retains pinned actions,
  keeps the 20-minute job timeout, and writes the same bounded evidence JSON.
- No workflow tokens, user data, browser logs, request records, or local paths
  are added to artifacts or repository files.

## Validation plan

1. Complete the fixed-SHA ten-run, two-worker baseline and publish its review
   without retrying or replacing a result.
2. Run the workflow contract test and repository validation locally.
3. Push the serial CI change only after the baseline collection has completed.
4. Dispatch Browser Validation once at the new commit and require both a
   passing browser test and `cleanup.status: clean` in its artifact.
5. Retain the baseline and post-change reports. Do not revise the capacity
   policy until a separately designed, representative experiment justifies it.

## Official sources checked 2026-08-29

- [Node.js test runner](https://nodejs.org/download/release/latest-jod/docs/api/test.html)
  — process-level test isolation runs matching files in child processes and
  `--test-concurrency` controls the maximum concurrent child processes.
- [Node.js CLI: `--test-concurrency`](https://nodejs.org/download/release/v22.18.0/docs/api/cli.html)
  — the flag defines the maximum number of test files executed concurrently.
- [GitHub Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
  — concurrency should be controlled explicitly where shared resources or
  overlapping work can conflict.
- [W3C WCAG-EM 2.0](https://www.w3.org/TR/wcag-em-2/)
  — evaluation methodology requires documented scope, sample, and reporting;
  it informs transparent evidence collection here but does not establish an
  accessibility claim.
