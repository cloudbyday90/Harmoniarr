# Role-aware Settings landing outcome

Date: 2026-10-21. Implements the [landing design](SETTINGS_LANDING_DESIGN.md).
Official guidance, alternatives, pros/cons and the selected stack are recorded in
the separate [research document](SETTINGS_LANDING_RESEARCH_2026_10.md).

## Behavior and ownership

Settings' focused ESM policy now owns both Setup and Connections. The existing
composed route service verifies a current session before either page mounts.
Bootstrap, login and mandatory password-change precedence remain intact. Other
authenticated roles visiting the Settings root reach the fixed named Account
destination with replacement history. Setup query/hash context is discarded at
that role redirect; authentication handoffs still preserve their original target.
The duplicate requester-only root restriction is removed from the old route set.

The global Settings link retains its label, relative position and `/app/settings`
URL. Its landing is decided after verification. Settings navigation omits Setup
and Connections for non-admin/unknown roles, retaining surviving link order and
both ordinary Account aliases. Account opens the existing secondary disclosure.
When role filtering removes the focused tab, the workspace reuses the existing
interaction-focus tracker and moves focus to its surviving disclosure button
after rendering. It preserves a user's move elsewhere during pending verification.

API authorization, CSRF, freshness and mutation contracts are unchanged. A mounted
view continues to rely on server checks after revocation. Surviving Settings tabs
are not all qualified for every role by this change. No backend, migration,
dependency, release, tag or version change is included.

## Executed validation

- Focused policy/navigation/progressive-disclosure tests: 24 passed.
- Selected real PostgreSQL/browser coverage: 17 unique cases passed across the
  retained existing cohort and final focused run. This is selected coverage,
  not the complete browser or database matrix.
- Full `npm run validate:fast`: 10,707 passed, zero failed/cancelled/skipped:
  server 5,592; client 4,418; scripts 697. Static baseline, copyright, migrations,
  schema, ESM, image/topology, test hygiene, full lint and both builds passed.
- The fast gate retained 225 existing Vue lifecycle warnings, the same count as
  the preceding gate. It is not warning-free. Skill structural validation passed.
- Inspected the actual 390-pixel mobile Account capture. Existing responsive
  Connections checks also cover 800-pixel dark and 1280-pixel light navigation.

The three new browser cases prove: held native session response before actual
successful admin settings/status reads; bootstrap/login precedence; operator and
requester direct root landing with forged query context; native desktop/mobile
global Settings entry; replacement history/back/forward; Account aliases and
disclosure; bounded verification failure/focus/retry; mandatory password change;
cached role revocation; API refusal; and no focus theft after a user moves during
a held real session response. The native successful-read fixture explicitly
disables its isolated provider before observation; it starts no live provider work.
The 14 existing cases retain Activity/Connections admission, lazy Settings
navigation and the controlled provider recovery handoff. Browser-observed
protected entry performs no domain mutation.

Two earlier 17-case runs each passed 16 and failed one new case: first a
case-sensitive disclosure-name selector, then an incorrect navigation role for
the existing named `aside` landmark. Both failures are retained. The second run
already tested the final production modules and passed all 14 existing cases.
The final edit corrected only that new test's landmark selector; byte comparison
confirms every other changed code file is identical. The three new cases then
passed together in 14.574 seconds. Existing cases were not rerun a third time;
repeated cases are not counted as additional coverage. No timeout, worker count,
assertion threshold or production contract was loosened.

Frozen source: 3,182 files,
`8b095744011b290cc4cf63a9dbac85ca1a1866bd5d118505b59441f389d16aea`.
Seven resulting code/test files are byte-verified. The fast gate and packaged
build use this candidate. Private evidence is retained under
`.tmp/settings-landing-2026-10-21/`. The
[Docker outcome](LOCAL_DOCKER_SETTINGS_LANDING_OUTCOME.md) records actual runtime
and preserved-state readiness separately. These checks do not establish full
WCAG conformance or screen-reader announcements.

## PR applicability and next item

MCP returned zero open PRs; no random open candidate was available. Refreshed
metadata confirms [PR #54](https://github.com/cloudbyday90/Harmoniarr/pull/54) is
closed without merge and its exact pin is already on main from the preceding
round. No PR patch, rebase or merge was performed in this round.

The recommended remaining Settings matrix is completed in the
[Settings authority outcome](SETTINGS_AUTHORITY_OUTCOME.md). Current-admin
admission now covers the six additional deployment pages, while personal
Notifications/Account and operator metadata browsing retain distinct policies.
That follow-up also removes the old requester-only Notifications restriction.

All intended changes remain on main; no separate branch is created.
