# Metadata history panel design

Date: 2026-10-21. Continues the [presentation outcome](METADATA_HISTORY_PRESENTATION_OUTCOME.md).
See [official sources and tradeoffs](METADATA_HISTORY_PANEL_RESEARCH_2026_10.md).

Growing detection history currently shares the summary's stats grid. Its height
stretches adjacent finite cards and its desktop column narrows each event. Move
it to a separate MetadataDetectionHistoryPanel directly after the artist summary
and before release-group browsing. Keep source and visual reading order aligned.
Use existing workspace scrolling rather than adding a fixed-height nested history
scroll area.

The new panel receives current history/status/page props and emits load-more.
It owns the existing heading, persistent polite/atomic status, busy list, empty
state and button. Give the section its visible heading as an accessible name,
using Vue useId for the unique heading ID. Expose only getHistoryHeading for
the existing owned-focus adapter. Move that ref in MetadataView from the summary
to the panel; retain nextTick, generation and user-interaction checks unchanged.

MetadataArtistSummary keeps three finite cards and the refresh action. Give its
section the concise Artist summary label. Use a component-owned three/two/one-
column grid at the app's existing breakpoints. At two columns, let Identity span
the last row. Avoid the shared stats-grid odd-child rule, which otherwise forces
the third card onto a full row even at desktop widths. Use design tokens and
minmax(0, 1fr); no global grid override or visual reordering is needed.

Preserve history generations, bounded authenticated GETs, errors, cancellation,
timestamp/text safety and native command/CSRF authority. This is a presentation
extraction, not a new data service, worker, endpoint or authorization mechanism.

Reproduce containment in the old summary, then prove native sibling order,
full-width history, finite summary geometry before/after append, named sections,
heading identity, empty state and owned final focus. Check 320/390/768/1280 CSS
pixel widths, both themes and the existing history/focus/presentation/command/
cache consumers. Freeze source bytes before browser builds, run one final fast
gate and rebuild preserved local Docker without cache. Narrow viewport checks
do not establish actual 400% browser zoom, screen-reader output or full WCAG
conformance; keep those limits explicit.
