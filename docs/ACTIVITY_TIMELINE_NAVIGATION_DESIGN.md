# Activity Timeline And Navigation Design

Status: **Implemented 2026-07-25.**

## Problem

Activity exposed twelve equal-priority tabs before showing a person what had
happened. That made an audit/history surface feel like the control center for
downloads, matching, imports, and maintenance. It conflicted with the Music
Queue redesign: people manage releases while Harmoniarr manages candidate and
operation details.

## Research And Decisions

Official W3C accessibility guidance was reviewed for this design:

- [WCAG 2.2 consistent navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html)
  requires repeated navigation to retain a consistent relative order.
- [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports non-disruptive updates for refreshed data and filter changes.
- The [WAI-ARIA feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)
  is intended for dynamically loading, potentially unbounded content. A bounded
  periodic Activity history is better represented as an ordered list of
  articles, rather than claiming the feed role.

The resulting design keeps Activity predictable and low-noise:

1. `/app/activity` opens a readable timeline, not Background Jobs.
2. The timeline has narrow, outcome-oriented filters: attention, downloads,
   audio checks, library, requests, and artist policy.
3. Existing operations, match diagnostics, request records, history, source
   controls, and artist administration remain available from one compact
   `Advanced diagnostics` disclosure. Existing deep links remain unchanged.
4. Timeline entries show a category, summary, optional explanation, time, and
   a single relevant handoff. A quality stop links to Music Queue; the user is
   not sent to a raw candidate table first.
5. Refresh and filter result messages use polite status semantics and do not
   move focus.

## Options Considered

| Option | Advantages | Disadvantages |
| --- | --- | --- |
| Keep twelve visible tabs | No route or UI change | Preserves competing workflows and visual noise. |
| Replace all diagnostic routes | Smallest navigation surface | Breaks support links and removes useful operator recovery paths. |
| Timeline first, diagnostics disclosed | Clear default while retaining every existing capability | Adds one intentional interaction for advanced tools. |

## Final Recommendation Stack

1. Make the timeline the Activity default and keep Music Queue as the release
   progress surface.
2. Group existing operational routes behind `Advanced diagnostics`; preserve
   their URLs and direct access.
3. Use a semantic ordered timeline with plain-language category filters, not
   a new dashboard or an ARIA feed role.
4. Surface durable quality decisions with clear Music Queue handoffs.
5. Continue the next slice with lifecycle coverage for searching, retrying the
   next match, download failure, and no-matches-left events.
6. Render terminal repair work before routine history, while preserving one
   compact routine timeline and the existing filter contract. See
   `docs/ACTIVITY_TASK_FIRST_TIMELINE_DESIGN.md`.
7. Group the retained specialist links by troubleshooting task and make
   recovery discoverable before source/history records. See
   `docs/ACTIVITY_ADVANCED_DIAGNOSTICS_TASK_GROUPING_DESIGN.md`.

## Security And Data Boundaries

The Activity API remains authenticated and its server-side event-type
allowlist remains authoritative. Client filters operate only on the bounded
authorized response and do not render raw event payloads. Links are derived
only from known route targets and identifiers already present in the
authorized event.

## Verification

- Unit coverage proves filter categorization and quality handoff presentation.
- Route coverage proves the Activity feed accepts the same bounded page size as
  its service contract.
- Browser coverage proves `/app/activity` opens the timeline, terminal repair
  work appears before routine history, filters do not disrupt navigation, and
  diagnostics remain reachable.
