# Source-policy admission outcome

Date: 2026-10-21. Implements the [design](SOURCE_ROUTE_ACCESS_DESIGN.md) and
[official-source recommendations](SOURCE_ROUTE_ACCESS_RESEARCH_2026_10.md).

Source users and Source blocklist now join ignored-source review in the existing
shared ESM admission policy. Both the router and diagnostic-link projection use
that decision. Current admin verification completes before mounting these pages;
other/unknown roles lose their links and direct entry returns to Home. Cached
verification failure keeps the existing shell and bounded retry feedback.
Server routes, admin/freshness/CSRF enforcement and data contracts are unchanged.

## Executed validation

- Five focused policy/projection cases passed. They cover all three reviewed
  destinations, unknown roles, held verification, error/null rejection and
  unchanged unrelated routes without extra session reads.
- Ten real PostgreSQL/browser cases passed together in 45.6 seconds: seven in
  the expanded source-policy suite, two canonical ignored-review return controls
  and one lazy Settings keyboard/history control. The suite is now named
  `test/browser/activity-source-route-access.test.js`; it replaces the narrower
  ignored-source file rather than duplicating its fixture or scenarios.
- Each reviewed destination holds an actual native session response before
  admission, with zero destination reads until verification completes. Each also
  proves password-change precedence, cached admin-to-operator revocation and
  bounded verification failure followed by successful keyboard retry. Opening
  these pages emits no policy mutation.
- Anonymous/operator/requester direct links with forged role/return queries
  cannot enter the pages. The independent HTTP matrix checks 13 list/detail/
  export/single/bulk endpoints for 401 or 403 per actor; normal Missing Music and
  unrelated diagnostic links stay available. Current server permissions are
  authoritative even when browser navigation is bypassed.
- Actual Tab focus moves from Monitored artists to System history after the
  unavailable links are removed. The inspected 390px light subgroup and 800px
  dark/1280px light navigation captures preserve meaningful order. This evidence
  does not establish screen-reader announcements or full WCAG conformance.
- The stable final `npm run validate:fast` passed 10,702 tests: 5,592 server,
  4,413 client and 697 script cases, with zero failures, cancellations or skips.
  It also passed static baseline/copyright/migration/schema/ESM/image/topology
  checks, full lint/test hygiene and both builds. Test phases took 66.8, 8.2 and
  5.4 seconds. No exhaustive integration/media matrix or deadline increase was
  needed for this client admission change.
- The existing web-standards AI skill now teaches source-route ownership,
  export authorization, actual session gates, changed keyboard adjacency and
  full-scan versus PR-scan evidence limits. Skill structural validation passed.

Recorded source: 3,175 files,
`da529048a5a9d191d76c8241d189901a5ee1d6f7d460c33e4c76666e0c5de183`.
Five changed code/workflow/test files are frozen for final byte verification.
Browser evidence preceded whitespace preservation and test-variable naming
cleanup without behavior changes; the complete fast gate and packaged build use
the final candidate. Private logs are in `.tmp/source-route-access-2026-10-21/`.
The [separate Docker outcome](LOCAL_DOCKER_SOURCE_ROUTE_ACCESS_OUTCOME.md) records
preserved-state startup and readiness.

## Random PR implemented locally

MCP refreshed the three open PRs and randomly selected
[PR #53](https://github.com/cloudbyday90/Harmoniarr/pull/53), head
`ac3df84ab9ff2bb7f4c6ef8f00408f991872d12e`. Its exact one-line full-scan
SHA update to OSV v2.7.0 is applied in `security-scanning.yml`; the separate PR
comparison reference stays unchanged. No merge, rebase or closure was performed.
The candidate was mergeable against main, so it did not need stale-PR cleanup.

Local actionlint 1.7.12 passed. Reviewed upstream inputs, required token permissions
and SHA-pinned actions fit the existing caller, which does not consume exported
JSON results. The action's container remains vendor-tagged upstream; local proof
uses immutable digest
`sha256:d54770fe0b09493894e76a02aaed9f51a0513fa57c5186452a755d257b0068a6`.
This is not a claim that every transitive artifact is immutable.

The actual action scanner processed the unchanged root lockfile's 507 packages
and returned zero findings. The actual reporter generated SARIF 2.1.0 and exited
successfully. Only that copied manifest was mounted for scanning; no workspace
secrets or live application data were exposed. Three controls execute the exact
upstream completion-check shell: missing/empty result files fail; nonempty results
pass. All five acknowledged containers retired. The vendor's deprecated-output
flag warning is retained; its recommended reusable workflow supplies that flag.
This proves a completed local scan and reporting boundary, not GitHub-hosted
runner/checkout compatibility, artifact upload, SARIF publication or PR comparison.

## Follow-up

Next platform fix: qualify System history admission. Its diagnostic link remains
visible to operators; `useActivityHistory` reads `/api/v1/system/activity-feed`,
whose handler requires admin, while the router currently restricts requesters
only. Apply the same handler-to-route review and preserve empty-group filtering
and keyboard order before extending the policy. This round preserves that
destination's existing behavior rather than claiming its data is operator-readable.

Then qualify Settings > Connections admission and its visible tab against the
administrator-only settings API. `SettingsConnectionsView` mounts
`loadSettings`, and `SettingsWorkspaceView` exposes its tab; the existing router
restricts requesters but has no reviewed current-admin admission for operators.
The real settings GET already requires admin, and PUT requires fresh admin/CSRF.
Trace the remaining provider/setup reads before extending a shared policy,
retaining Account access and bounded recovery handoffs.

Separately, update and qualify OSV's older PR-comparison workflow, including its
two-checkout and failed-scan behavior, then inspect hosted full-scan evidence for
this pin. That is a distinct boundary from the selected PR's full scan.

Work stays on main. No release, tag, version bump or separate branch is created.
