# Ignored-source route admission outcome

Date: 2026-10-20. See the separate [design](IGNORED_ROUTE_ACCESS_DESIGN.md),
[research and tradeoffs](IGNORED_ROUTE_ACCESS_RESEARCH_2026_10.md) and
[Docker outcome](LOCAL_DOCKER_IGNORED_ROUTE_ACCESS_OUTCOME.md).

Ignored-source review now admits only administrators and removes its Activity
diagnostic link for other/unknown roles. A small ESM policy owns the reviewed
route/role decision and current-session verification. The immutable diagnostic
inventory stays separate from a role-filtered projection that retains unrelated
destinations and their relative order.

The global guard retains the existing initial session read. With an already
cached session, it awaits a fresh session read before entering this page. Role
revocation redirects to Home without forwarding the query; anonymous and required
password-change checks retain precedence. Failed cached-session verification
cancels the navigation and shows the existing bounded error toast, keeping the
invoking focus and allowing retry. Other routes gain no new session read.

This is navigation admission, not API authorization or continuous revocation of
an already mounted page. The ignored-source APIs retain independent admin/session/
freshness/CSRF enforcement. No backend/shared code, endpoint, schema, dependency,
queue, version or operation command changed.

Validation used Node 24.22.0/npm 12.0.2 with Vue 3.5.44/Router 5.2.0:

- `node --test test/client/activity-route-access-policy.test.js test/client/activity-diagnostic-navigation.test.js test/client/auth-navigation.test.js test/client/ignored-source-review-handoff.test.js`
  passed all 12 focused cases in 0.99 seconds. They cover exact roles, unknown-role
  denial, unchanged unrelated navigation, no extra unreviewed-route reads, held
  verification, Error/null refusal and bounded return/auth behavior.
- `npm run validate:fast` passed 5,592 server, 4,413 client and 697 script tests:
  **10,702 total**, zero failures/cancellations/skips, plus static checks, full
  lint and both builds. Test phases took 65.6/6.5/6.0 seconds. These are local
  observations, not a matched performance comparison or whole-CI claim.
- The line-ending preservation step overlapped the fast command's initial static
  phase because the validation command was launched early. Node baseline,
  copyright, migration, schema snapshot, ESM, image-tag and Compose topology
  checks were repeated against the recorded final source; all passed. No
  functional code changed, and final code/source bytes are verified. This keeps
  the correction explicit without repeating unrelated passing test cohorts.
- `node --test --test-concurrency=1 test/browser/ignored-source-route-access.test.js test/browser/ignored-source-review-return.test.js test/browser/runtime-navigation-browser-verification.test.js`
  passed six unique browser cases in 74.0 seconds. They use real PostgreSQL,
  sessions, API responses, the built app shell and actual lazy-route navigation.
  The new admission journey holds a real session response and proves the page
  does not mount or request its ignored-source data before verification completes.
- Operator/requester/anonymous direct links are refused before page API reads,
  including forged query role/context. The APIs independently return 401/403;
  refused non-admin POST/DELETE requests leave source policy unchanged. Operator
  diagnostic links other than the reviewed destination remain present, and both
  operator/requester Missing Music navigation remains available.
- A cached administrator is forced through password change when current facts
  require it. A later native role withdrawal refuses page entry without ignored-
  page API reads. A controlled verification 503 cancels entry, keeps focus and
  shows fixed feedback without the supplied private error; removing that fault
  permits ordinary retry. Navigation sends no policy/search mutations.
- The real ignored-source return/explicit-save journey and bounded-context
  refusal cases remain green. The earlier role-withdrawal expectation now checks
  Home admission refusal instead of an unusable page shell. The Settings control
  retains real keyboard lazy-child navigation/history without document reload.
- The three owning browser cases passed again in 14.1 seconds after adding
  actual Tab adjacency/visible-focus proof between Source blocklist and System
  history, and focusing the mobile capture on the changed Source/history group.
  Six unique cases plus that repeat are not nine distinct cases. The inspected
  390px light subgroup and 800px dark/1280px light navigation captures retain
  meaningful order. DOM/focus evidence does not establish screen-reader output
  or full WCAG conformance.
- The web-standards skill's focused reference now records current-session route
  admission versus endpoint authority, existing auth ordering and mounted-view
  limits. Skill structure and local Markdown links were checked.

Recorded source: 3,175 files,
`9b9bb4a8962ae5ddebd8d7d3beb9231bcb154c6755709a416a9c70a93ad4f0b5`.
All eight changed code/test files are byte-verified. Focused/browser evidence
preceded line-ending preservation with unchanged logic; final static checks and
packaged client comparison use final bytes. No exhaustive integration/media
matrix was repeated for this client navigation boundary. Private evidence lives
under `.tmp/ignored-route-access-2026-10-20/`.

Random PR #48 remains unapplied after fresh MCP metadata/complete patch, lock hash
and installed consumers matched retained TypeScript 7 Vue-language-service failure
and TypeScript 6 control evidence. No merge, rebase, closure, separate branch,
release, tag or version change was created.

Next: review and align Source users and Source blocklist route admission with
their existing administrator-only API contracts. The current route inventory
marks their reads/mutations admin-only; this change deliberately leaves those
routes and other operator destinations unchanged. Qualify each before extending
the shared policy, retaining independent server authorization.
