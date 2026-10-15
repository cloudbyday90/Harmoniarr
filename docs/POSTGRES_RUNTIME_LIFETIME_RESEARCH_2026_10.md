# Shared runtime lifetime official research

Consulted 2026-10-15 using MCP search/opening and GitHub repository metadata.
URLs below were discovered through those services. Installed Node is 24.18.1,
pg 8.23.0 and Testcontainers 12.1.0; existing PostgreSQL 18, two-client pools and
resource deadlines remain unchanged. No dependency upgrade is required.

| Primary source and status | Relevant guidance | Application |
| --- | --- | --- |
| [Node 24 test runner](https://r2.nodejs.org/docs/latest-v24.x/api/test.html), vendor documentation opened as 24.22.0 | Asynchronous activity may outlive a reported test; timeout alone is not reliable cancellation | Track actual database-operation promises and drain native test operations rather than relying on reporter completion |
| [ECMAScript promise algorithms](https://tc39.es/ecma262/multipage/control-abstraction-objects.html), living specification opened as the next-edition 2027 draft in October 2026 | allSettled fulfills after every input has fulfilled or rejected | Reuse the existing allSettled drain rather than first-rejection release; this does not cancel work |
| [node-postgres pool API](https://node-postgres.com/apis/pool), maintainer documentation | Await pool.end to drain connections and timers; release checked-out clients | Include the full helper/delegate release tail before server disposal |
| [Testcontainers container lifecycle](https://node.testcontainers.org/features/containers/), maintainer documentation | A supplied stop timeout waits for container stop; cleanup/removal settings have distinct effects | Keep the existing bounded stop after drainage, retaining stop errors and default reaper behavior |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement dated 2025-05-15 | Minimize transferred personal data | Publish bounded lifecycle outcomes, keeping connection configuration, generated identities and raw diagnostic content private |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative guidance | Exclude secrets/connection strings and verify diagnostic failure handling | Preserve existing minimized captures and original failures; add no raw configuration logging |

The admission seal, allSettled drain and separate scenario/cleanup results are
project engineering decisions inferred from those sources and existing owners.
W3C's Statement does not mandate a PostgreSQL fixture lifecycle. No browser
behavior or WCAG conformance is claimed. Current Node/driver pages can describe
newer APIs; the implementation uses the existing project lifetime utility and
APIs supported by the installed runtime.

## Options, pros and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Reuse the existing per-owner lifetime barrier | Small shared contract; synchronous admission seal; drains rejected siblings without early release | Cleanup waits indefinitely for genuinely unreturned work; callers must release cooperative holds | Implement |
| Add a new PostgreSQL-specific registry | Could support new policy later | Duplicates the established app lifetime and invites divergence | Reject for this scope |
| Use Promise.all for drainage | Familiar first-rejection behavior | Can release the server while another operation is still running | Reject |
| Race cleanup against timeout/abort or force-exit | Produces a shorter apparent teardown | Does not prove quiescence and can abandon database/file work | Reject |
| Aggregate scenario errors into cleanup | One combined result | Changes scenario/cleanup ownership and Error/null contracts | Reject |

Recommended stack: synchronous shared admission → existing lifetime registry →
full delegate promises → allSettled drainage → strict database/template release
→ bounded owned server stop → independent workspace guards. It improves teardown
correctness without increasing concurrency, introducing retries or claiming a
whole-suite speedup.

See [design](POSTGRES_RUNTIME_LIFETIME_DESIGN.md) and
[outcome](POSTGRES_RUNTIME_LIFETIME_OUTCOME.md).
