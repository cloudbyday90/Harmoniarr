# Artist Detail Local Presentation Timing Design

Status: Implemented
Date: 2026-08-30
Owner: Metadata architecture + quality engineering

## Decision

Extend the existing loopback-only Artist Detail timing diagnostic with a
bounded presentation observation. It begins immediately after Artist Detail
navigation, runs in parallel with the known critical request path, and records
whether the user-observable Discography region has left its loading state and
the navigation-relative time at which that state was observed.

The result remains a local administrator diagnostic, not product telemetry. It
does not add an endpoint, browser persistence, server timing header, database
field, dashboard, user-facing control, or change to cache behavior.

## Why this is the next work

The existing three-sample capture shows quick local metadata and operator
projection responses, but the reported symptom is a visible Artist Detail
loading state. Request completion alone cannot prove that Vue has rendered its
final state. The next smallest useful measurement therefore crosses the
boundary a person experiences: whether the existing Discography loading region
has completed after the relevant requests have finished.

This distinction narrows future work safely:

| Observation | Likely next investigation |
| --- | --- |
| `ready` promptly after the route requests | Reproduce under the affected account or examine an unobserved request path; do not change cache policy. |
| `still_loading` after route requests completed | Inspect client state ownership, aborted/latest-request handling, and rendering errors. |
| `unavailable` | Inspect route/error rendering before attributing the symptom to caching. |

## Standards and research review

Reviewed on 2026-08-30 against current primary sources:

- [WAI-ARIA 1.3](https://www.w3.org/TR/wai-aria-1.3/) defines `aria-busy` as
  a global state. [WAI-ARIA 1.2's `aria-busy`
  definition](https://www.w3.org/TR/wai-aria/#aria-busy) explains the intended
  transition: assistive technologies can defer exposure while updates occur,
  then process the finished content when it becomes false. Harmoniarr already
  applies this state to the Discography body while `isLoading` is true.
- [WCAG 2.2 Understanding 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  says application waiting and result changes should be programmatically
  determinable without moving focus. The current component retains its
  `role="status"` live message; this diagnostic reads the same semantic state
  and introduces no new announcement or focus movement.
- [W3C User Timing](https://www.w3.org/TR/user-timing/) specifies high
  precision, monotonic timestamps and recommends marks for developer-defined
  fully loaded or visible states. This tool records only a rounded
  navigation-relative observation time via the browser performance clock; it
  neither stores marks nor captures page content.
- [Playwright locator waiting](https://playwright.dev/docs/next/api/class-locator)
  defines bounded waits for an attached, detached, visible, or hidden locator.
  The diagnostic uses a named semantic region and waits for the existing busy
  state to detach, rather than scraping visible copy or using brittle layout
  selectors.

## Design

`scripts/artist-detail-local-presentation-evidence.js` will own the small,
pure evidence contract for this additional signal. It permits only:

| Field | Allowed values | Purpose |
| --- | --- | --- |
| `state` | `ready`, `still_loading`, `unavailable` | Fixed result of the semantic observation |
| `observedAtMs` | Rounded, bounded navigation-relative milliseconds | When the result was observed, not a claim about exact render completion |

`scripts/measure-artist-detail-local-timing.js` starts the named Discography
observation as soon as navigation reaches `domcontentloaded`, before it waits
for the allowlisted request sequence. The observer then waits at most two
seconds for the descendant with `aria-busy="true"` to detach. A missing named
region produces `unavailable`; a busy state that persists for the bounded wait
produces `still_loading`; otherwise the result is `ready`. Starting it in
parallel prevents route-classification waits from inflating the presentation
time.

The observation is included in every single capture and summarized across
batch captures with fixed state counts and the same bounded minimum/P50/P95/
maximum timing summary already used for request timing. This intentionally
changes the diagnostic artifact schema from version 1 to version 2: it was
introduced only for local evidence and has no persistent application-data
consumer. The writer rejects version 1 rather than silently treating a
request-only artifact as presentation proof.

## Security and multi-user boundaries

- The diagnostic remains loopback-only and uses the existing file-only
  password input, fresh service-worker-blocked browser context, and
  workspace-only optional evidence path.
- The semantic selectors are fixed product structure, not artist, release,
  user, error, or rendered text values. No DOM text, URL, MBID, username,
  credential, request/response body, header, cookie, cache key, or absolute
  timestamp can enter the artifact.
- The browser still signs in as one account and observes that account's
  per-user operator projection only. It neither combines projections nor
  exposes activity across users.
- The two-second check is a bounded read-only wait running alongside the
  normal route sequence; it does not trigger retries, refreshes, provider
  calls, or cache invalidation.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add production real-user monitoring | Could capture every load | Adds operational data collection and storage that is disproportionate for a home-hosted application | Reject |
| Add another loading component or status announcement | Visually obvious | Duplicates existing accessible state without diagnosing why it persists | Reject |
| Record only request completion | Small and already implemented | Cannot distinguish a finished response from a stale client loading state | Insufficient |
| Observe existing named `aria-busy` state in the local tool | Reflects the user and assistive-technology boundary with a fixed, privacy-safe signal | Detects a symptom but still requires a focused client investigation if it fails | Adopt |

## Open pull request assessment

Reviewed on 2026-08-30. No open pull request safely applies to this focused
diagnostic change, so none was merged or copied into the local worktree:

| PR | Proposal | Decision |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | Node `24.19.0-alpine` → `26.7.0-alpine` | Keep separate: it is a major runtime migration while the current engine range allows Node 24 only. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `docker/build-push-action` 7.1 → 7.2 | Superseded; the workflow already pins 7.3. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `docker/metadata-action` 6.0 → 6.1 | Superseded; the workflow already pins 6.2. |

## Final recommendation stack

1. Add the bounded semantic presentation observation to the existing local
   timing command and batch evidence.
2. Capture three samples under the affected account before changing SWR,
   caching, request concurrency, or state management.
3. Investigate the client request gate/render path only if `still_loading` or
   `unavailable` repeats; otherwise preserve the verified local-projection
   cache path and reproduce the original affected case.
4. Keep this as a manual local administrator diagnostic. Do not introduce a
   persistent dashboard or cross-user performance aggregation.
