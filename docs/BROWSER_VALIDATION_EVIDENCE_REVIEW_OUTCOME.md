# Browser Validation Evidence Review — Outcome

**Status:** Implemented and locally validated
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

- Five focused browser-evidence review tests passed.
- `npm run lint:scripts`, `npm run lint:test`, and `npm run test:scripts`
  passed; the script suite reported **291 passing tests**.
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

## Remaining operational step

Collect nine additional consecutive fixed-configuration `Browser Validation`
artifacts from `main`, add this run's evidence as the first selected sample,
build the manifest described in the design, and run the local command. This
successful run is evidence of no regression, not a substitute for the full
ten-run baseline. Do not raise browser worker count until that report is
`baseline_confirmed`.

## Related design

See [Browser Validation Evidence Review Design](BROWSER_VALIDATION_EVIDENCE_REVIEW_DESIGN.md).
