# Bounded search-result explanations

Use [the design](../../../../docs/EXTERNAL_SEARCH_DIAGNOSTICS_DESIGN.md) and
[consulted recommendations](../../../../docs/EXTERNAL_SEARCH_DIAGNOSTICS_RESEARCH_2026_10.md)
when exposing approved external-search filtering evidence or correction links.

Trace actual ingestion counters before naming a cause. Positive provider responses
with zero candidates differ from finalized empty results, failed provider reads
and later quality scoring. Never infer a quality rejection from an empty candidate
list. Response and file counts are different units; do not add them into a single
filtered total. Missing counts stay unknown.

Use a constant-size allowlist at persistence and projection boundaries. Validate
numeric types/ranges and parent/count relationships; ignore source-provided reason
strings and unknown/nested data. Peer names, paths, queries and raw exception text
are not needed for correction guidance. Bind the read to the current failed job's
intent/request and clear evidence through subsequent starts/terminal outcomes.

Point only to verified product surfaces with fixed internal route names. Opening
review does not authorize unignoring a source, changing the approved edition,
relaxing quality or starting a search. An intentional source-policy correction may
be followed by ordinary Retry of the saved search; preserve the distinct fresh-
search cooldown/budget contract. Do not invent a title-term editor or claim that
removing an ignore makes a source trustworthy.

In native integration fixtures, wire the same ignore-list reader as app startup;
the import-candidate factory intentionally defaults to an empty list. Prove real
HTTP filtering → worker summary → current review, then explicit correction and
same-UUID retry. Use cheap controls for invalid/unknown/private fields and stale
or mismatched summaries. In the browser verify actual route navigation, keyboard
focus visibility, mobile targets and Refresh focus. A structural ARIA check does
not establish screen-reader announcements or full conformance.

For shared-search count work, read [the design](../../../../docs/MISSING_SEARCH_COUNTS_DESIGN.md)
and [source tradeoffs](../../../../docs/MISSING_SEARCH_COUNTS_RESEARCH_2026_10.md).
The old mixed `Filtered` total is in advanced Activity > Wanted; canonical Missing
Music has its own server DTO, composable normalizer and inspector. Trace all three
before treating a presentation-helper change as shipped canonical behavior.
Preserve the new bounded field through the client adapter; test actual rendering.
Discovery persists ready/cooldown/blocked, not operation-run statuses; use pending
continuation/failure evidence to test active/refused work in PostgreSQL fixtures.
Recorded zero responses alone do not establish final publication or grant Search
again. Keep external recovery's positive-response distinction when sharing numeric
projection, and hide old canonical causes after a new intent or later failure.
Keep response and file labels separate and use adjacent term/value assertions in
description lists. Sharing a presenter does not imply sharing command authority.

For canonical correction destinations, use the
[correction design](../../../../docs/MISSING_SEARCH_CORRECTIONS_DESIGN.md).
Check destination API authority as well as router admission: ignored-source and
connection pages have administrator-only APIs, even when another role can enter
their shell. Carry strict server-derived review capabilities through the client
adapter; require active recipient facts and suppress correction links in disabled
history. Missing capability is denial, with useful administrator guidance.
Keep destinations fixed and the existing Settings return context bounded.
Malformed responses justify investigation, not a connection-failure diagnosis.
An ignore change affects future searches for everyone; never infer consent from
a cause count. Browser-check real destination navigation, sequential link focus,
revocation on Refresh and zero policy/search mutations while opening review.

Ignored-source review now retains the bounded canonical context; see the
[return design](../../../../docs/IGNORED_REVIEW_RETURN_DESIGN.md). Admit only the
exact decision context at this boundary, not other Settings contexts or legacy
aliases supported by the reused parser. Query state is navigation data, never
recipient authority. Withhold return while the owning policy response is pending;
do not auto-save drafts or submit a new search. The existing inspector's mount
read owns fresh status: prove that actual read instead of adding a refresh flag.
Keep recorded search counts distinct from a subsequent change to the ignore list.

