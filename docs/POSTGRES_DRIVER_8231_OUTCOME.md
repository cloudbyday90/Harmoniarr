# Reviewed PostgreSQL patch outcome

Date: 2026-10-19. The [design](POSTGRES_DRIVER_8231_DESIGN.md) and
[official research/tradeoffs](POSTGRES_DRIVER_8231_RESEARCH_2026_10.md) led to a
pg-only upgrade, rather than adoption of all four runtime packages from PR 46.
All authored JavaScript remains ESM. Work stays on main.

## Delivered behavior

pg is now 8.23.1, pg-pool remains 3.14.0 and pg-protocol is 1.16.1. Required
connection-string and optional Cloudflare patch dependencies are locked with
their published integrity values. Package review verifies five old/new archive
integrities and matches all published files for the three installed driver,
pool and protocol packages. Only the pg subtree changed in the dependency lock.

The separate driver policy admits that exact reviewed tuple, including the
serializer. Unsupported versions and custom pool methods continue to refuse
diagnostic instrumentation. Existing queue, connection and startup owner modules
retain their boundaries. New native tests exercise actual mixed parameter Bind
messages, reusable caller query configuration, repeated named empty statements
and non-ending Sync state. No pool/deadline/scheduling or TLS verification
settings were relaxed.

Random [PR 48](OPEN_PR_48_LOCAL_EVALUATION_OUTCOME.md) was applied and installed
locally. Actual language-server initialization failed with TypeScript 7.0.2;
restoring the original package pair and TypeScript 6.0.3 restored initialization.
The failed candidate remains private evidence. Neither PR 48 nor the remaining
Express/Vue/router changes in PR 46 are retained. Closing GitHub MCP metadata
confirms both PRs remain open at their evaluated heads. No PR merge, closure,
comment, branch rewrite, release or tag was created.

## Validation

The initial 66 focused cases passed. The first selected native collection also
passed all 22 cases, but the first validate:fast stopped at a new test's
no-promise-executor-return lint error after 13.875 seconds. That failure and
source identity are retained. Changing the callback to a block corrected the
lint issue. A fresh six-file native collection and complete fast validation then
passed on the corrected source; the older native collection is not substituted
for final-source proof.

| Final native selection | Cases | Local elapsed seconds |
| --- | ---: | ---: |
| pg-driver-contract.test.js | 2 | 4.722 |
| fixture-pool-checkout.test.js | 7 | 42.429 |
| app-checkout-diagnostics.test.js | 3 | 15.673 |
| postgres-startup-server.test.js | 4 | 17.295 |
| postgres-startup-cancellation.test.js | 4 | 21.436 |
| postgres-runtime-startup.test.js | 2 | 17.474 |

All 22 selected native cases have zero failures, cancellations, skips or todos.
The existing preflight verifies immutable PostgreSQL/media/reader identities and
retires its probes before admission. Native files retain separate processes and
run serially. Host Node is 24.18.1 and Docker Engine is 29.8.2/API 1.56. Fast and
native work overlapped under the current host load; these elapsed observations
are not a benchmark, speedup claim or diagnosis of historical failures.

validate:fast passed 10,509 cases: 5,454 server, 4,384 client and 671 script cases,
with zero failures/cancellations/skips/todos. Static, ESM, lint, test-hygiene and
both production builds passed. Its total local wall time was 122.491 seconds.
The existing 225 Vue warnings remain. Each of the six selected native processes
also emits the known TestsStream warning about 11 end listeners versus a limit
of 10. These warnings remain unresolved; no warning suppression or listener-limit
increase was used.

Final native source identity is 3,028 files, SHA-256
1472501f6a8a2a5a0ca5e6b04192c62caae54a216719db90c7d862df6072e2dd.
The full source fingerprint includes package JSON/lock bytes and matches before
and after native execution. Final staging is checked against those tested bytes.
Raw logs, exact candidate/restoration hashes, JSON-RPC results, package artifacts
and both collections remain ignored under .tmp/pg8231-review-2026-10-19/.

## Limits and recommendation

The canonical inventory is now 129 integration files with an intended 563 native
cases. This is selected six-file/22-case evidence; 123 other paths were not
freshly rerun. It is not the complete integration gate, a browser accessibility
evaluation or hosted-Ubuntu qualification. Current local native driver controls
use plaintext PostgreSQL. Existing TLS stream-capability/milestone unit controls
and reviewed upstream TLS changes do not establish native certificate-identity
or handshake-failure coverage. Pipeline, libpq and Cloudflare runtime paths were
not exercised.

Retain the reviewed pg-only stack, exact private-adapter guard and TypeScript 6.
The benefits are upstream fixes and bounded qualification; the costs are ongoing
private-version review and the stated coverage limits. Existing testing and
web-standards skills now route implementation-sensitive dependency work to
published-byte review, actual consumer initialization and native-owner proof.
Their validators and the installed standards mirror are checked separately;
those checks do not certify runtime security.

Next: add native TLS identity controls with trusted test certificates, matching
and mismatching IP/DNS destinations, actual secureConnect evidence and owned
retirement after handshake failure. Keep verification enabled. Then reconsider
PR 46's remaining Express/Vue/router changes against request/navigation behavior.
There is no deployment-image rebuild or release in this commit.
