# Recovery diagnostic events design

October 25, 2026. Continues the [admission diagnostics outcome](ARTWORK_ADMISSION_DIAGNOSTICS_OUTCOME.md).
See [research](RECOVERY_DIAGNOSTIC_EVENTS_RESEARCH.md) and
[outcome](RECOVERY_DIAGNOSTIC_EVENTS_OUTCOME.md).

Repair the two existing Recovery diagnostic sections against the actual service
contract. Failed runs use id, operationType, finishedAt and the already redacted
errorMessage. Privileged actions use id, eventType and occurredAt. Do not infer
aggregate failure counts or actors, and do not display raw audit summary/details.
No server schema, endpoint, authorization, redaction or query needs to change.

Use a small pure ESM presentation module and a focused Vue component rather than
adding conditionals to the workspace. Inspect at most five records per section,
key rows by their stable IDs, reuse known job descriptors and fixed action labels,
and provide generic labels for unknown types. Bound error display to 1000 code
units and render it as escaped text. Invalid/missing dates get explicit unavailable
copy. Separate an empty array from absent/malformed records; do not silently call
an unavailable observation an empty history.

Keep semantic section headings, lists and time elements. Reuse the existing
loading/completion status, error handling, disclosure and focus-preserving refresh.
The changing record lists are not additional live regions. Do not add polling,
requests, actions, actor lookups or client-side redaction as a replacement for the
server's confidentiality boundary.

Use actual service-produced fixtures for focused presentation and browser checks.
Cover duplicate operation/time values with distinct IDs, refresh replacement,
missing dates, unknown types, redaction, HTML-as-text, empty/malformed payloads,
five-row bounds and narrow layout. Run one stable fast gate and relevant existing
admission/settings browser regressions. Preserve unchanged backend/native proof
after exact comparison; complete the no-cache Docker walkthrough with existing
administrator/data and all five actual binds. Work on main without a release.
