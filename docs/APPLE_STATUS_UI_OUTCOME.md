# Apple saved-status UI outcome

October 28, 2026. Follows the [backend status outcome](APPLE_STATUS_OUTCOME.md).
See separate [design](APPLE_STATUS_UI_DESIGN.md),
[official research and alternatives](APPLE_STATUS_UI_RESEARCH_2026_10.md) and
[Docker outcome](LOCAL_DOCKER_APPLE_STATUS_UI_OUTCOME.md).

## Delivered

The existing Settings Apple card retains secret presence/source and adds saved
local signing checks. A small component, presentation module and per-component
request composable own the feature. They validate/copy fixed status enums only,
ignore extra response values/messages, and describe saved Team ID, key ID and
private-key checks without exposing those values. Local checks are explicitly
separate from the existing Collection access check and remote Apple acceptance.

The form captures only loaded/acknowledged saved ID primitives for draft
comparison. Edited IDs, a replacement key or clear intent produce a distinct
draft notice; editing does not call the status endpoint. Saved invalid data does
not mark a different draft input invalid. Apple labels now reference their
controls. No saved key is added to client state, and GET carries no draft values.

The initial read and explicit refresh use the existing same-origin provider
status API with AbortSignal forwarding. The owner has a 15-second browser
deadline, duplicate guard, request identity and scope disposal. It clears old
results at save start and refreshes after each attempt settles, including failed/
uncertain saves. A failed save retains its existing form error and drafts. This
adds one read after unrelated saves, avoiding a second save classifier and stale
results after returned settings change. No polling or persistent cache is added.

A persistent polite atomic status paragraph reports loading, result, draft notice
and bounded failures outside a busy ancestor. The native refresh button stays
mounted, uses guarded aria-disabled during reads/saves and keeps keyboard focus.
No automatic focus movement occurs. The 44-pixel minimum button height is project
touch-target convention, not a claim about WCAG's minimum size requirement.

## Evidence and limits

Focused qualification passed 35 tests across new presentation/request ownership,
API signal forwarding and existing Settings form/connection contracts. Cases
include malformed payloads, fixed-enum adoption, deadline, abort-ignoring late
success/failure, disposal and draft semantics. The explicit real-app Chromium
preflight passed eight scenario groups, with no skips: loading/duplicate keyboard
activation, invalid/incomplete checks, safe failure/focused retry, draft key/IDs/
clear, failed-save preservation, held-read invalidation during save, navigation
and all three breakpoints in both themes. It controlled ten status reads and two
save responses rather than exercising new encrypted persistence.

The frozen fourteen-stage gate passed 6,402 server, 4,512 client and 703 script/
policy tests: 11,617 total, no failures/skips/cancellations. Lint, ESM, copyright,
migration/snapshot/anchor, image/compose checks, test hygiene and build passed.
Production dependency audit found zero vulnerabilities.

The [Docker outcome](LOCAL_DOCKER_APPLE_STATUS_UI_OUTCOME.md) owns frozen full-gate,
immutable packaged client, actual authenticated status rendering, preserved
operator settings and reviewed screenshot evidence. Browser cancellation means
client request/state ownership; it does not prove server database work drainage.
Manual screen-reader and physical-device checks remain deferred, and no full
WCAG, live Apple or deployment memory claim is made.

The first focused browser-helper lint run identified globals used inside browser
callbacks; explicit globalThis references corrected them before execution. The
first browser run then timed out on a fixture selector expecting Retry save;
the existing control is Try saving again. The selector was corrected without
changing product behavior. Both failed records are retained, and only the later
passing scenario qualifies the candidate. Previous unexplained linked-login
evidence remains separate, without diagnosis or repair here.

No backend, route, encryption, dependency, SQL/schema, background job or new
deployed app changed. GitHub MCP initially found no open PR; random application
and stale Dependabot cleanup/rebase were inapplicable. A final check at
2026-10-28 11:07:06 UTC again returned zero open PRs. Work remains on main without
a release/tag or PR merge.

## Next recommended item

The narrow provider-status aggregation service is now implemented in the
[design](PROVIDER_STATUS_DESIGN.md) and [outcome](PROVIDER_STATUS_OUTCOME.md).
It preserves healthy sibling observations, explicit unavailable state,
authenticated/no-store access and recognized shared database failures as 503.
See that outcome for the next recommendation and its qualification limits.
