# Downloader filter announcement design

October 11, 2026, America/New_York. Follow-up to the reproduced early-filter
finding in the [Docker outcome](LOCAL_DOCKER_REBUILD_2026_10_OUTCOME.md).
Current official practices are recorded in the separate
[research ledger](DOWNLOADER_FILTER_ANNOUNCEMENT_RESEARCH_2026_10.md).

## Behavior and ownership

Downloader's filter handlers currently copy a computed count after one Vue tick.
When the initial queue is pending, that count is zero. Later queue data changes
the visible subtitle/rows without finishing the user's announcement.

Use a narrow ESM `useFilterResultAnnouncement` composable. The latest explicit
filter request owns one pending announcement. Keep native controls usable while
loading. Complete the announcement only when the queue and selected release
context are available, after the current render. Multiple choices supersede the
earlier request. Failed initial loading, failed release lookup, route-context
change and scope disposal cancel pending work. Retry alone cannot revive a
cancelled filter request. Existing error presentation owns load errors.

With previously loaded data, filtering may describe the current visible snapshot
during revalidation. Periodic/manual refresh changes rows/subtitles without
publishing another filter announcement. Keep the existing persistent polite,
atomic status region, clear it before repeat user actions, and never move focus.
Retain Vue text interpolation and bounded application-generated counts/copy.
This changes no API, transfer command, permissions, CSRF, persistence or provider
configuration. No singleton, global watcher or polling framework is introduced.

## Alternatives and final stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Watch every count change | Minimal code | Polling noise; reject |
| Disable controls until load | Avoids early interaction | Prevents useful choices; reject |
| Lengthen waits or update only validator | Easy test changes | Leaves application defect; reject |
| Latest-action composable with readiness and cancellation | Accurate deferred result; silent polling | Small explicit lifecycle owner; selected |

Stack: existing Vue/native controls and `useAsyncResource`; a local composable
for intent, render timing and disposal; existing transfer-filter projection;
focused reactive tests and actual Vue browser tests with controlled queue HTTP
responses. Keep the complete database gate separate from this client-only
change. Run complete fast validation once the candidate is stable, plus owning
browser filter/release-context consumers. No release or branch; publish on main.

## Evidence and next boundaries

Reproduce the original failure before the fix. Verify delayed success and zero
results, rapid choices, error then retry, silent polling/manual refresh, route
change/unmount and focus retention. Unit tests own cancelled next-tick work;
actual application browser tests own rendering/control/network timing. Assertions
of DOM/ARIA do not prove screen-reader speech or complete WCAG conformance.
Executed results and the next recommendation belong in the separate outcome.
