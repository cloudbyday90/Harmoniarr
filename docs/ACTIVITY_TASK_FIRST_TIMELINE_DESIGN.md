# Activity Task-First Timeline Design

## Status

Implemented on 2026-07-28.

## Problem

The Activity route had already moved diagnostics behind an explicit boundary,
but its default timeline still rendered terminal repair states alongside every
routine milestone. A quality stop, a failed audio check, and a completed
download therefore received nearly identical visual weight. People had to scan
the chronology to find work that needed a decision.

Activity is not a download-control center. Music Queue owns release progress,
Downloader owns live transfers, and Library owns completed music. Activity
should answer two simpler questions: what needs attention now, and what has
Harmoniarr done recently?

## Research

Sources were checked on 2026-07-28 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Keep refresh and filter summaries programmatically determinable without moving focus or making the page overly chatty. |
| [W3C WAI-ARIA Feed Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/) | Keep each event as semantic article content in a labelled ordered list; do not claim the dynamic feed role for this bounded, polling timeline. |
| [W3C WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Preserve the existing explicit Advanced diagnostics disclosure rather than exposing specialist controls in the normal history flow. |
| [W3C WCAG 2.2 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) | Identify terminal failures in text and give each one a specific repair handoff; color is supplemental only. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Keep the timeline on bounded, sanitized event data and retain provider/file diagnostics behind authenticated diagnostic routes. |

## Options

### Keep one chronological timeline with badges

Pros: preserves every event in one list and requires no structural change.

Cons: an actionable failure remains visually buried in normal automation,
especially after a busy discovery or download run.

### Replace Activity with a dashboard

Pros: can make counts and process stages prominent.

Cons: duplicates Music Queue and Downloader, increases page density, and
encourages manual monitoring of a normally automated workflow.

### Put actionable items first, then routine history

Pros: makes the repair queue scannable, keeps ordinary history compact,
preserves all existing filters and deep links, and does not add a new control
surface.

Cons: the default page is no longer one strictly chronological visual stream;
the event timestamp and existing filters remain available for chronological
inspection.

## Final Recommendation Stack

1. Partition only the existing bounded, authorized, already-filtered event
   response into `Needs attention` and routine history.
2. Reserve `Needs attention` for terminal Music Queue stops: quality blocks,
   audio warnings/failures, failed downloads, and no-match outcomes without a
   scheduled rediscovery.
3. Keep automatic retries and scheduled rediscovery in routine history; do not
   create false alarms for work Harmoniarr is still handling.
4. Continue release-story coalescing within each section so automatic search,
   match, download, and add milestones do not become a job log.
5. Give each attention item one existing, safe handoff such as Music Queue or
   Settings. Do not surface candidate, provider, or raw file diagnostics in
   the normal route.
6. Keep Advanced diagnostics disclosed and preserve every direct diagnostic
   route for troubleshooting.

## Implementation

`activity-timeline-presentation.js` now provides two small pure helpers:

- `requiresActivityTimelineAttention(event)` classifies durable terminal
  states, treating `music_queue_no_matches_left` as attention only when
  `rediscoveryScheduled` is not true.
- `partitionActivityTimelineEvents(events)` preserves ordering while producing
  attention and routine arrays from the same safe event objects.

`ActivityFeedView.vue` projects those arrays into an optional `Needs attention`
section followed by routine Activity. It keeps the existing refresh/filter
status message, semantic ordered lists, event articles, single handoff links,
and advanced diagnostics boundary. No API, schema, authorization, polling, or
payload contract changed.

## Security Boundary

The browser only partitions records already returned by the authenticated
Activity feed. It does not inspect raw provider responses or expand event
payloads. Event allowlisting and sanitization remain server-side; identifiers
continue to be used only by existing route-target builders. Provider usernames,
paths, filenames, secret values, and raw failures remain in authenticated
advanced diagnostics when available.

## Verification

- Presentation tests prove partition ordering and distinguish scheduled
  rediscovery from a terminal no-match stop.
- Existing story tests prove routine milestones remain coalesced.
- Playwright desktop/mobile coverage proves actionable work appears first,
  routine release history stays separate, filters remain usable, and no page
  errors occur.
- Lint, build, the full test suite, and a no-cache local walkthrough rebuild
  are run before release.

## Outcome

Activity now leads with repairable work while keeping normal automation quiet.
It remains a readable event history, not a second Music Queue or a diagnostics
workbench.

## Next High-Value Item

Improve the `Advanced diagnostics` disclosure itself: group its links by
operator task, show a short safe description for each group, and keep the most
common recovery surface discoverable without restoring candidate-first
navigation.
