# Official practices for bounded current-root reads

Consulted October 13, 2026 through MCP search/open and official navigation;
GitHub MCP metadata discovers the repository and open PR endpoints. Links below
are returned by those services. Local Node remains 24.18.1; documentation for
24.20.0 is consulted without upgrading the runtime.

| Official source / status | Applicable practice | Owner and evidence |
| --- | --- | --- |
| [PostgreSQL 18 system information](https://www.postgresql.org/docs/18/functions-info.html), vendor documentation | Current transaction identity is distinct from connection identity; the non-assigning variant reports no ID before assignment | Proof allocates/captures identity once; each root statement checks it, including absent owner and connection reuse |
| [PostgreSQL advisory-lock functions](https://www.postgresql.org/docs/18/functions-admin.html), vendor documentation | Transaction-level locks belong to their transaction; a connection reference alone is not a durable guard | Existing publication admission plus current held-key proof, opaque invocation token and finally cleanup |
| [PostgreSQL 18 trigger catalog](https://www.postgresql.org/docs/18/catalog-pg-trigger.html), vendor documentation reached through version navigation; [official catalog source](https://doxygen.postgresql.org/pg__trigger_8h_source.html) | Firing configuration, event bits, columns and WHEN expression are separate guard properties | Validate enabled unconditional BEFORE STATEMENT guards and exact invoker/function/config contract. Disabled/conditional triggers refuse |
| [node-postgres transactions](https://node-postgres.com/features/transactions), maintainer guidance | Every transaction statement uses the same client | Token binds the exact owning queryable; no parallel query or extra checkout. Independent observer proves late writer ordering |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative guidance | Current object authorization belongs at the owning boundary; deny unproved authority | Boolean selection cannot mint a grant. Canonical root reads stay fresh; standalone/custom roots retain conservative behavior |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative guidance | Minimize sensitive diagnostic fields and isolate failures | Two fixed counters expose bounded work; transaction IDs, definitions, paths, owners and digests stay private. Preserve Error/null |
| [Node 24.20.0 process](https://nodejs.org/download/release/v24.20.0/docs/api/process.html), stable vendor API guidance | Process memory observation costs work; heap/external/ArrayBuffers overlap | Same-work paired measurements report fields independently and keep sampled peaks separate from caps/allocation/leak claims |
| [W3C High Resolution Time 3](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 1 Working Draft | Monotonic elapsed duration is distinct from civil time | Private duration comparisons apply the principle; no W3C Recommendation, browser conformance or universal speed claim |

Our inference is that ordinary root-input writer coordination permits one
current root statement per opening/closing phase for one exact group. It does
not authorize a retained root cache or remove filesystem closure. The proof
also depends on the preceding [coordination contract](WANTED_ROOT_AUTHORITY_COORDINATION_DESIGN.md):
consistent application ordering, enabled ordinary DML triggers and privileged
maintenance kept outside publication. SQL locks do not freeze host bytes.

Apply these backend practices alongside the existing W3C/HTTP/accessibility
skill where those surfaces change. This slice changes no UI controls or HTTP
semantics. See [design/pros and cons](WANTED_BOUNDED_ROOT_READ_DESIGN.md) and
[measured outcome](WANTED_BOUNDED_ROOT_READ_OUTCOME.md).
