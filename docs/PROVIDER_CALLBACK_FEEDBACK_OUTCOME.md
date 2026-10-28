# Provider callback feedback outcome

October 28, 2026. See separate [research/tradeoffs](PROVIDER_CALLBACK_FEEDBACK_RESEARCH_2026_10.md),
[design](PROVIDER_CALLBACK_FEEDBACK_DESIGN.md), [Docker design](LOCAL_DOCKER_PROVIDER_CALLBACK_FEEDBACK_DESIGN.md)
and [Docker outcome](LOCAL_DOCKER_PROVIDER_CALLBACK_FEEDBACK_OUTCOME.md).

## Implemented behavior

Settings now shows callback recovery feedback on the existing Setup landing and
within its workspace. Responsibilities are split between a
[pure policy](../src/client/lib/provider-callback-feedback-policy.js),
[scoped composable](../src/client/composables/useProviderCallbackFeedback.js) and
[small component](../src/client/components/settings/SettingsProviderCallbackFeedback.vue).
The workspace adds only an import and component mount.

Exactly one recognized Spotify/YouTube/Plex linked/failed flag selects a provider
read. Multiple flags, duplicate arrays and unknown values produce generic review
guidance without a read. Fixed provider-specific codes can select instructions
for expired/changed linking, current administrator session, credentials, Plex
claiming or owner eligibility. Raw query/error text is never rendered or retained
as feedback. A linked hint never establishes success.

The existing provider-status GET supplies only present/absent/unknown saved-link
observations. Explicit boolean results and supported status markers are required;
unavailable or malformed observations stay unknown. Copy says Last check found,
which describes local saved state at that read, not provider access or proof that
the callback succeeded. No cache, polling or automatic linking/retry is added.

Administrator client permission gates reads; server session/authorization remain
authoritative. Timeout, newer intent, permission loss and scope disposal abort
the check and fence late replies. The focusable pending Check saved status button
uses aria-disabled plus an activation guard; Enter, Space and click cannot duplicate
pending work. Completion does not move focus. Review Connections uses its existing
named route and current-session guard.

An empty polite atomic status paragraph is mounted before messages change.
Callback query cleanup replaces the current history entry, removing only the
owned flags/code/state/error fields while preserving path, unrelated query and
hash. A later navigation owns the page; stale cleanup failures cannot replace its
feedback. This does not erase earlier callback URLs from browser/proxy/server
history. Clean reload intentionally does not replay the one-time hint; saved
connection management remains available through Connections.

## Executed evidence

- Five focused policy/composable/presentation/contract files: **76 tests passed**,
  zero skips. These include the 16 new client tests for query trust, strict status,
  cancellation, timeout, duplicate checks, stale results, role loss and disposal.
- Full final fast gate: **11,684 passed** (6,453 server, 4,528 client, 703 script/
  image-policy tests), zero failed/skipped/cancelled. All 14 selected static/test/
  build stages passed, including ESM, schema/anchors, lint and hygiene.
- Final canonical browser run: **four tests passed**, zero skips, across the new
  callback entry and existing Connections admission entry. Nine controlled callback
  groups cover forged success with saved absence, read failure/recovery, known
  guidance, unavailable/ambiguous/duplicate input, pending/focus guards, clean
  history/reload and both themes at three breakpoints. Existing tests preserve
  administrator-only entry, other-role refusal, cached revocation, password-change
  precedence and failed-session verification/retry.
- Preserved walkthrough: **13 groups passed**, comprising those nine controlled
  groups plus actual invalid-state callbacks and fresh saved-status reads for all
  three providers, and existing Connections navigation. No API mutation was
  attempted; settings/secret-status snapshots stayed equal. No page errors or
  overflow occurred. Six screenshots were visually reviewed across desktop,
  tablet, mobile, light and dark; action targets remained at least 44px high.
- Prior **143 native callback/OAuth/Plex groups were retained, not rerun**. Exact
  packaged server/shared/dependency identity and unchanged native-test hashes
  support retention; current client behavior has separate browser qualification.

The first browser preflight passed and exited normally. Its scenario/suite ended
before the overall process exited; this is not attributed to the new component
or used as a performance/quiescence claim. An initial full-gate attempt stopped
on a browser-helper animation-frame promise lint rule. The callback form was
corrected and a fresh frozen full gate passed. Failed/partial evidence remains
private; it is not added to final passing counts. No code changed after the final
snapshot used by the complete gate, build and browser checks.

There are no server, shared, SQL/schema, dependency, authentication, CSRF,
maintenance or credential-publication changes. No new deployed service or release.
Controlled status replies do not establish live provider/account acceptance.
DOM/focus/visual checks do not establish spoken screen-reader, physical-device or
complete WCAG acceptance; previously deferred manual checks remain deferred.

GitHub MCP found zero open PRs initially and at the final check recorded at
**2026-10-28 13:39:14 UTC**. Random PR implementation and stale Dependabot cleanup/
rebasing were inapplicable. Work is on main without a PR merge, release or Git tag.

## Next recommended item

Add an explicit pending owner for existing Spotify/YouTube connect and clear
handlers in [useConnections](../src/client/composables/useConnections.js).
They currently set independent UI flags without handler-level duplicate or
competing-action admission. Their shared feedback can also be overwritten by
overlapping actions. This is a source finding for the next task, not a reproduced
server publication failure; existing native authority/fence proof remains valid.

Keep the orchestration modular, guard ordinary and programmatic activation,
preserve useful focus and current server-derived results, and retain the existing
fresh-admin/CSRF/state owners. Do not retry uncertain POSTs automatically. Verify
held start/clear responses, cross-action contention, failure/recovery and eventual
navigation through the real built UI before extending the command behavior.
