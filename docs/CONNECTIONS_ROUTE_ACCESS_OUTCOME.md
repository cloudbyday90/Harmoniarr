# Settings Connections admission outcome

Date: 2026-10-21. Implements the [design](CONNECTIONS_ROUTE_ACCESS_DESIGN.md) and
[official-source recommendations](CONNECTIONS_ROUTE_ACCESS_RESEARCH_2026_10.md).

Connections now requires a current administrator session before page mount.
Activity and Settings retain separate role policies, composed by the focused
common route-access service. The router keeps authentication precedence, bounded
verification failure/retry and existing unrelated-route rules. The session
mechanism moved out of Activity without duplicating guards or session state.

Settings navigation now has an immutable inventory and role-aware projection.
Connections and the global health panel's View in Settings link are hidden for
non-admin/unknown roles. Account remains available through both ordinary aliases,
and other tabs retain their existing order/policies. Primary Settings controls
receive a scoped two-pixel inset focus cue using existing tokens. Backend routes,
admin/freshness/CSRF checks, schema and saved credential contracts are unchanged.

## Executed evidence

- Twenty-five focused cases passed for area/composed role decisions, pending/
  Error/null session verification, Account aliases, navigation immutability and
  Settings disclosure behavior. Earlier source-text assertions about arrays in a
  component now inspect the semantic navigation inventory instead.
- The final selected PostgreSQL/browser cohort passed all 14 cases in 60.5 seconds:
  three Connections cases, nine Activity admission controls, one real lazy
  Settings navigation/history case and one controlled-payload Downloader recovery
  handoff. This retains existing Activity behavior after moving the common guard.
- Connections holds an actual native session response before mount, with zero
  settings/status reads while pending, then observes both real authorized API
  responses. The disposable fixture saves disabled Soulseek mode through the
  actual settings API before observation; opening the page performs no mutation
  or provider search/transfer. It does not claim a healthy live provider.
- Anonymous/operator/requester direct links and forged role/recovery queries are
  refused. Ten protected read/write/link/OAuth/collection method/path contracts
  per actor return 401/403 independently of browser navigation. Current-session
  revocation, password-change precedence, bounded failed verification/retry and
  ordinary Account access pass. The global health link is absent for an operator.
- Native Tab order follows Setup → Connections for admin and Setup → Media &
  storage for operator. Inspected 390px light, 800px dark and 1280px light captures
  preserve the surviving navigation; the mobile secondary capture retains Account.
  These checks do not establish screen-reader output or full WCAG conformance.
- The first 14-case cohort passed 12 cases and exposed two new focus assertions:
  browser-default outlines were one pixel, below the project's two-pixel cue
  convention. After the scoped cue change, a three-case repeat passed two and
  exposed an unconfigured native status fixture that could not satisfy its 200
  waiter. Explicit disabled-mode preparation fixed that precondition; the native
  case passed alone in 7.5 seconds, then the entire final cohort passed. These
  repeats are not additional unique cases. Original logs remain retained; no
  deadline, assertion threshold or worker count was relaxed.
- The stable `npm run validate:fast` passed 10,706 tests: 5,592 server, 4,417 client
  and 697 script cases, with zero failures, cancellations or skips. Static
  baseline/copyright/migration/schema/ESM/image/topology checks, full lint, hygiene
  and both builds passed. Existing client-fixture Vue lifecycle warning count
  matches the prior gate (225); this is not a warning-free test claim. No exhaustive
  integration/media matrix was repeated for the client boundary.
- The standards AI skill now records area ownership, endpoint permission
  distinctions, Account preservation, focus-cue conventions and action evidence
  limits. Skill structural validation passed.

Frozen source: 3,181 files,
`ac60b597b65064654d08d11d4ede5333e89eb0a395f974436d1d4ff8e115f39e`.
Thirteen resulting code/workflow/test files are byte-verified. The final browser
cohort, full fast gate and packaged build use this candidate. Private evidence is
retained under `.tmp/connections-route-access-2026-10-21/`. See the separate
[Docker outcome](LOCAL_DOCKER_CONNECTIONS_ROUTE_ACCESS_OUTCOME.md).

## Random PR implemented locally

MCP found one open PR and the random draw selected
[PR #54](https://github.com/cloudbyday90/Harmoniarr/pull/54), head
`b0f1bc3a00b58c2667145befa7cbc2178f78dcdd`. Its exact one-line QEMU action SHA
update to v4.4.0 is applied locally. Semantic comparison verifies no other
workflow, permission, release event or input change, and QEMU remains before
Buildx. The workflow still requires explicit manual dispatch; none was performed.

Local actionlint 1.7.12 passed. Reviewed Node 24 metadata preserves image/platform/
cache defaults; new reset defaults false. First-party modules remain ESM. The
vendor's packaged entrypoint is CJS and is not copied into application source.

Nine controlled cases execute the SHA-verified upstream main body after type
stripping with injected Docker/core/context dependencies: default/reset success,
pull/inspect/version/install/extract/reset failures and invalid platform JSON.
They verify the reviewed source's command/error/output behavior, not the packaged
action or actual registration. The private Node type-stripper warning is retained.
Separately, an acknowledged read-only, network-isolated ARM64 container executed
Node 24.22.0 successfully through existing Docker Desktop emulation and retired.
No host emulator registration was changed. Packaged action execution, fresh-runner
privileged registration and hosted caches remain unqualified locally; a future
non-publishing runner check should cover them. No PR merge was performed.

## Next item

Make the Settings landing route role-aware. Setup currently mounts the same
admin-only settings/status readers, while the global Settings destination still
opens Setup. Qualify that root boundary and route non-admin users to Account,
preserving the reviewed ordinary aliases and avoiding another refused setup page.
Other Settings destinations require individual contract review; this change does
not establish that every surviving tab is usable by every role.

Work remains on main. No separate branch, release, tag or version bump is created.
