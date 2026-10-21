# Settings page authority outcome

Date: 2026-10-21. Implements the [route/API design matrix](SETTINGS_AUTHORITY_DESIGN.md).
Official sources, alternatives, pros/cons and the selected stack are in the
separate [research document](SETTINGS_AUTHORITY_RESEARCH_2026_10.md).

## Result

The focused ESM Settings policy now classifies eight admin deployment pages.
Media & storage, Library, System & security, Users & access, user detail, and
Backup & restore join Setup/Connections under the existing current-session
guard. Each newly protected page waits before mounting its readers. The area
policy replaces duplicate Settings entries in the old requester denylist.

Personal Notifications and both Account aliases remain available. Removing the
legacy Notifications denylist entry also repairs requester entry to its valid
own-user API. Operator metadata browsing remains available, while requester
metadata entry retains its prior product refusal. That distinction does not
make the authenticated metadata APIs admin-only. Unknown roles cannot enter
reviewed deployment or operator metadata destinations.

Navigation projects the same area rules: non-admin primary links contain
Notifications; secondary links contain Account and, for operators, Metadata
browser. Admin order is unchanged. The workspace uses personal copy for non-admin
roles. Existing native controls, disclosure behavior, owned focus fallback,
root-to-Account redirect, authentication precedence and bounded retry remain.

No API, server permission, schema, dependency or mutation implementation changed.
Mounted views still rely on API enforcement after revocation. Metadata's mixed
privileged controls are a separate follow-up; this round preserves entry rather
than qualifying provider searches, imports or refreshes.

## Validation

- Focused policy/navigation, disclosure, recovery and notification-category tests:
  31 passed. Focused lint and the browser prerequisite build passed.
- Nine new native PostgreSQL/browser cases passed in 26.351 seconds. Six held
  actual session responses before every mounted reader, then observed native
  successful reads for each new deployment page. Role cases exercised direct
  and legacy links, twelve read contracts and three mutation refusals for
  anonymous/operator/requester actors. Personal cases saved notification changes
  through the real browser/API, verified persistence via the current user's
  independent client, and compared unchanged administrator preferences. Operator
  metadata aliases rendered; requester aliases refused. Media failure/retry and
  cached revocation stayed bounded.
- Seventeen existing browser cases passed in 75.845 seconds: Activity/Connections
  and Setup admission, Account/root behavior, focus ownership, current-role and
  password precedence, responsive navigation, lazy Settings/history, and the
  controlled Downloader setup handoff.
- One explicitly selected existing folder-repair case passed in 7.888 seconds.
  Its Settings GET/session path is native; save/path-validation and Missing Music
  execution responses are controlled. It proves scoped return to the same
  recipient decision and an explicit canonical recheck after saving, not actual
  filesystem repair or native library publication.
- Full `npm run validate:fast`: 10,707 passed, zero failed/cancelled/skipped:
  server 5,592; client 4,418; scripts 697. Static baseline, copyright, migrations,
  schema, ESM, image/topology, full lint, hygiene and both builds passed.
- Skill structural validation passed. Inspected the real 390-pixel requester
  Account capture and retained the existing responsive navigation checks. The
  fast gate has 225 pre-existing Vue lifecycle warnings, unchanged from the prior
  gate; it is not warning-free.

All 27 selected browser cases passed without a failing candidate or repeated
case. The folder-repair test was selected by name from its larger file; unrelated
media cases were not executed. No timeout, worker count, assertion threshold or
skip was changed. This is selected native coverage, not the complete database,
provider or browser matrix, nor a general WCAG conformance claim.

Frozen source: 3,183 files,
`c5be3a87e8542ff8f310a3c227255236ffea8b0b386bf3cd0467875ee3dd1c1e`.
Eight resulting code/test files are byte-verified. All selected browser cases,
the final fast gate and packaged build use this candidate. Private evidence is
retained under `.tmp/settings-authority-2026-10-21/`. See the separate
[Docker outcome](LOCAL_DOCKER_SETTINGS_AUTHORITY_OUTCOME.md).

## PR applicability and next item

MCP returned zero open PRs, so no random open candidate was available to implement
locally. No PR merge or rebase was performed. All intended changes remain on
main; no branch, release, tag or version bump is created.

Completed by the [Metadata command authority outcome](METADATA_COMMAND_AUTHORITY_OUTCOME.md):
the three privileged commands now use explicit capabilities and guarded dispatch,
while operator reads and authenticated artist import remain available. Its next
item is qualification of delayed command results against the selected workspace.
