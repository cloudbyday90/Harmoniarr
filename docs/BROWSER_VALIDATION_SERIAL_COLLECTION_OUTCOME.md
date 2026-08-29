# Browser Validation Serial Collection — Outcome

**Status:** Collector implemented; production sample pending
**Date:** 2026-08-29

## Delivered result

Harmoniarr now provides `npm run collect:browser-evidence`, a local ESM
command that performs the agreed serial Browser Validation collection and
writes the input manifest for the existing review command. Its GitHub transport
and serial collection policy are separate modules. It does not change the
GitHub workflow, the two-worker policy, the self-hosted runtime, or the
multi-user data model.

The collector captures a baseline `main` SHA, refuses active Browser
Validation runs, dispatches one run at a time, requires exactly one new run at
that SHA, waits for completion, and persists only strict evidence from the
named artifact. A terminal run without usable evidence is retained with
`evidence: null` and stops the collection safely.

The review contract is now schema version 2. It accepts the version-1
historical manifest unchanged, while version 2 records all documented terminal
GitHub conclusions and reports unavailable evidence rather than discarding it.

## Open pull-request assessment

The three open Dependabot pull requests were assessed locally and remain
inapplicable to this focused work:

- PR #23 proposes `docker/metadata-action` 6.1.0, while `main` pins 6.2.0.
- PR #24 proposes `docker/build-push-action` 7.2.0, while `main` pins 7.3.0.
- PR #40 moves a controlled fixture to Node 26.7.0, outside Harmoniarr's
  supported Node 24 engine range.

No pull request was merged or applied locally because none improves the
Browser Validation evidence boundary safely.

## Validation record

- Focused review and collection tests: **13 passed**.
- `npm run lint:scripts` passed after the collector and review changes.
- `npm run lint:test` passed after the focused test additions.
- The collector tests prove the successful serial path, terminal cancellation
  with unavailable artifact retention, existing-run refusal, source-SHA drift
  refusal, safe workspace path handling, and temporary-directory cleanup.

## Production collection procedure

After this implementation commit is pushed, dispatch the collector on that
unchanged `main` commit. It will create the ten-sample manifest, after which
the existing review command will write the final report. The result must be
`baseline_confirmed` before any browser worker-capacity experiment is planned.

See [Browser Validation Serial Collection Design](BROWSER_VALIDATION_SERIAL_COLLECTION_DESIGN.md) for the complete methodology and security boundary.
