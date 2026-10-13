# Official practices for Wanted root-cost profiling

Consulted October 13, 2026 through GitHub MCP repository metadata and MCP web
search/open/navigation. URLs below were returned by those services, not guessed.
Local runtime is Node 24.18.1 / npm 12.0.2; consulting Node 24.20.0 documentation
does not upgrade the runtime. No new dependency, schema, browser or HTTP contract.

| Official source and status | Applicable practice | Project owner and evidence |
| --- | --- | --- |
| [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html), vendor documentation reached through its version navigation | Read Committed uses a new snapshot per command; successive reads can see later committed changes. Repeatable Read retains an earlier snapshot | Keep every current owner/root read. A future batching design must account for the observation boundary and participating writers |
| [node-postgres transactions](https://node-postgres.com/features/transactions), maintainer documentation | A transaction's statements belong on the same client | Existing borrowed-client rollback samples; no extra checkout or parallel query |
| [Node 24.20.0 process](https://nodejs.org/download/release/v24.20.0/docs/api/process.html), stable vendor API documentation | Heap is V8 memory; external and ArrayBuffers overlap. Memory observation itself costs work | Fixed signed before/after process windows and periodic peaks, with diagnostics-off/on controls; never sum fields or claim allocation ownership |
| [W3C High Resolution Time 3](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 1 Working Draft | Elapsed durations use a monotonic clock, distinct from civil time | Node performance durations are a project application of this timing principle, not browser conformance or a W3C Recommendation claim |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Enforce current object authority at its owning boundary | Diagnostics observe existing checks; repeated bindings do not authorize root caching |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive fields, verify side effects and isolate logging failures | Fixed numeric aggregates omit SQL, parameters, paths, identities, DTOs and errors; Error/null controls preserve domain failure |

These sources support the measurement discipline. Our inference is that the
existing independent reads cannot be replaced solely because duplicate counts
are high: reducing statements changes opportunities to see committed revocation,
and database isolation does not freeze filesystem bytes. This is a design
constraint requiring native proof, not an external mandate for a particular
number of root reads.

The useful practices beyond W3C are OWASP authorization/data minimization,
PostgreSQL concurrency semantics, maintainer transaction ownership, and Node
resource/timing APIs. Apply each where it owns a real invariant. Accessibility,
HTML semantics and HTTP mutation standards remain in the existing skill; this
benchmark does not modify their user-facing behavior or establish compliance.

See [design and alternatives](WANTED_ROOT_COST_PROFILE_DESIGN.md) and
[measured outcome](WANTED_ROOT_COST_PROFILE_OUTCOME.md).
