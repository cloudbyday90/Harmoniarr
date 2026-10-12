# Operator track consent: official research

Consulted October 12, 2026 using connected Search MCP. OWASP URLs were discovered
by search and opened; official navigation supplied the canonical transaction
authorization URL. Previously MCP-verified W3C, PostgreSQL and node-postgres
URLs were reopened, including exact WCAG status and relevant guidance. Do not
interpret consultation as knowledge of later October changes. Local Node
24.18.1, npm 12.0.2, pg 8.23.0 and pg-pool 3.14.0 were inspected.

| Official source / authority | Applicable guidance | Engineering application / limit |
| --- | --- | --- |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative guidance | Least privilege, default denial and checks for each protected operation | Suppression and unresolved intent cannot grant an acquisition-policy exception. Product consent does not replace actor authorization. |
| [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html), informative guidance | Enforce the decision server-side and protect significant transaction data | Derive consent from captured saved polarity/remap/target fields and verify current source at SQL publication, independently of caller eligibility. This does not introduce financial authorization, credentials or MFA. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html), vendor documentation | Consistent lock order and cooperative transaction advisory locking | Preserve source admission and current actor/artist/run/acquisition checks; a pure policy function cannot lock concurrent writers. Privileged raw SQL is outside cooperative coordination. |
| [node-postgres transactions](https://node-postgres.com/features/transactions), driver documentation | All statements in one transaction use one client | Reuse existing publication and Wanted transaction owners; no additional in-transaction pool checkout. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation December 12, 2024 | Text labels/instructions and status information determinable without focus changes | Future UI should explain desired, suppressed and review-needed states distinctly. This backend policy change and summary field do not prove rendered status behavior or WCAG conformance. |

The mapping is a project-specific inference from reviewed guidance and source.
None of these sources defines music acquisition consent or permits widening a
saved track exception into another edition. Preserve existing group-scoped null
bindings while respecting concrete bindings; exact catalog membership and
downstream track scope need separate evidence.

Select the reusable target-specific positive/resolved decision described in the
[design](OPERATOR_TRACK_CONSENT_DESIGN.md). Benefit: coherent denial across three
consumers with valid manual intent preserved. Cost: adapters must supply the new
summary and old edition-bound intent no longer grants a different edition.
