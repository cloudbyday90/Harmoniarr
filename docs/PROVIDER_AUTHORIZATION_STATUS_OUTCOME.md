# Saved authorization status outcome

October 28, 2026. See separate [official research and tradeoffs](PROVIDER_AUTHORIZATION_STATUS_RESEARCH_2026_10.md),
[design](PROVIDER_AUTHORIZATION_STATUS_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_PROVIDER_AUTHORIZATION_STATUS_OUTCOME.md).

## Result

Uncertain Spotify/YouTube start or clear results now automatically check the
current administrator context and then the saved link through the existing GETs.
An accepted persisted handoff return does the same. Ordinary pageshow and an
unsettled command do not trigger reconciliation. The existing command result
remains visible separately; finding a saved link does not claim the preceding
start succeeded or a provider flow completed.

The new scoped ESM [read owner](../src/client/composables/useProviderAuthorizationStatus.js)
matches administrator identity, password-change state and CSRF context before
reading status. It projects only the target's bounded present/absent observation,
updating its saved linked flag without applying settings or copying arbitrary
response fields. Unknown/unavailable/malformed status preserves the older card
observation and reports that the check failed. An unconfirmed session refuses
further local command admission until an explicit check recovers. These reads
never write the global session store and do not replace either endpoint's current
server authorization or form an atomic cross-request authorization guarantee.

The owner coalesces pending retry activation, invalidates and aborts GETs before
newer commands or settings load/save, observes reactive session changes and
disposes its watcher/timer with the view. Identity fencing also suppresses stale
publication when a transport ignores abort. The 15-second read deadline releases
local admission and suppresses late completion; it does not establish server-side
cancellation. No command timeout, automatic POST replay, second deployed service,
schema refresh, maintenance change or dependency update was introduced.

The small [status component](../src/client/components/settings/SettingsProviderAuthorizationStatus.vue)
keeps a polite atomic status paragraph mounted before updates. Its guarded native
Check saved status button remains focusable while checking. Reads preserve the
invoker's focus and later user focus moves. The existing API session helper now
forwards an optional AbortSignal. Six production client files changed, with
separate owners for commands, reads, settings drafts and server authority.

The implemented stack is existing authenticated GETs, scoped read ownership,
bounded projection, then existing cards and persistent feedback. Its benefit is
recovery without discarding drafts or repeating mutations. Its cost is two
sequential reads and explicit unknown/session-refusal handling; the alternatives
and pros/cons are recorded in the research document.

## Verification

| Boundary | Executed result |
| --- | --- |
| Focused qualification | 114 tests passed in 9 suites, zero skipped |
| Frozen complete fast gate | 11,719 tests passed: 6,453 server, 4,563 client, 703 scripts; zero failures, cancellations or skips |
| Static/build stages | Node baseline, copyright, migration/schema/anchor, ESM, image/topology, lint, hygiene and build passed |
| Final canonical browser command | 6 tests in 4 suites passed, zero failures/cancellations/skips, with test PostgreSQL pinned to IPv4 loopback |
| Preserved walkthrough | 8 status groups passed; three locally fulfilled provider-command POSTs with current CSRF checks; zero forwarded provider mutations, unexpected blocked writes or page errors |
| Current packaged PostgreSQL/HTTP entry | 14 provider-status groups passed in one native test on the final image; owned container removed and absence verified |
| Retained native evidence | 143 previous callback/OAuth/Plex server/API/store groups retained after exact unchanged server/shared/package/test comparison; not fresh executions |

Focused command:

```text
node --test test/client/useProviderAuthorizationStatus.test.js test/client/useProviderAuthorizationActions.test.js test/client/useConnections.test.js test/client/auth-api.test.js test/client/provider-callback-feedback-policy.test.js test/client/useProviderCallbackFeedback.test.js test/client/settings-connections-view-contract.test.js test/client/settings-connections-presentation.test.js
```

Final browser command:

```text
node --test --test-concurrency=1 test/browser/provider-authorization-status-browser-verification.test.js test/browser/provider-authorization-actions-browser-verification.test.js test/browser/provider-callback-feedback-browser-verification.test.js test/browser/connections-route-access.test.js
```

Units cover session/malformed/partial refusals, both deadline phases, ignored
abort, stale success/rejection, session change/disposal, ordinary/persisted return,
settings/command precedence and explicit recovery. Built browser checks hold
session/status responses, verify GET order and duplicate read refusal, preserve
dirty drafts and command outcomes, refuse provider reads/commands after session
mismatch, and suppress late results after a newer command or leaving the view.
Existing command, callback and route role/admission regressions also passed.

Walkthrough settings/secret-status snapshots before and after matched. Provider
replies were browser-local fixtures; command CSRF equality was recorded only as a
boolean. Six status/retry screenshots at 1440/800/390 px in both themes were
visually reviewed. Feedback did not overflow; the retry button was at least
44 px tall and its center unobscured. Chromium was 156.0.8078.4.

Final source: 3,837 files, SHA-256
`5330b47fa3e8377275087c804122bc7958c7e3ec06ee8373c32c747bf31d207e`.
Thirteen changed code files were frozen before the final complete gate, build,
canonical browser, native and walkthrough checks. No code changed afterward.

Private evidence is under `.tmp/provider-authorization-status-2026-10-28/`.
Preflight fixes corrected a unit completion barrier and browser assumptions about
keyboard focus and initial background GETs. An earlier browser preflight used the
old client bundle and was not acceptance evidence. Two later disposable runs
failed at PostgreSQL connection establishment before UI qualification: owned
server readiness accepted connections while independent host connection probes
failed. A separate fresh-server probe later connected through both localhost and
127.0.0.1. Subsequent loopback-pinned browser checks passed; none of this establishes
the cause of the earlier failures. Original evidence remains retained. The Docker
outcome separately records its initial CDN download failure and successful retry.

Manual screen-reader and physical-device checks remain deferred as requested.
Controlled persisted-event proof does not establish native BFCache restoration;
these checks do not certify full WCAG conformance, live provider/account acceptance,
whole-application quiescence or a memory minimum.

GitHub MCP found zero open repository PRs initially and at the final check,
2026-10-28 14:53:51 UTC. Random local PR implementation and stale Dependabot
cleanup/rebasing were inapplicable. Work stays on main without a PR merge, new
branch, release or Git tag.

## Next recommended item (implemented)

Audit and fix Connections mobile field flex sizing and sticky-save-bar clearance,
the separate finding retained in the [preceding outcome](PROVIDER_AUTHORIZATION_ACTIONS_OUTCOME.md).
Keep desktop density, drafts and native focus intact. Verify actual keyboard
scrolling and zoom/reflow, not only centered screenshots, against the W3C
focus-not-obscured guidance linked in the research. The scoped status checks here
do not establish complete Connections layout acceptance. Manual AT/device work
remains a separate acceptance step.

The layout follow-up is now implemented; see the separate
[research](CONNECTIONS_LAYOUT_RESEARCH_2026_10.md),
[design](CONNECTIONS_LAYOUT_DESIGN.md) and [outcome](CONNECTIONS_LAYOUT_OUTCOME.md).
