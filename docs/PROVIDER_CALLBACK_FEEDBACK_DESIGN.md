# Provider callback feedback design

October 28, 2026. Implements the next [callback error item](PROVIDER_CALLBACK_ERRORS_OUTCOME.md).
See [research/tradeoffs](PROVIDER_CALLBACK_FEEDBACK_RESEARCH_2026_10.md),
[outcome](PROVIDER_CALLBACK_FEEDBACK_OUTCOME.md) and
[Docker design](LOCAL_DOCKER_PROVIDER_CALLBACK_FEEDBACK_DESIGN.md).

## Ownership and behavior

Add a pure ESM policy for Spotify/YouTube/Plex query hints, fixed recovery copy
and saved-link projection. Accept exactly one primitive linked/failed flag;
duplicate arrays, unknown values and multiple providers yield generic guidance.
Only fixed provider-owned failure codes choose specific instructions. Capture
provider/guidance enums, never retain raw query diagnostics. Unknown and forged
values cannot imply success, trigger a command or become rendered text.

A small scoped composable reads the existing provider-status GET for a recognized
hint while the current client role is administrator. Server session/authorization
remain authoritative. Require an explicit boolean linked result, refuse unavailable
or malformed observations and ignore other provider metadata. Describe the result
as the last saved-link check, never as callback success or provider-access proof.
Clear old results on each check, use a bounded deadline and AbortController, and
fence late replies after timeout, newer intent, permission loss or disposal.
Duplicate pending checks are refused. No cache, polling or automatic retry.

A dedicated component mounts in SettingsWorkspaceView before the child view.
An empty polite atomic status paragraph exists before callback processing. Fixed
instructions and current checking/last-check feedback persist across Settings
subsections; leaving the workspace disposes the request. A focusable pending
Check saved status button has aria-disabled plus a handler guard. Review Connections
uses the existing named route. Background completion does not move focus; native
and handler guards refuse checking after client permission loss. No automatic
navigation, linking POST, save or token mutation.

Consume callback query changes after mount. Schedule router.replace on the current
path/query/hash, removing only spotifyOAuth, youtubeOAuth, plexOAuth, code, state,
error and error_description when a callback flag is present. Preserve unrelated
query/hash and input drafts. Cleanup does not erase earlier URLs from history or
logs. Report a bounded cleanup failure only if the same return still owns the
page; a later navigation wins. After cleanup/reload there is no replayed hint or
automatic check. The user can review Connections normally.

## Validation

Policy tests cover hostile query shapes, provider-specific guidance, cleanup
preservation and strict saved-link projection. Scoped composable tests cover
duplicate checks, explicit retry, stale replies, timeout, disposal and role loss.
Use built-client browser fixtures for forged linked/failed/unknown input, pending
and failed status, actual native-button focus/keyboard behavior, no mutation,
query/hash/history cleanup, subsection navigation and reload. Exercise an actual
callback and saved-status read on the preserved walkthrough. Verify three layout
breakpoints and both themes; keep spoken/physical-device acceptance separate.

Freeze code for one complete fast gate and build. Compare packaged server/shared/
dependency identity before retaining existing backend/native proof. There are no
server, SQL/schema, maintenance, dependency or authentication-owner changes.
Main only; commit/push all changes without branch, PR merge, release or tag.
