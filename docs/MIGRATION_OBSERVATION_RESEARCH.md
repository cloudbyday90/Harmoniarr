# Migration observation research and recommendations

Consulted October 26, 2026 using connected MCP search and opened official URLs.
Applies to the installed Node 24.22.1/PostgreSQL 18.6 Docker runtime. The preceding
[readiness investigation](READINESS_DIAGNOSTICS_OUTCOME.md) reproduced concurrent
schema-preparation failures and introduced the reusable read-only status reader.

| Source and status | Applicable practice and owner |
| --- | --- |
| [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html), normative standard | GET has read-oriented semantics, while incidental server effects can exist. Remove bootstrap DDL from onboarding/restore-preview observation; retain explicit POST authority for backup creation and restore apply. This does not assert every GET is free of all logging/session effects. |
| [RFC 9111 caching](https://www.rfc-editor.org/rfc/rfc9111.html), normative standard | Send no-store for the administrator onboarding and restore-preview snapshots. It controls compliant cache storage/reuse; it is not a replacement for authentication or transport security. |
| [PostgreSQL 18 transaction access modes](https://www.postgresql.org/docs/18/sql-set-transaction.html?trk=article-ssr-frontend-pulse_little-text-block), official implementation documentation | Actual READ ONLY transactions disallow schema DDL. Qualify the shared reader on prepared state; missing schema must fail rather than create objects. |
| [PostgreSQL event triggers](https://www.postgresql.org/docs/current/event-trigger-definition.html), official implementation documentation | A failing ddl_command_start trigger prevents the supported DDL command from executing. Use an owned disposable database guard to detect accidental schema preparation in complete HTTP journeys. It does not cover all SQL side effects or shared-object commands. |
| [OWASP database security](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html), informative guidance | Restrict database privileges to required operations. Separating observation from preparation reduces unnecessary schema authority in these paths; this patch does not change the deployment's database role or claim a complete least-privilege migration. |
| [W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block), informative explanation of SC 4.1.3 | Preserve existing checklist/preview payloads and feedback boundaries. Avoid introducing refresh/navigation commands as a side effect of backend observation changes. No client rendering or accessibility-conformance change is claimed. |

The local race evidence motivates removing repeated schema writes; the standards
do not prescribe the application's module layout or prove that race's cause.
Likewise, a native read-only/DDL-guard control establishes the tested SQL boundary,
not whole-application purity, a latency gain or a memory limit.

| Recommendation | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Reuse readMigrationStatus in all remaining HTTP service consumers | One small reader; consistent migration counts; no catalog replacement during observation | Prepared schema is required; missing state remains an error/attention result | Implement |
| Keep startup/CLI preparation explicit | Retains bootstrap and fatal readiness contracts | Legacy CLI diagnostic helpers still combine observation and preparation | Retain for this patch; audit separately |
| Add no-store to the two affected administrator GETs | Fresh operational snapshots and reduced cache retention | Repeated reads reach the application | Implement |
| Serialize/retry the legacy preparing helper | Could hide some concurrent failures | Keeps writes in observation and adds lock/retry policy | Reject |
| Separate observation database role or pool | Stronger privilege boundary could be designed | New credentials, provisioning and lifecycle contracts | Defer to a dedicated deployment design |

Recommended stack: explicit startup preparation → shared read-only migration
reader → existing onboarding/export/preview services → existing authorization and
command boundaries → no-store administrator snapshots. Keep native filesystem
durability checks in their qualified Linux environment and retain host failures.

See the separate [design](MIGRATION_OBSERVATION_DESIGN.md) and
[outcome](MIGRATION_OBSERVATION_OUTCOME.md).
