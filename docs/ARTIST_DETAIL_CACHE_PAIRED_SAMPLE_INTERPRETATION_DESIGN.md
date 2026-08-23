# Artist Detail Cache Paired-Sample Interpretation

Status: Implemented and validated
Date: 2026-08-22
Owner: Metadata architecture + web platform

## Outcome

The administrator-only Artist Detail cache baseline panel now interprets a
valid, same-process paired comparison with a bounded reading and a concrete
next action. The reading is calculated only from the existing normalized
aggregate counters. It does not trigger providers, accept artist input, add an
API, persist a sample, poll diagnostics, or change cache policy.

The reading identifies these aggregate conditions in safety-first order:

| Condition | Reading | Operator action |
| --- | --- | --- |
| Pair cannot be compared | The process boundary or cumulative counters are not comparable | Clear the start and begin a new pair |
| Cache-store errors or refresh failures | The observation needs investigation before cache policy can be inferred | Inspect the affected namespace and provider configuration |
| Refresh work remains active | The stale revalidation result is not complete yet | Refresh diagnostics after work settles |
| No lookups were added | The selected Artist Detail flow did not reach a provider cache | Exercise Discography or related artists, then refresh |
| Fresh reads only | Same-process cache reuse is observed | Keep the existing cache policy; capture the aggregate if needed |
| Stale reads without cold lookups | SWR reuse is observed | Refresh after background work settles and check failures |
| Cold and cache-served reads | The aggregate is consistent with a cold fill followed by reuse | Repeat a focused pair if a particular flow still appears slow |
| Cold reads only | A foreground load was observed but reuse is not yet evidenced | Reopen the same Artist Detail flow and refresh the pair |

These are deliberately aggregate readings, not identity-level assertions. The
panel cannot prove that two requests targeted the same artist, because retaining
that identifier in diagnostics would be unnecessary disclosure and would widen
the data boundary.

## Official Source Review

This design was reviewed on 2026-08-22 against current primary guidance:

- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  defines cumulative monotonic sums and their start-time boundaries. The
  reading uses only the existing same-process comparison, rejects reset or
  changed-window samples, and derives deltas rather than treating totals as
  independent events.
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) and its
  [rate-limiting policy](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
  require a meaningful User-Agent and an average source-IP rate no greater
  than one request per second. The interpretation feature makes no provider
  request; the administrator performs one ordinary, rate-respectful Artist
  Detail flow through the existing shared client and cache.
- [MDN Cache-Control reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
  distinguishes `no-store` from `no-cache` and explains that `no-store`
  prevents caches from storing a response. The protected diagnostics response
  remains `no-store` and the new reading adds no browser storage.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  advises excluding session identifiers, access tokens, credentials, and
  sensitive data from observability records. The assessment accepts only safe
  fixed aggregate fields.
- [W3C ARIA22 status-message technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  recommends a polite status region for updated advisory information. The
  dynamic reading is announced as a complete, non-focusable status message.

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add an admin endpoint that runs a provider probe | Produces a one-click result | Adds a provider-call attack surface, CSRF/mutation rules, rate-limit risk, and an ambiguous live-test contract | Reject |
| Persist paired diagnostic samples | Survives restart and supports history | Adds schema, retention, access-control, and cleanup obligations for unneeded operational data | Reject |
| Export full OpenTelemetry metrics now | Enables fleet dashboards and alerts | Requires exporter/collector infrastructure, credentials, network controls, and an approved telemetry backend | Defer |
| Keep raw aggregate deltas with no interpretation | Smallest code surface | Forces error-prone manual reasoning and can lead to a premature TTL change | Reject |
| Add a pure in-memory assessment over the existing validated comparison | Gives a repeatable next action with no new data or provider surface | Cannot prove identity-level request ordering or multi-instance behavior | Accept |

## Final Recommendation Stack

1. Retain the existing fresh-admin, `no-store`, manual baseline request and
   same-process comparison boundary.
2. Use the pure ESM assessment as an operator decision aid, not a cache-policy
   controller or a replacement for the lifecycle integration proof.
3. Run one ordinary, rate-respectful live Artist Detail pair through the shared
   provider client. Interpret cache-store errors and refresh failures before
   considering any lifetime, retry, or topology change.
4. Keep the current single-node cache architecture. Add a collector or
   distributed coordination only after a measured multi-instance operational
   need exists.
5. Record a copy of a sanitized aggregate only in an approved operator record;
   never add artist IDs, provider URLs, payloads, credentials, or raw errors to
   diagnostics.

## Security and Accessibility Boundaries

- The assessment receives only fixed count fields already accepted by the
  paired-comparison module. Invalid or missing data is unavailable, never
  rendered as an optimistic success state.
- It stores no comparison, user input, artist identifier, cache key, provider
  URL, payload, error text, credential, session value, hostname, or instance
  ID. The existing Vue-memory comparison remains the only temporary state.
- The feature makes no network request and cannot bypass the route's fresh
  administrator authorization or `Cache-Control: no-store` response policy.
- Reading text is static and Vue-bound. It does not render user-provided HTML
  or error strings.
- The status region contains both the visible condition and its next action,
  so assistive technology receives equivalent advisory context after refresh.

## Open Pull Request Review

Three open pull requests were inspected without merging or applying a branch:

| PR | Finding | Decision |
| --- | --- | --- |
| #40, Node 26 image update | Conflicts with the repository's Node 24 LTS engine range and container policy | Not applicable; do not apply locally |
| #24, `docker/build-push-action` 7.2 | Main already pins the newer verified 7.3 release | Stale; no local change |
| #23, `docker/metadata-action` 6.1 | Main already pins the newer verified 6.2 release | Stale; no local change |

## Implementation Outcome

- `metadata-provider-cache-paired-sample-assessment.js` is a pure ESM module
  that evaluates only a comparable aggregate and returns fixed code, tone,
  title, summary, and next-action fields.
- The administrator-only baseline panel renders the reading before the raw
  interval metrics and keeps it responsive using existing design-system
  tokens.
- Unit and component-contract coverage validates every assessment condition,
  malformed input handling, no browser persistence, and status-message
  semantics.

## Validation

Run the focused client checks:

```powershell
node --test test/client/metadata-provider-cache-paired-sample-assessment.test.js test/client/metadata-provider-cache-baseline-panel-contract.test.js
npm run lint:client
npm run build:client
```

Validation completed successfully on 2026-08-22:

- `npm run lint:client` and `npm run lint:test`
- focused unit and component-contract checks for the assessment, comparison,
  baseline panel, and Metadata view
- `npm run test:client` (4,098 client tests)
- `npm run build:client`
- focused Playwright coverage for the administrator load, copy, mark, refresh,
  comparison, and cache-store-error reading. The fixture's provider payload and
  credential remained absent from the copied operator record.
- `npm run validate`: repository-wide lint, ESM, migration, schema, server,
  client, script, integration, and production-build validation.
- The documented no-cache walkthrough rebuild: `docker compose -f
  compose.walkthrough.yaml build --no-cache harmoniarr`, followed by `up -d
  --wait --no-build harmoniarr` and the one-shot bootstrap helper. The
  recreated service was healthy. A rebuilt local browser session loaded,
  marked, and refreshed the panel, rendered the expected no-activity reading,
  and recorded no console errors.

## Next Item

Run one fresh-administrator, same-process real-provider pair in Metadata:

1. Load diagnostics and mark the comparison start.
2. Open one ordinary Artist Detail Discography or related-artists flow through
   the existing shared provider client.
3. Refresh diagnostics, act on the bounded reading, and copy only the
   sanitized aggregate if an approved incident record needs it.
4. Add a focused regression for the observed namespace and phase before
   changing cache TTLs, stale windows, provider retries, or deployment
   topology.
