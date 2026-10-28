# Provider authorization action design

October 28, 2026. Implements the next [callback-feedback item](PROVIDER_CALLBACK_FEEDBACK_OUTCOME.md).
See [research/tradeoffs](PROVIDER_AUTHORIZATION_ACTIONS_RESEARCH_2026_10.md),
[outcome](PROVIDER_AUTHORIZATION_ACTIONS_OUTCOME.md) and
[Docker design](LOCAL_DOCKER_PROVIDER_AUTHORIZATION_ACTIONS_DESIGN.md).

## Ownership and behavior

Extract four Spotify/YouTube start/clear handlers into a small scoped ESM
composable. useConnections retains settings/form/secret-status ownership and
injects the existing API functions. Preserve its public handler/flag surface.
One owner synchronously admits an action before any await or feedback reset.
Duplicate and competing calls return without requests, navigation or feedback
changes. Admission also refuses loading/saving settings and clear when the saved
provider is not linked. Guard settings load/save while the command is occupied.

Publish only the active owner's fixed progress, failure and completion messages.
Clear success requires an explicit linked=false result before changing local
saved status; malformed acknowledgements leave it unchanged. Start requires a
nonempty authorization URL and performs one navigation after the acknowledged
response. Retain pending ownership through navigation handoff; an accepted start
is not a completed provider link. Navigation errors get distinct fixed guidance.
Request failures use could-not-confirm guidance, without interpreting diagnostics
or implying server rollback. No automatic retries, new idempotency key, timeout,
credential persistence or alternate command service.

Scope disposal closes admission and ignores late response/feedback/navigation,
while allowing the already-dispatched POST to settle. A scoped pageshow listener
retires only an acknowledged handoff on persisted document return, with fixed
review guidance and no automatic request. Ordinary pageshow or an unsettled POST
does not release ownership. Remove the listener during disposal. This client
coordination does not replace current administrator/session/CSRF/state/transaction
checks or establish actual back/forward cache behavior in every browser.

The four native buttons use aria-disabled with handler guards so pending and
successful clear do not blur the initiator. A persistent polite atomic status
paragraph precedes its messages. No scripted focus restoration. A later user
focus move wins. Settings save remains visibly disabled during the command;
direct save/load calls also refuse. Settings state/copy remains truthful rather
than labelling OAuth work as a settings save.

## Verification

Unit tests gate all four commands and cross-action contention, clear eligibility,
settings coordination, fixed failure/success, malformed results, navigation error/
handoff, disposal, listener cleanup and persisted/ordinary return. Exercise the
built cards with held browser POST fixtures: exact method/path/CSRF, duplicate
keyboard and direct activation, clear recovery and focus, competing settings save,
late unmount replies, and real navigation to an owned provider fixture. Do not
forward controlled start/clear writes to the operator's actual accounts. Review
three breakpoints and both themes, distinguishing controlled cache events from
native restoration and automated checks from deferred manual AT/device evidence.

Finish focused review before one frozen full fast gate. Rebuild the preserved
walkthrough and compare server/shared/package identity before retaining previous
native authority/publication proof. There are no backend/schema/dependency or
maintenance changes. Main only; commit/push all changes without PR merge or release.