Ignored-source route admission now shares the reviewed role policy with Activity
diagnostic navigation; see the [access design](../../../../docs/IGNORED_ROUTE_ACCESS_DESIGN.md).
Check current session facts before new admin-page entry, not just cached role.
Retain bootstrap/password/login precedence, bound verification feedback and keep
unrelated navigation unchanged. Prove refusal before the page's API reads, then
independent HTTP authorization; hiding a link or guarding a route cannot secure
the endpoint. Admission checks do not continuously revoke an already mounted view.

Source users and Source blocklist now use that same reviewed admission policy;
see the [source access design](../../../../docs/SOURCE_ROUTE_ACCESS_DESIGN.md).
Trace list, detail, export, bulk and single-write handlers before extending a
route policy: a read-looking export still needs independent authorization.
Reuse one owned browser cohort across the reviewed destinations; hold actual
session responses and prove zero destination reads before admission. After link
filtering, check surviving keyboard boundaries rather than retaining assertions
for a removed link. A tested full-scan
OSV workflow update does not qualify its separately pinned PR-comparison sibling
or GitHub-hosted SARIF upload.

System history now shares this admission policy; see the
[history design](../../../../docs/HISTORY_ROUTE_ACCESS_DESIGN.md). Trace its actual
system-feed handler rather than inferring permission from the Activity timeline.
When the last available link disappears, omit the empty diagnostic group using
the existing projection. Verify surviving heading/link order and native
summary-to-first-link navigation in the shell. Controlled history payloads prove
loading/retry presentation; retain actual session/feed HTTP proof separately.
For fixed mobile navigation, inspect actual sequential focus and its geometry
before diagnosing an obscured-control failure from an unfocused capture. Preserve
that native focus state in the screenshot; do not move the viewport by script to
make an otherwise failing focus assertion pass.

Settings Connections uses a separate area policy composed by the common session
admission service; see the [Connections design](../../../../docs/CONNECTIONS_ROUTE_ACCESS_DESIGN.md).
Keep navigation and global-health links on the same reviewed decision while
preserving Account aliases. Distinguish saved Soulseek status (admin) from broad
provider status (authenticated); similar endpoint names do not imply authority.
For keyboard cues, distinguish the project's two-pixel outline convention from
WCAG Focus Visible's actual requirement. Keep a cue inside scrolling navigation
instead of weakening assertions to match a browser default.
For action upgrades, controlled source logic and existing Desktop ARM execution
do not prove the packaged action, fresh-runner registration or hosted caches.

Settings root admission now verifies Setup authority before mounting; see the
[landing design](../../../../docs/SETTINGS_LANDING_DESIGN.md). Apply bootstrap,
login and password-change checks before the fixed non-admin Account redirect.
Do not forward arbitrary Setup query/hash data into that destination. Qualify
direct and global links, replacement history, native protected reads and Account
aliases. If filtering removes the focused tab, restore to a surviving control
only while that interaction still owns focus; test a user moving elsewhere
during a held real session response as a separate case.

For Settings page admission, use the complete [route/API matrix](../../../../docs/SETTINGS_AUTHORITY_DESIGN.md).
Separate admin deployment pages, authenticated personal pages and mixed operator
metadata browsing. A requester route denylist must not block a valid own-user
Notifications API. Test saved notification preferences against the authenticated
owner and an unchanged peer, plus real read admission for every protected page.
Keep metadata's product route restriction distinct from its authenticated APIs;
qualify privileged controls separately rather than making all browsing admin-only.

For Metadata browser commands, use the [command matrix](../../../../docs/METADATA_COMMAND_AUTHORITY_DESIGN.md).
Keep authenticated artist import distinct from fresh-admin refresh and release
imports. A mixed row's Open branch must remain a read when its Import branch is
hidden. Pair default-false component capabilities with default-deny, live workflow
predicates; omitted callbacks or truthy non-Boolean values cannot grant dispatch.
Native sessions/HTTP guards with controlled catalog/command services prove actor,
CSRF and dispatch ordering, not real provider imports or durable refresh queues.
For refused commands, verify focus after busy reset and while a native response
is held; restore the invoker only if the interaction still owns focus.
