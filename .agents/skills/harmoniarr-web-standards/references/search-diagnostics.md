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
