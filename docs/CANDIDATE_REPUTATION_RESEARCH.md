# Candidate reputation research and recommendation

Verified through connected MCP search and page reads on 2026-10-23. Guidance is current to this verification date; it is not a blanket security or conformance certification.

## Official evidence

- [AWS Builders Library: making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/?did=ba_card): explicit intent identifiers distinguish replay from new intent; identifier recording and related mutations need ACID ownership. Identifier lifetime and late requests need a deliberate contract.
- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html): READ COMMITTED refreshes the statement snapshot and conditional updates re-evaluate rows after waiting. Our inference is to retain producer status guards and read the trust snapshot after its serialization lock.
- [PostgreSQL 18 client connection defaults](https://www.postgresql.org/docs/18/runtime-config-client.html): lock_timeout bounds each acquisition separately. Our five-second snapshot admission timeout is not a total operation deadline.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/): this May 2025 W3C Statement supports minimizing collection and transfer. Reusing the existing event UUID avoids adding another retained identity or duplicating file/provider payloads. This server persistence change does not establish WCAG or overall W3C conformance.

## Alternatives

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Existing post-commit best effort | Core transition independent of evidence storage | Crash/refusal can permanently lose ledger evidence or split counters | Replace |
| Atomic producer/event/ledger/snapshot | No distributed dual write; existing UUID and guards; immediate consistency | Trust lock contention can reject the producer; full snapshot rewrite remains | Adopt |
| Durable outbox and idempotent consumer | Decouples consumer latency, useful across databases | New queue, retention, retries and receipt policy; eventual consistency | Defer until an actual cross-store requirement |
| Candidate ID or content-derived identity | Simple | Collapses later attempts or equates distinct intent; ambiguous retention | Reject |

## Recommended stack

1. Existing PostgreSQL transaction, explicit READ COMMITTED and producer compare-and-set/episode locks.
2. Existing candidate event UUID as ledger/history identity, expiring transaction publication scope and fail-closed acknowledgement.
3. Existing shared snapshot mutation lock for fresh read/modify/write, with five-second per-lock timeout (not a total operation deadline).
4. Post-commit advisory callbacks, separately tested; no automatic retry of external file operations.
5. Focused Node tests, isolated PostgreSQL contention/rollback, packaged PostgreSQL, then one full fast validation and no-cache preserved-state deployment.

The [outcome](CANDIDATE_REPUTATION_OUTCOME.md) prioritizes an observed controlled-provider fixture authority gap before further architecture work. The next architectural improvement should be measured per-source snapshot persistence. It needs migration/restore design and workload evidence; adding a second application does not address this persistence boundary.

## Pull requests

Connected GitHub search returned zero open PRs for cloudbyday90/Harmoniarr on 2026-10-23. No random applicable PR, merge or stale-PR mutation was available.
