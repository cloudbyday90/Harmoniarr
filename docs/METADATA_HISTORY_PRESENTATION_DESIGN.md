# Metadata history presentation design

Date: 2026-10-21. Continues the [feedback outcome](METADATA_HISTORY_FEEDBACK_OUTCOME.md).
See [official research and tradeoffs](METADATA_HISTORY_PRESENTATION_RESEARCH_2026_10.md).

Recent discoveries currently joins adjacent inline timestamp, monitoring decision
and Wanted state text. Keep its list, pagination and owned completion heading;
extract one entry into a small component with a description list for Release
type, Detected, Monitoring decision and Wanted state. Keep the existing decision
labels and canonical release-group link. Resolve that link once per entry update.
Use stacked label/value groups and token-based spacing so narrow cards retain
readable relationships and long unbroken titles wrap.

A small ESM timestamp formatter and Metadata timestamp component serve history
and the summary's Last refresh/Next refresh fields. Use the browser's default
locale/timezone with an explicit timezone offset and second precision, retaining
a normalized UTC instant in time[datetime]. Cache the Intl formatter for the
loaded application; no timers, date dependency or global locale setting is added.
Factory options allow deterministic locale/timezone qualification.
Stack the two policy timestamp values below their labels across the full card
width; the summary's generic two-column details leave too little room at desktop
four-card widths. Preserve compact label/value columns for its other policy fields.

Accept supported ISO instants with an explicit zone, positive four-digit years
and at most millisecond precision. Refuse absent, malformed, impossible calendar
dates and zone-less values rather than inventing a local interpretation. Render
the existing context-specific fallback as ordinary text; do not emit an invalid
time element or echo malformed timestamp input. Vue text interpolation remains
the boundary for provider titles and other display values.

Prove UTC/offset identity, timezone/daylight-saving display, invalid-date refusal,
localized output, native description/time structure, safe title text and release
navigation. Inspect light/dark layouts at all three shell breakpoints. Retain
the existing history/focus/command/cache browser consumers, one stable fast gate
and a preserved-state no-cache Docker rebuild. Freeze line endings before the
browser build so its exact client bytes can be compared with the final image.
These checks do not certify screen-reader output or complete WCAG conformance.
