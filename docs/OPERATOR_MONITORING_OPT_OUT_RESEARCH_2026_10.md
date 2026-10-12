# Operator monitoring opt-out: official research

Consulted October 12, 2026 through connected Search MCP. OWASP, W3C and
node-postgres URLs were identified by search results and opened; the canonical
WCAG URL was followed from official navigation. PostgreSQL 18 URLs were refreshed
from previously MCP-verified official documentation. No future October updates
or unreviewed draft behavior are assumed. Local versions are Node 24.18.1,
npm 12.0.2, pg 8.23.0 and pg-pool 3.14.0; the native fixture uses PostgreSQL 18.

## Applicable practices

| Primary source / status | Reviewed practice | Project application and limit |
| --- | --- | --- |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Default denial and validation at every request boundary | Require a positive monitoring flag for broad-policy automation and rederive eligibility at the protected write. Monitoring is a product consent gate, not a substitute for actor authorization. |
| [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html), implementation documentation | Read Committed statements can observe different committed snapshots | Retain current source/target rechecks and writer coordination in the existing publication transaction. A planner alone does not make reads globally stable. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html), implementation documentation | Transaction advisory locks release at transaction end and rely on cooperative use | Retain source admission and actor/artist scope locking around publication and saves. Privileged raw SQL remains outside that protocol. |
| [node-postgres transactions](https://node-postgres.com/features/transactions), library documentation | All transaction statements use the same client | Reuse the owned transaction and forward its queryable; no extra pool checkout or new transaction helper is needed. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation dated December 12, 2024 | Status feedback can be exposed to assistive technologies without focus movement (4.1.3); input changes must respect predictable context (3.2.2) | Future UI feedback should distinguish a saved opt-out, queued reevaluation and existing requests. This backend change exposes a bounded summary count; no rendered/live-region or full WCAG conformance claim follows. |

The mapping above is an engineering inference from official guidance and current
source, rather than a standard defining Harmoniarr's monitoring semantics.
Security, SQL atomicity and browser accessibility are separate evidence domains.

## Recommendation

Select shared policy eligibility plus existing final transaction enforcement.
This avoids policy drift between automation consumers and fails closed for absent
flags. Its cost is explicit fixture/adapter data requirements and one additional
summary field. Keep explicit consent semantics and existing requests separate.
Do not replace a narrow opt-out with blanket cancellation or new policy engines.
The [design](OPERATOR_MONITORING_OPT_OUT_DESIGN.md) compares concrete options;
the outcome will record executed evidence and the next scoped task.
