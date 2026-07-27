# Activity History Initial-Load Browser Verification

Status: **Implemented.**

Date: 2026-07-26.

This slice hardens the Activity experience against a misleading first render.
On a direct navigation or reload, history is unknown until its first request
settles. Harmoniarr now shows a compact loading state during that interval
instead of presenting an empty-history message. Once data arrives, Activity
continues to filter only the already-authorized feed and sends each event to
the appropriate normal surface.

---

## 1. Official Sources Reviewed

| Source | Why it matters | Harmoniarr decision |
| --- | --- | --- |
| [Playwright best practices](https://playwright.dev/docs/best-practices) | Acceptance tests should interact through user-visible behavior and independent, deterministic setup. | The browser contract delays the first feed response, uses role/text locators, and reloads the actual route instead of testing a composable implementation detail. |
| [WAI-ARIA feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/) | Activity feeds need predictable reading order and an understandable loading/updated state. | The normal Activity timeline remains an ordered feed with a concise live status and does not substitute an empty result before initial data is known. |
| [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) | Refetch-on-focus is an appropriate freshness enhancement, but must not replace an initial load. | Initial route loading is explicit; existing focus revalidation remains a secondary freshness mechanism. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Operational history must be useful without exposing sensitive infrastructure data. | Timeline and browser assertions retain only release/action context. Source paths, credentials, provider responses, and raw diagnostic payloads remain out of the normal feed. |

---

## 2. Recommendations

1. Treat initial history as unknown, not empty.
   Show a skeleton and `Loading recent activity...` until the first feed request
   succeeds or fails. Render the empty state only after a successful empty
   result.

2. Keep reload behavior deterministic.
   A direct `/app/activity` navigation redirects to the normal feed and makes a
   fresh request. Reloading either the normal feed or advanced System history
   makes another request rather than relying on stale in-memory state.

3. Filter client-side only after authorization.
   The server returns one bounded, authorized event feed; filter changes never
   widen that server contract or expose diagnostic data.

4. Preserve action-oriented handoffs.
   Download progress goes to Music Queue, unavailable audio inspection goes to
   Connections, added music goes to Library, and fulfilled requests go to
   Request Detail. Activity remains history, not a workbench.

5. Keep System history usable without making it the default workflow.
   The advanced System history view receives the same initial-loading protection
   and route-reload proof, while the normal Activity feed remains the primary
   user-facing history surface.

---

## 3. Options Considered

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Render `Nothing to show yet` before the first response | Minimal UI work. | Incorrectly tells the user that history is empty while it is still loading. | Rejected. |
| Wait for a manual Refresh before loading | Simple implementation. | Causes direct links and reloads to appear broken. | Rejected. |
| Load on mount with a first-load skeleton | Accurate state, clear feedback, and no extra user action. | Adds a small initial-loading branch to both Activity views. | Adopted. |
| Poll immediately and rely on focus refresh | Can eventually correct stale content. | Does not guarantee initial route hydration and creates unnecessary requests. | Rejected. |
| Send history users to advanced diagnostics | Retains all data in one place. | Reintroduces candidate/workbench-first navigation for ordinary activity. | Rejected. |

---

## 4. Final Recommendation Stack

- `ActivityFeedView`
  - tracks the first mounted feed load;
  - shows a compact skeleton and live loading copy until that request settles;
  - only displays `Nothing to show yet` after a completed empty response.
- `ActivityHistoryView`
  - applies the same first-load protection to System history;
  - preserves its existing durable table and explicit refresh control.
- `useActivityFeed`
  - remains the bounded, authorized normal-feed reader with focus revalidation;
  - does not gain a second polling or diagnostics pathway.
- Activity link presentation
  - continues to target Music Queue, Connections, Library, and Request Detail;
  - never puts raw candidate or provider diagnostics in normal feed rows.
- Browser acceptance
  - proves the direct `/app/activity` redirect, delayed first response, normal
    feed reload, filter-specific handoffs, System history initial load, and
    System history reload against the Docker-backed app runtime.

Security posture:

- no new API endpoint, client-side privilege, or unbounded query was added;
- filtering remains client-side over an already-authorized bounded response;
- normal Activity links do not expose candidate IDs, source-user identities,
  filesystem paths, operation-run IDs, credentials, or provider payloads;
- test fixtures contain only synthetic release/request identifiers and no live
  provider credentials.

---

## 5. Implementation Outcome

Changed:

- `src/client/views/ActivityFeedView.vue`
  - retains an initial-load flag until the mounted fetch settles;
  - replaces the false empty-state window with a compact skeleton.
- `src/client/views/ActivityHistoryView.vue`
  - applies the same initial-load protection before the System history table or
    its genuine empty state appears.
- `test/browser/activity-history-initial-load-browser-verification.test.js`
  - delays the first normal feed request and proves the direct Activity route
    shows loading, not a false empty state;
  - proves normal feed and System history reloads request fresh data;
  - proves Downloads, Audio checks, Library, and Requests filters retain the
    correct Music Queue, Connections, Library, and Request Detail handoffs.

Focused validation:

```text
npm run lint:client
npm run build
node --test test/browser/activity-history-initial-load-browser-verification.test.js
```

All commands pass.

Local deployment validation preserved the existing walkthrough data while
rebuilding the application image without BuildKit layer reuse:

```text
docker compose -f compose.walkthrough.yaml build --no-cache harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap
```

The recreated `harmoniarr` service reported healthy and the bootstrap confirmed
that the walkthrough administrator already existed.

---

## 6. Next High-Value Item

Run the local Docker walkthrough through the real monitored-artist flow with a
configured provider and mounted completed-download path. Prove that one release
automatically enters Music Queue, either reaches the normal download/add path
or stops at one clear external dependency/quality reason, and that the local
Activity feed explains the outcome without diagnostics-first navigation.
