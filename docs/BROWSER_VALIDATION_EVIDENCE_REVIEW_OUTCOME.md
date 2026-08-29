# Browser Validation Evidence Review — Outcome

**Status:** Sample-integrity hardening implemented; baseline blocked
**Date:** 2026-08-29

## Delivered result

Harmoniarr now has a small local ESM command that validates a Browser
Validation manifest and writes a bounded JSON review. It confirms the existing
two-worker baseline only when exactly ten selected runs passed and cleaned up,
without changing the CI workflow's permission boundary.

`npm run review:browser-evidence` requires workspace-relative input and output
paths through `HARMONIARR_BROWSER_TEST_EVIDENCE_REVIEW_INPUT_PATH` and
`HARMONIARR_BROWSER_TEST_EVIDENCE_REVIEW_OUTPUT_PATH`. The command does not
download artifacts, call GitHub, execute artifact content, or retain raw logs.

## Open pull-request assessment

Three open Dependabot pull requests were reviewed locally and not merged:

- PR #23 proposes `docker/metadata-action` 6.1.0, while `main` already pins
  6.2.0.
- PR #24 proposes `docker/build-push-action` 7.2.0, while `main` already pins
  7.3.0.
- PR #40 changes the controlled fixture to Node 26.7.0, which conflicts with
  Harmoniarr's supported Node 24 engine range.

None is safe or useful to apply to this focused evidence-review change.

## Validation record

- Seven focused browser-evidence review tests passed.
- `npm run lint:scripts`, `npm run lint:test`, and `npm run test:scripts`
  passed; the script suite reported **293 passing tests**.
- `npm run validate` passed, including copyright, migration, schema, ESM,
  Compose, lint, hygiene, server, client, script, integration, and production
  build checks.
- The exact ten-sample happy path verifies `baseline_confirmed`, a 2/10 sample
  verifies `incomplete`, and browser failure, cleanup drift, worker-count
  drift, duplicate run IDs, extra fields, malformed JSON, and identical or
  out-of-workspace paths are rejected or reported safely.
- [Browser Validation run 33247929097](https://github.com/cloudbyday90/Harmoniarr/actions/runs/33247929097)
  passed remotely. Its isolated browser suite, bounded evidence summary, and
  366-byte `harmoniarr-browser-isolation-evidence` artifact all completed
  successfully; the artifact expires 2026-09-12.

## First collection attempt

One ordinary push-triggered Browser Validation run completed successfully at
commit `26ecfc0`, but it is outside the stricter `workflow_dispatch` sample
scope. Nine follow-up `workflow_dispatch` runs at commit `4e4d9bb` were started
in rapid succession. Their full bounded input and generated result are retained
in [the input manifest](evidence/BROWSER_VALIDATION_EVIDENCE_REVIEW_2026-08-29_INPUT.json)
and [the review report](evidence/BROWSER_VALIDATION_EVIDENCE_REVIEW_2026-08-29_REPORT.json).

Every one of the nine dispatcher-scoped artifacts reported two workers and
`clean` cleanup with zero remaining Testcontainers and browser-test Node
processes. Every browser suite nevertheless failed. The observed failures were
different 30-second semantic locator and route-navigation waits, including
artist detail, Library, Activity, Search, requester history, and legacy
Downloader handoff paths. The report therefore records `review_required` with
the exact run IDs, a 9/10 shortfall, overlapping workflow runs, and failed
browser tests; it does not expose raw logs, user data, or provider details.

This does **not** establish a browser reliability baseline. More importantly,
the nine runs overlapped, so hosted-job concurrency became an unrecorded test
variable. The evidence is retained as a failed collection attempt, not omitted
or replaced. The review contract now requires a single source
commit and non-overlapping completed `workflow_dispatch` runs before it can
return `baseline_confirmed`.

## Sample-integrity hardening

The manifest contract now requires allow-listed source metadata for each run:
the `main` branch, `workflow_dispatch` event, lowercase 40-character source
commit, terminal workflow conclusion, and start/completion timestamps. It
rejects unexpected source fields and records source-commit changes, workflow
outcome mismatches, and overlapping intervals as review findings. The overlap
algorithm retains a run with the latest completion time so it also detects a
long run overlapping a later non-adjacent run.

This adds no GitHub workflow, workflow permission, token, raw log, or archive
processing to Harmoniarr. Artifact download remains an operator-controlled,
read-only action and the local review parses only its strict JSON schema.

## Post-hardening remote confirmation

[Browser Validation run 33248920107](https://github.com/cloudbyday90/Harmoniarr/actions/runs/33248920107)
ran from the sample-integrity commit and failed in the browser suite while its
setup, evidence summary, and artifact upload completed. Its bounded artifact
again recorded two workers and clean teardown with zero remaining containers or
browser-test processes. The failures were a 30-second Artist Detail heading
wait and a requester Search heading wait, confirming that the next repair is a
real page-readiness problem and not an artifact-collection or cleanup issue.

## Page-readiness repair

The browser integration runtime now fixtures the app-shell's unrelated
system-overview heartbeat before its first page is created. That removes live
provider-health checks from page-workflow scenarios while retaining the fixed
30-second timeout and two-worker policy. See [Browser Page-Readiness Fixture
Design](BROWSER_PAGE_READINESS_FIXTURE_DESIGN.md) and [Browser Page-Readiness
Fixture Outcome](BROWSER_PAGE_READINESS_FIXTURE_OUTCOME.md) for the scoped
decision, security boundary, and next validation step.

After the resulting Browser Validation run is reviewed, collect a new serial
set of ten `workflow_dispatch` artifacts from one unchanged `main` commit. Do
not raise browser worker count until that report is `baseline_confirmed`.

## Related design

See [Browser Validation Evidence Review Design](BROWSER_VALIDATION_EVIDENCE_REVIEW_DESIGN.md).
