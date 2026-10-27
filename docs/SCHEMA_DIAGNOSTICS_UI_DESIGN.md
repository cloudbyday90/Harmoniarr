# Administrator schema diagnostics design

## Backend boundary

The new `GET /api/v1/system/diagnostics/schema-state` lives in a small route module
registered through the existing system routes. `Cache-Control: no-store` is set
before administrator authentication. An existing rate-limiter bucket admits 12
requests per minute by the app's current request-key policy, after authentication.
No request query/body controls the scan. GET is observational and needs no mutation
CSRF token; repair or other mutations are not available through this route.

The system module composes `createSchemaDiagnosticsService`, injecting it through
route dependencies. That factory admits one active scan per process, immediately
returns busy to other callers, retains no completed result and creates no queue.
It calls the existing read-only drift service, whose database ownership, limits,
shared preparation key and acknowledged rollback remain unchanged.

The HTTP projection selects state, successful completion time, separate lineage
and critical-check states, bounded counts and incomplete-lineage indication.
Anchor identities, expected/actual definitions, SQL, stored errors, unexpected
filenames and internal causes stay private. Inconsistent/malformed observations
become unavailable. Service busy/unavailable are explicit representation states
in a 200 response; authorization and rate limits retain 401/403/429. Before any
result is published, administrator authority is read again. A revoked/demoted
actor receives no result. Unexpected service errors get a fixed unavailable body.

The route inventory records the endpoint as an administrator diagnostic. Existing
overview, general refresh, export and startup paths do not invoke the scan.
No schema object, dependency, package version or second process is added.

## Client boundary and feedback

`SchemaDiagnostics.vue` sits permanently inside the Recovery diagnostics
disclosure, independently of general diagnostics loading/error branches. The
component uses existing hx tokens/primitives and a native 44px-minimum button.
`useSchemaDiagnostics` owns explicit refresh, one pending request, safe state
projection and disposal. There is no mounted/focus/timer fetch. The API wrapper
uses the existing same-origin session client and forwards its abort signal.

Initial state is not checked. Refresh clears previous facts immediately and shows
pending feedback. The surviving button stays focusable with aria-disabled, while
the handler suppresses Enter/Space/click duplicates. A permanent role=status,
aria-live=polite, aria-atomic node sits outside the aria-busy results container.
Completion never moves focus, including after the user focuses another control.

Completed results display completion time, independent migration/critical states,
critical check/missing/altered counts, bounded lineage differences when available,
and a truthful incomplete-count note. Attention does not offer a repair command.
Busy, unavailable, rate-limited and lost administrator authority have fixed
messages and no stale result/timestamp. Malformed/contradictory payloads cannot
produce a green current result. Raw HTTP error messages are never rendered here.

Disposal aborts transport and ignores late completions. It does not cancel an
already admitted server SQL scan; the server's bounded observer and admission
remain responsible for retirement. No cross-tab/global scan cache is introduced.
Browser request throttling complements, rather than replaces, server authorization.

## Validation and remaining scope

Focused tests cover private projection, admission/no queue, failures including
null, authorization before/after scan, no-store, duplicate suppression, stale
clearing and unmount/late completion. Native HTTP proof uses real sessions,
reader, role changes, catalog drift, preparation contention and rate limiting.
Browser proof joins one real current scan to controlled pending/attention/error/
busy/forbidden/retry states, persistent status/focus behavior and responsive themes.
Sibling readiness/artwork diagnostics remain in the selected browser regression.

Manual speech/physical-device acceptance remains deferred. Read-only scan limits
do not bound connection/filesystem/transport time or coordinate arbitrary external
SQL. The rate-limiter request key keeps the existing app semantics and is not a
new per-identity/distributed quota. See [research](SCHEMA_DIAGNOSTICS_UI_RESEARCH.md),
[outcome](SCHEMA_DIAGNOSTICS_UI_OUTCOME.md) and
[Docker design](LOCAL_DOCKER_SCHEMA_DIAGNOSTICS_UI_DESIGN.md).
