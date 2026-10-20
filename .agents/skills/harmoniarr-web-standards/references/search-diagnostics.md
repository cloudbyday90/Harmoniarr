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
