# Discovery qualification: sources and recommendations

Official sources discovered and opened through the search MCP on October 20,
2026. This is a project application of the guidance, not a conformance assessment.

| Source | Relevant guidance | Project application |
| --- | --- | --- |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) | Recommendation; document provenance, quality and versions | By inference, distinguish fixture input, actual ingestion, native transfer and inspected publication; retain exact source/runtime identities. |
| [IETF RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | HTTP semantics; automatic retry of non-idempotent requests needs known safe semantics | Exercise durable application intent and identical replay; do not interpret a queued search as completed acquisition. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Informative guidance; validate access to the specific object on every request | Resolve the target from owned state, preserve actor identity and prove refusal before provider work. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html?trk=article-ssr-frontend-pulse_little-text-block) | Product documentation; row conflicts wait and locks have transaction scope | Reuse existing intent transactions and worker leases; await actual completion rather than treating a queued result as publication. |
| [Node 24.22 test runner](https://r2.nodejs.org/docs/latest-v24.x/api/test.html) | Product documentation; process isolation and file concurrency are separate controls | Keep the native scenario explicitly selected and serial; do not disable isolation or increase concurrency as an unmeasured speed fix. |

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Continue SQL-seeded candidates | Smallest setup; isolated transfer diagnosis | Omits canonical search intent, reconciliation and ingestion | Retain historical evidence only |
| Real commands/worker/client with owned HTTP responses | Bounded, account-free, verifies ingestion and downstream ownership | Does not qualify native search messages or public-network behavior | Implement this slice |
| Extend the native fixture with server search and compressed peer responses | Qualifies another wire boundary | Adds protocol parsing, compression and lifecycle work; broader failure surface | Next independent slice |
| Use a public account/network in the routine suite | Observes real remote results | Nondeterministic, credential-bearing and slow | Keep outside routine validation |

Recommended stack, in order: durable monitoring inputs and real reconciliation;
canonical authorized/idempotent command; configured queued worker and real HTTP
client/ingestion; explicit manual choice under real ambiguity; existing native
transfer and valid/corrupt content checks; provenance-separated retained evidence.
Extend the existing standards skill with this method instead of creating a
second competing standards framework. W3C, IETF, OWASP and PostgreSQL cover
different concerns; none substitutes for the others or establishes general WCAG
coverage. No dependency change is required for this stack.

Validation efficiency: strengthen one existing native scenario, run the fast gate
once on frozen code, and avoid repeating unrelated timeout/retry matrices. Keep
actual completion and cleanup instead of shortening waits blindly. A selected
scenario duration is not evidence of a whole-suite performance improvement.
