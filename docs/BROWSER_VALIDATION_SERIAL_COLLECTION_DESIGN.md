# Browser Validation Serial Collection — Design

**Status:** Implemented; awaiting a ten-run production collection
**Date:** 2026-08-29

## Purpose and scope

Browser Validation has a repaired, passing two-worker baseline, but a single
passing run cannot establish that the browser test configuration is reliably
repeatable. This design adds a small local ESM collector that dispatches and
records **ten serial `workflow_dispatch` Browser Validation runs** from one
unchanged `main` commit. It produces the bounded manifest consumed by
`npm run review:browser-evidence`.

This is CI-operational evidence only. It does not change the self-hosted
application, request visibility, user retention, download behavior, or
multi-user authorization. It is also not a WCAG conformance evaluation.

## Research and decision

GitHub permits a workflow configured for `workflow_dispatch` to be started by
the CLI or REST API, and requires repository write access for that action. Its
workflow-run API exposes queued, in-progress, and completed statuses plus the
terminal conclusions needed to retain a cancellation or timeout faithfully.
The existing `Browser Validation` workflow is therefore the only remote
execution point; this collector neither adds a second workflow nor expands the
workflow's `contents: read` permission.

W3C WCAG-EM 2.0 prescribes defining scope, selecting the sample, evaluating
it, and reporting the outcomes. Applied here, the scope is the existing
two-worker Browser Validation workflow, the fixed sample is ten serial runs
from one commit, and the report retains every selected outcome. The analogy
supports reproducible operational evidence, not an accessibility claim.

## Options considered

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Download and assemble ten artifacts by hand | No code | Easy to overlap runs or omit a failed/cancelled result; weakly repeatable | Rejected |
| Add a privileged `workflow_run` collector | Fully remote automation | Creates a cross-workflow artifact and privilege boundary | Rejected |
| Run ten jobs in parallel | Fast | Makes hosted-job contention an unrecorded variable | Rejected |
| Local serial ESM collector and existing strict review | Explicit sample selection, bounded data, no new CI privilege, repeatable audit trail | Requires caller GitHub authentication and waits for ten runs | **Adopted** |

## Architecture

The implementation uses small ESM modules with clear boundaries:

- `scripts/github-actions-browser-validation-client.js` owns the bounded
  GitHub CLI transport, terminal-run normalization, and temporary artifact
  handling.
- `scripts/browser-validation-sample-collection.js` owns serial selection,
  source-SHA and concurrency policy, and manifest persistence.
- `scripts/collect-browser-validation-samples.js` is the thin operator CLI
  entrypoint.
- `scripts/browser-test-evidence-review.js` remains the local review boundary;
  schema version 2 adds a bounded `null` evidence state for a terminal run
  whose named artifact is unavailable. It continues to accept version 1
  manifests for the retained historical record.
- `test/scripts/browser-validation-sample-collection.test.js` exercises the
  serial success, cancellation/artifact-unavailable, concurrent-run, source
  drift, and input-path boundaries without contacting GitHub.

The operator command is:

```powershell
$env:HARMONIARR_BROWSER_VALIDATION_SAMPLE_COLLECTION_OUTPUT_PATH = 'docs/evidence/BROWSER_VALIDATION_SERIAL_COLLECTION_2026-08-29_INPUT.json'
npm run collect:browser-evidence
```

It always selects ten runs. The operator then reviews the written manifest
with the existing command and a distinct workspace-relative output path.

If an operator shell ends after a workflow has already been dispatched, set
`HARMONIARR_BROWSER_VALIDATION_SAMPLE_COLLECTION_INITIAL_RUN_ID` to that one
completed run ID when restarting. The collector verifies its source commit,
retains its bounded artifact, and resumes only after it is terminal. It can
recover one unretained run after a partial-manifest interruption only when the
run follows the retained samples chronologically and does not duplicate an ID.
If a partial manifest already exists, rerunning the command resumes from its
retained samples rather than replacing them.

## Collection flow

```text
Resolve repository + main SHA
        |
Confirm no active Browser Validation run
        |
Dispatch one fixed workflow on main
        |
Identify exactly one new run at the recorded SHA
        |
Wait for terminal state -> download one named artifact -> strict JSON parse
        |
Persist allow-listed sample -> repeat until ten
        |
Run existing local evidence review
```

The next dispatch occurs only after the preceding run is terminal. If a named
artifact cannot be parsed or downloaded, the collector records the terminal
run with `evidence: null`, writes the partial manifest, and stops. The review
therefore reports `browser_test_evidence_unavailable` rather than concealing a
selected cancellation or artifact failure by substituting another run.

## Security and multi-user boundaries

- The collector uses the caller's GitHub CLI authentication; Harmoniarr does
  not read, write, or retain a token. The command is local and is never added
  to CI.
- Repository names, run identifiers, source SHAs, timestamps, workflow branch,
  event, and terminal conclusion values are validated before persistence.
- It dispatches only the fixed `browser-validation.yml` workflow on `main`,
  with no user-supplied workflow inputs. Before each dispatch it refuses an
  active matching workflow; after dispatch it refuses more than one new run or
  a different source SHA.
- It downloads only `harmoniarr-browser-isolation-evidence` into a freshly
  created system temporary directory, reads only the expected JSON filename,
  validates the existing evidence schema, and removes the temporary directory
  in `finally`.
- The durable manifest remains workspace-bound and allow-listed. It contains
  only run ID, terminal workflow metadata, and the pre-existing bounded test
  evidence—never user data, request data, logs, URLs, local paths, credentials,
  process command lines, or artifact archives.

## Final recommendation stack

1. **Use the serial collector** for the ten-run sample from one stable `main`
   commit; do not change the two-worker policy while collecting it.
2. **Run the strict review immediately afterward** and treat every status
   other than `baseline_confirmed` as a reason to retain the current policy.
3. **Keep terminal cancellations and unavailable artifacts in the manifest**
   rather than retrying or replacing them invisibly.
4. **Keep artifact collection local and bounded**; do not introduce a
   privileged `workflow_run` automation path.
5. **Perform accessibility evaluation separately** using representative
   operator and requester flows; CI stability evidence is not a conformance
   statement.

## Official sources checked 2026-08-29

- [W3C WCAG-EM 2.0](https://www.w3.org/TR/wcag-em-2/)
- [GitHub: manually running a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [GitHub: workflow-run REST API](https://docs.github.com/en/rest/actions/workflow-runs)
- [GitHub: workflow REST API](https://docs.github.com/en/rest/actions/workflows)
- [GitHub: secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
