# Browser Validation Serial Collection — Outcome

**Status:** Complete — two-worker baseline requires review
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

## Production evidence result

The collector completed ten serial `workflow_dispatch` runs from commit
`379503181119ed5abaf3db92def78bab766ce23b`. The strict review report is
[Browser Validation serial collection report](evidence/BROWSER_VALIDATION_SERIAL_COLLECTION_2026-08-29_REPORT.json),
with its immutable input in
[Browser Validation serial collection manifest](evidence/BROWSER_VALIDATION_SERIAL_COLLECTION_2026-08-29_INPUT.json).

- Result: **review required** — not a confirmed browser-capacity baseline.
- Browser tests: **3 passed / 7 failed**.
- Worker count: **2** in all ten retained samples.
- Teardown: **clean** in all ten samples; every artifact recorded zero browser
  test processes and zero Testcontainers after cleanup.
- Browser-suite durations: 243.3 seconds minimum, 284.3 seconds median,
  317.6 seconds p95 and maximum.
- The only strict-review finding is `browser_test_failed` for runs
  `33252413541`, `33253164543`, `33253429045`, `33253646628`, `33253857831`,
  `33254475076`, and `33254757876`.

The failures are UI navigation/readiness timeouts in several unrelated
operator and requester scenarios. The Artist Detail cache sample appeared in
several failures, but the direct bounded cache workload contract passes; this
evidence does not establish a Discography or related-artists cache data error.

The first collector process ended after run `33254133701` completed but before
its artifact was persisted. The recovery path was extended and tested to
retain that run safely: it requires the same source SHA, a new ID, a terminal
state, and a start time after the already-retained sequence. No result was
replaced or rerun.

## Validation record

- Focused review, collection, and workflow-contract tests: **16 passed**.
- `npm run lint:scripts` passed after the collector and review changes.
- `npm run lint:test` passed after the focused test additions.
- The collector tests prove the successful serial path, terminal cancellation
  with unavailable artifact retention, existing-run refusal, source-SHA drift
  refusal, safe workspace path handling, and temporary-directory cleanup.
- The collector also persists a completed dispatch after an interrupted
  operator session, resumes an existing partial manifest, and safely recovers
  one completed run that was not yet written to that manifest.
- The local Compose walkthrough was rebuilt successfully: the image built,
  Harmoniarr restarted healthy at `127.0.0.1:47956`, and the one-shot
  bootstrap recognized the existing walkthrough administrator.

## Production collection procedure

The two-worker policy must not be increased or treated as reliable. The next
change runs Browser Validation serially in CI while retaining two-worker local
investigation. See
[Browser Validation Runtime Stability Design](BROWSER_VALIDATION_RUNTIME_STABILITY_DESIGN.md).

After the serial CI change is pushed, require one passing Browser Validation
run with `cleanup.status: clean`. Investigate the two-worker runtime separately
before any capacity experiment; a serial pass does not prove the failed
two-worker configuration healthy.

See [Browser Validation Serial Collection Design](BROWSER_VALIDATION_SERIAL_COLLECTION_DESIGN.md) for the complete methodology and security boundary.
