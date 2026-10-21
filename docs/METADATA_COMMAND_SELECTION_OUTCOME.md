# Metadata command selection ownership outcome

Date: 2026-10-21. See the [design](METADATA_COMMAND_SELECTION_DESIGN.md) and
[official research, tradeoffs and recommendation stack](METADATA_COMMAND_SELECTION_RESEARCH_2026_10.md).

## Result

Refresh captures the artist selection before submitting its command. Release
imports capture the target, artist and active group, then retain one release
selection token through command acceptance and catalog reads. Artist follow-up
publication requires both its original artist generation and the release
command generation. Leaving and returning to the same resource does not restore
an old token. Late results, errors and pending cleanup cannot replace a newer
workspace or clear its current command state.

The existing request-gate module now exposes capture without advancing ownership
or cancelling active reads. The two ESM workflow factories coordinate pending
state and retain their existing read-abort contracts. Import/refresh POSTs receive
no navigation abort signal; accepted server work remains accepted. The client
adds no retries, queue, global state framework, backend/schema or dependency
changes. Fresh server authority and CSRF stay unchanged.

The project [web standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now routes this work to the selection design, including same-ID reselection,
borrowed ownership, stale errors/cleanup and accepted-POST distinctions. Its
structural validator passed. No global skill installation was needed.

## Validation and retained failures

- The initial seven controlled workflow cases failed against the previous
  implementation: stale refresh success/error, group/release follow-up dispatch,
  held lookup publication, artist catalog publication and stale error/cleanup.
- Final focused selection: 69 passed. Eight new command-race cases and one gate
  capture case supplement existing workflow, authority, route and API checks.
  They also retain current errors, duplicate-refresh refusal, aborted read signals
  and pending state for a new command after an obsolete completion.
- The first focused candidate passed 36 of 37 cases. The existing positive import
  test expected the old one-argument lookup/refresh calls. Updated it to verify
  the original target/artist plus the new read signal and current ownership
  callback. The subsequent focused selection passed.
- Selected browser proof covers 16 unique cases: 13 existing cache/authority/
  Settings consumers and three new selection cases. The first combined run
  passed 14/16: a new release test's locator matched two cards, and the following
  refresh case failed during database-pool setup with `database_pool_closing`.
  Corrected the card selector and ensured a held, already fetched response is
  delivered during failure cleanup. No application code changed after that run.
  All three new cases then passed in about 13 seconds; the 13 already-passing
  consumers were not repeated. Repeated cases are not added to unique coverage.
- New browser cases hold native 201/202 responses after actual server guards and
  command-owner dispatch, change selection through native keyboard controls, and
  release the accepted response. They prove one dispatch, absence of obsolete
  follow-up reads, current selected detail, preserved user focus and current
  refresh behavior after same-artist reselection. Real PostgreSQL sessions and
  required CSRF are used, with controlled catalog/command services. These cases
  do not establish durable MusicBrainz imports or refresh worker completion.
- Final `npm run validate:fast`: 10,720 passed; server 5,592, client 4,431, scripts
  697; zero failed/cancelled/skipped. Static baseline, copyright, migration/schema,
  ESM, image/topology, full lint, hygiene and both builds passed. The 225 existing
  Vue lifecycle warnings remain. All 155 browser-tested client artifacts match
  the final fast build byte for byte.

Final frozen source: 3,190 files,
`9caaaa21267b910428d8fd8c656432a86c7ee11b835abf81f6c709a8e8e5a38b`.
Seven resulting code/test files are byte-verified through staging. The frozen
candidate receives the final focused/static/fast and packaged-runtime checks;
browser build equality preserves the actual tested client artifact boundary.
Private failed/passing evidence remains in `.tmp/metadata-command-selection-2026-10-21/`.
See the separate [Docker outcome](LOCAL_DOCKER_METADATA_COMMAND_SELECTION_OUTCOME.md).

No timeout, worker count, assertion threshold or skip changed. This is selected
native/browser coverage, not the complete provider/database/browser matrix,
assistive-technology testing, general WCAG conformance, full application drainage
or a matched whole-suite speed claim. Healthy later fixtures do not explain the
earlier setup failure.

## PR applicability and next item

MCP returned zero open PRs. No random candidate, merge, rebase or stale-PR closure
was applicable. All intended changes stay on main; no release, tag, version bump
or separate branch is created.

Completed by the [detection-history outcome](METADATA_DETECTION_HISTORY_OUTCOME.md):
the history reader now owns workspace/page generations and resets before
navigation or catalog replacement. That outcome records its ordinary paging,
stale-response and native session/abort proof, plus the next reader to qualify.
