# Artist Detail Cache Sample-Capture Workflow

Status: Implemented and validated
Date: 2026-08-22
Owner: Metadata architecture + web platform

## Purpose

The prior baseline increment makes the bounded Artist Detail cache aggregate
visible to an administrator, but the operator still has to manually transcribe
values when comparing ordinary and active-use samples. This document defines a
small, explicit capture action that produces a bounded plain-text summary of
the already-loaded baseline.

It is intentionally an operator workflow aid, not metrics persistence,
telemetry export, or distributed cache coordination. The default Compose
deployment has one Harmoniarr service containing its embedded PostgreSQL
runtime, a fixed published port, and host-bound writable state. It is not a
horizontally scaled deployment shape. No evidence of an active multi-instance
deployment or of duplicate cross-instance revalidation is available in the
repository.

## Official Source Review

The review was performed on 2026-08-22 using current official or primary
sources discovered through the web service:

- [W3C Clipboard API and events](https://www.w3.org/TR/clipboard-apis/)
  describes asynchronous clipboard access as a powerful, permission-controlled
  API and calls out the risks of unexpected clipboard modification. The feature
  must therefore run only from a visible administrator button click, write only
  plain text, and never read clipboard contents.
- [OpenTelemetry service resource conventions](https://opentelemetry.io/docs/specs/semconv/resource/service/)
  define `service.instance.id` as an opaque unique identity for distinguishing
  concurrent service instances and warn that underlying pod or host information
  can be confidential. Harmoniarr does not add an instance identifier to the
  single-process diagnostic at this stage.
- [Docker Compose service reference](https://docs.docker.com/reference/compose-file/services/)
  describes a service as a scalable container definition and documents scaling
  restrictions. The checked-in Compose shape is deliberately a one-service,
  single-host baseline rather than proof that fleet coordination is required.
- [Docker Compose production guidance](https://docs.docker.com/compose/how-tos/production/)
  describes a single-server Compose deployment as the simplest production
  topology and identifies a cluster as the later scale-out step. This supports
  retaining the local SWR coalescer until the actual deployment changes.

## Options Considered

### A. Add an OpenTelemetry collector and instance identity now

Pros:

- Establishes a durable fleet-wide telemetry path for a later clustered
  deployment.
- Can distinguish simultaneous instances with an opaque service-instance ID.

Cons:

- Adds an exporter, collector endpoint, credentials, network policy, retention,
  and a new data-boundary review without a fleet to observe.
- Does not make the current single-instance operator workflow easier.

Decision: defer until deployment evidence demonstrates more than one active
Harmoniarr instance and duplicate provider work is material.

### B. Persist each sample in PostgreSQL

Pros:

- Gives a durable history and allows in-app comparison across restarts.

Cons:

- Adds schema, retention, access control, and failure handling for diagnostic
  data that is not needed to collect the first two operator samples.
- Would turn a bounded read-only cache aggregate into a stored operational
  record before its value is proven.

Decision: reject for this stage.

### C. User-initiated plain-text copy of the loaded, sanitized baseline

Pros:

- Lets an administrator record ordinary-load and active-use samples without
  retyping values.
- Reuses the existing process-local aggregate and adds no server route,
  database write, polling, browser storage, telemetry export, or cache-path
  work.
- Keeps the copied contract constrained to timestamps, fixed namespaces,
  aggregate counts, and derived percentages.

Cons:

- Clipboard availability can vary by browser security policy and permission.
- The administrator is responsible for placing the copied operational summary
  only in an approved support or incident record.
- The capture remains process-local and cannot establish a fleet-level result.

Decision: accepted.

### D. Leave samples as values visible only in the panel

Pros:

- No additional code or platform permission surface.

Cons:

- Makes the required baseline collection error-prone and discourages the real
  operational observation that should precede a larger architecture change.

Decision: insufficient.

## Final Recommendation Stack

1. Keep the process-local server SWR cache and in-process refresh coalescing as
   the cache authority for the current single-instance deployment.
2. Preserve the fresh-admin, `no-store` diagnostic read and manual refresh
   behavior; do not add polling, persistence, or a broad telemetry SDK.
3. Add one pure ESM presentation formatter that accepts only the normalized
   baseline and produces a bounded plain-text record.
4. Add one explicit administrator copy action that invokes only
   `navigator.clipboard.writeText()` after a user click. It must never read the
   clipboard, request background access, use a legacy DOM-copy fallback, or
   expose a raw error message.
5. Collect one ordinary-load and one active-use sample in the same process
   window. Store the text only in an approved operator record and include the
   process observation window in the comparison.
6. Revisit fleet telemetry only after a deployment change establishes multiple
   concurrent application instances. Consider a PostgreSQL refresh lease only
   if fleet evidence then shows duplicated refreshes causing provider capacity
   or latency harm.

## Security and Data Controls

- The copy action is unavailable until a bounded baseline has been loaded and
  is triggered only by an administrator's direct button click.
- The clipboard payload is plain text generated from normalized counts,
  timestamps, percentages, and safe cache namespaces. It excludes cache keys,
  MBIDs, artist names, user data, provider URLs, response bodies, credentials,
  raw errors, hostnames, container names, and clipboard contents.
- The browser is never asked to read clipboard data. A write failure produces a
  generic local status message and does not surface browser internals.
- No capture data is stored in Vue state beyond the already-loaded sample, in
  browser storage, in a service worker, on the server, or in PostgreSQL.
- The API's global `Cache-Control: no-store` behavior and fresh-admin server
  authorization remain unchanged.

## Operator Protocol

1. Sign in with a fresh administrator session and open Metadata.
2. Select **Load diagnostics** and note the process observation window.
3. Exercise a representative ordinary Artist Detail flow, then select
   **Refresh diagnostics** and **Copy baseline summary**.
4. Exercise a representative active-use flow in the same process, refresh the
   panel, and copy a second summary.
5. Compare only the process window, lookup distribution, refresh failures,
   active work, cache-store errors, and latest refresh timestamps. Do not infer
   cross-instance behavior from these samples.
6. If a process restarts, discard the comparison and begin a new pair of
   samples. Escalate cache-store errors or sustained cold/refresh-failure trends
   for configuration and provider investigation before proposing a lease.

## Open Pull Request Review

GitHub was queried on 2026-08-22 through the connected GitHub service. There
are no open pull requests to apply locally for this increment.

## Implementation Outcome

Implemented on 2026-08-22.

- `metadata-provider-cache-baseline-capture.js` is a pure ESM formatter that
  produces only normalized process-window timestamps, fixed namespaces,
  bounded counts, and derived percentages. Malformed namespaces and values are
  omitted or normalized; no provider or identifier fields can enter the text.
- `plain-text-clipboard-service.js` is a small ESM browser adapter that writes
  non-empty plain text only. It neither reads clipboard data nor falls back to
  legacy document-copy behavior.
- `MetadataProviderCacheBaselinePanel.vue` exposes **Copy baseline summary**
  only after a sample exists, disables it during a refresh, calls it only from
  a direct button click, and reports success or a generic local failure through
  an accessible status message.
- Focused formatter, clipboard adapter, panel-contract, presentation,
  composable, and view-contract tests passed. The focused Playwright scenario
  verified that an administrator can load and copy the record while injected
  raw provider payload and credential values stay absent.
- The complete `npm run validate` contract passed: copyright (1,060 files),
  migration and schema-snapshot checks, ESM and image-tag checks, lint, test
  hygiene, all client and server tests, 234 script tests, 30 real-database
  integration tests, and both production builds.

## Next Item

The accepted paired-sample comparison workflow is documented in
`ARTIST_DETAIL_CACHE_PAIRED_SAMPLE_COMPARISON.md`. It supports the required
ordinary-load then active-use comparison in live memory, without persistence or
new telemetry infrastructure. Use actual paired samples to identify a concrete
single-instance tuning need before considering a collector or lease.
