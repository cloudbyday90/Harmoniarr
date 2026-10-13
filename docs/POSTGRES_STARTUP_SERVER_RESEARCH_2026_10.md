# PostgreSQL startup evidence research

Consulted 2026-10-13 using MCP search, repository metadata and opened official
sources. Local Node is 24.18.1; the preceding native fixture reported PostgreSQL
18.3. Version-specific server configuration is limited to reviewed PostgreSQL 18
fixtures, and native validation checks the actual installed version.

| Source and status | Applied practice | Benefit / cost |
| --- | --- | --- |
| [PostgreSQL 18 logging](https://www.postgresql.org/docs/18/runtime-config-logging.html), engine documentation | Connection receipt/authentication/authorization/setup logs; structured JSON and source locations | Server-side progress; logger process and temporary disk output |
| [PostgreSQL 18.3 startup source](https://github.com/postgres/postgres/blob/62d6c7d3df6287f1bd83199c1a746e50d31571a0/src/backend/tcop/backend_startup.c), maintainer implementation | Receipt precedes startup parsing; application name is copied for authorization logging | Explains the pre-authentication correlation limit |
| [PostgreSQL authorization source](https://github.com/postgres/postgres/blob/62d6c7d3df6287f1bd83199c1a746e50d31571a0/src/backend/utils/init/postinit.c) and [ready source](https://github.com/postgres/postgres/blob/62d6c7d3df6287f1bd83199c1a746e50d31571a0/src/backend/tcop/postgres.c), maintainer implementation | Bind private authorization marker to a PID/session and select the initial setup event | Exact stage evidence; not a stable public log-parser API |
| [Testcontainers containers](https://node.testcontainers.org/features/containers/), framework documentation and installed source | Configure only the default fresh owner; preserve existing health/listening admission | Isolated ownership; custom/external fixtures remain unsupported |
| [Node net documentation](https://nodejs.org/download/release/v24.20.0/docs/api/net.html), runtime documentation | Socket ports are local/remote endpoints, not proof of an untranslated Docker path | Avoids false association; cannot identify pre-auth sessions by a guessed tuple |
| [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/), platform documentation | Published ports use forwarding/NAT; associate by server marker/session instead of assuming tuple equality | Correctness across mapped ports; early receipts may remain unknown |
| [W3C High Resolution Time 3](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), Working Draft 2026-09-01 | Keep monotonic client durations distinct from server timestamp-derived components | Meaningful elapsed windows; no conformance or common-clock claim |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Fixed fields, bounded reads, private identity and failure-isolated capture | Limits disclosure/injection and preserves original errors |

Source URLs were discovered through MCP search or the PostgreSQL repository's
contents/ref metadata. The immutable REL_18_3 ref resolved to the commit above.
Installed pg 8.23.0/pg-pool 3.14.0 startup surfaces remain explicitly version
gated. These project choices are inferences from official behavior, rather than
standards prescribing this exact fixture design.

## Recommendation stack

1. Adopt failure-only structured server snapshots on fresh owned fixtures.
   Minimize output and preserve the existing canonical capture completion.
2. Associate only a unique private authorization marker and ordered PID/session
   records. Preserve unassociated/ambiguous outcomes; names and socket tuples
   alone are insufficient.
3. Keep deadlines, pool limits, startup semantics and original Error/null.
   A successful later control does not relabel a failed collection as complete.
4. Use this evidence to locate the next reproduced cold-start failure before
   changing scheduling, pool policy or retry behavior. Then resume the guarded
   no-change Wanted/link publication investigation.

Pros: server/client stages can be compared privately and safely. Cons: extra
temporary logging and failure capture work; pre-authentication identity remains
unknown without a marker-bearing record; supported log formats require review.
