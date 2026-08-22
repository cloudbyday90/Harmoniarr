# Artist Detail Cache Baseline Workflow

Status: Implemented and validated
Date: 2026-08-22
Owner: Metadata architecture + web platform

## Purpose

The Artist Detail cache now produces a secure, bounded in-process aggregate,
but an operator has to interpret raw counters before deciding whether the
single-process SWR coalescing is sufficient. This document defines the next
increment: an on-demand administrative baseline view. It makes the observation
window, cache outcomes, refresh health, and decision limits explicit without
adding a write to the metadata request path.

This is a baseline workflow, not a distributed-cache design. Its purpose is to
measure ordinary Artist Detail use before introducing PostgreSQL coordination or
external telemetry infrastructure.

## Official Source Review

The review was performed on 2026-08-22 using official or primary sources
discovered through the web service:

- [OpenTelemetry metrics](https://opentelemetry.io/docs/concepts/signals/metrics/)
  describes metrics as runtime measurements and documents cardinality limits.
  The baseline therefore uses only fixed namespaces and fixed outcome values.
- [OpenTelemetry metric conventions](https://opentelemetry.io/docs/specs/semconv/general/metrics/)
  recommends meaningful aggregation over metric attributes and consistent
  metric names. The client derives percentages from the fixed aggregate rather
  than adding artist, user, cache-key, or error-message dimensions.
- [OpenTelemetry attribute requirement levels](https://opentelemetry.io/docs/specs/semconv/general/attribute-requirement-level/)
  states that high-cardinality metric attributes must be opt-in. Harmoniarr
  does not collect them for this diagnostic at all.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  advises restricting access to event data and excluding session identifiers,
  tokens, secrets, connection strings, and sensitive personal data. The view is
  fresh-admin-only and receives no raw provider data.
- [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) defines `no-store`
  for HTTP caching. The diagnostic read remains an authenticated API response
  with `Cache-Control: no-store`; it is not browser or service-worker storage.

## Options Considered

### A. Persist a snapshot on every cache lifecycle event

Pros:

- Produces a durable historical record and can compare restarts.
- Could aggregate data from several application instances.

Cons:

- Adds database work, retention policy, and operational failure modes directly
  to a hot provider-cache path.
- Requires a careful schema, access model, and retention plan before raw
  operational history is stored.

Decision: reject for the first baseline. The current question is whether a
distributed design is necessary; writing every event before answering it is
unjustified complexity.

### B. Add a full OpenTelemetry SDK and collector now

Pros:

- Supports fleet-wide aggregation, alerting, and durable dashboards.
- Provides the appropriate next layer when several application instances are
  deployed.

Cons:

- Requires collector/exporter configuration, credentials, network security,
  retention, and an approved backend.
- Expands the data-boundary review before the expected operational need is
  demonstrated.

Decision: defer. Preserve a stable, low-cardinality contract that an exporter
can adapt later.

### C. Leave only the raw diagnostic JSON endpoint

Pros:

- Has no additional client code or presentation surface.
- Is sufficient for direct API troubleshooting.

Cons:

- Does not make the process reset boundary obvious.
- Forces operators to manually derive lookup and refresh-health ratios,
  increasing the chance of a misleading comparison.

Decision: insufficient for routine baseline collection.

### D. Manual fresh-admin baseline view over the existing aggregate

Pros:

- Keeps metrics process-local, bounded, and read-only.
- Shows the observation start time, update time, fixed cache namespace, lookup
  distribution, refresh results, active work, and cache-store errors.
- Avoids automatic polling and client persistence; the administrative request
  occurs only when the operator explicitly refreshes it.
- Uses small ESM modules: one server observation-window field, one client
  presentation module, one composable, and one focused component.

Cons:

- Counters reset with the process and are not comparable across instances.
- Cannot prove cross-instance duplicate refreshes; it can only establish the
  baseline that determines whether broader telemetry is warranted.

Decision: accepted.

## Final Recommendation Stack

1. Retain server-side SWR and in-process refresh coalescing as the cache
   authority.
2. Add `observedSinceAt` to the existing safe aggregate so every sample has an
   unambiguous process-local measurement window.
3. Derive display-only cache-served, cold-lookup, and completed-refresh-failure
   percentages in a pure client presentation module. Do not add dimensions or
   persistence to the cache service.
4. Use an on-demand, fresh-admin component in the existing Metadata workspace.
   It must not auto-refresh, write to browser storage, or expose cache keys,
   MBIDs, raw provider errors, URLs, payloads, users, or credentials.
5. Collect at least one ordinary-load and one active-use sample after a stable
   process window. Treat cache-store errors, a sustained rise in cold lookups,
   or completed-refresh failures as investigation signals, not automatic
   evidence for a distributed lease.
6. Before considering a PostgreSQL refresh lease, prove that the deployment has
   multiple application instances and that duplicate revalidation is causing a
   provider-capacity or latency issue. If multi-instance visibility is needed,
   introduce an approved OpenTelemetry collector first; no local counter can
   establish that conclusion alone.

## Security and Data Controls

- The API stays `no-store`; no cache diagnostic response is saved by the
  browser, service worker, or client storage.
- The server retains the existing fresh-admin authorization check. The client
  does not weaken, emulate, or bypass it.
- A manual load action prevents background polling of operational data and
  avoids a fresh-session check merely because the Metadata workspace opened.
- The presentation accepts only the known response fields and treats malformed
  data as absent. It never renders free-form provider or error strings.
- All rendered values are Vue text bindings, not injected HTML.

## Baseline Interpretation

For each static cache namespace, use one snapshot to record:

- observation start and latest update timestamps;
- total lookups and the fresh/stale/cold distribution;
- cache-served percentage (`fresh + stale` divided by total lookups);
- cold-lookup percentage (`cold` divided by total lookups);
- completed refreshes, failures, active refreshes, last duration, and
  cache-store errors.

Do not compare samples across process restarts or assume a small sample is a
service-level objective. The first operational outcome is a baseline, not a
threshold. Investigation should begin with request volume, process age,
provider availability, and cache configuration before changing the architecture.

## Open Pull Request Review

GitHub was queried on 2026-08-22 through the connected GitHub service. There
are no open pull requests to apply locally for this increment. The prior
development-tooling Dependabot change is already represented in `main`; the
historical Node 26 container update remains inappropriate while the repository
targets Node 24 LTS.

## Implementation Outcome

Implemented on 2026-08-22.

- `metadata-provider-cache-observability-service.js` now includes the stable,
  process-local `observedSinceAt` timestamp in every aggregate response.
- `metadata-provider-cache-observability-presentation.js` validates the narrow
  response contract and derives display-only lookup and refresh-health ratios.
  It drops malformed namespaces, counts, and timestamps instead of rendering
  them.
- `useMetadataProviderCacheBaseline.js` is an ESM composable over the shared
  async-resource helper. It is manual by default, preserves a prior snapshot
  if a later read fails, and has no polling or storage.
- `MetadataProviderCacheBaselinePanel.vue` is shown only for the client-side
  admin role in the Metadata workspace. Server-side fresh-admin authorization
  remains the authority. The panel renders process-window timestamps, totals,
  per-namespace lookup distribution, refresh health, last durations, and
  cache-store errors.
- Focused service, route, API, presentation, composable, and view-contract
  coverage passed. The production client build, all 4,085 client tests, all
  3,034 server tests, the security audit, and the Artist Detail browser
  regression passed.
- The complete `npm run validate` contract passed: copyright (1,058 files),
  migration and schema-snapshot checks, ESM and image-tag checks, lint,
  test hygiene, 4,085 client tests, 3,034 server tests, 234 script tests,
  30 real-database integration tests, and both production builds.

## Next Item

After real operator samples are available, decide whether the deployment needs
fleet-wide telemetry. Only then evaluate a PostgreSQL refresh lease, with an
expiry, owner-safe release, and integration coverage for concurrent instances.
