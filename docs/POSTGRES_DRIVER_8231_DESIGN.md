# PostgreSQL 8.23.1 implementation review

Date: 2026-10-19. This follows the driver review recommended by the
[prerequisite outcome](LIBRARY_ADD_PROBE_OWNERSHIP_OUTCOME.md). The application
uses the JavaScript driver through ESM imports. Diagnostic adapters depend on
private queue, connection and startup methods; public API compatibility alone
cannot qualify those methods.

The selected change upgrades pg 8.23.0 to 8.23.1, pg-protocol 1.16.0 to 1.16.1,
pg-connection-string 2.14.0 to 2.14.1 and optional pg-cloudflare 1.4.0 to 1.4.1.
pg-pool remains 3.14.0. Other runtime and development packages stay at their
opening versions. The lockfile retains registry integrity values.

## Reviewed implementation boundaries

Published npm archives were unpacked privately and compared with each other,
the installed files and the upstream immutable Git comparison linked in the
[research](POSTGRES_DRIVER_8231_RESEARCH_2026_10.md). This is source review plus
local contract testing, not a repository-wide security audit.

| Boundary | Implementation finding | Required local evidence |
| --- | --- | --- |
| Queue ownership | pg-pool 3.14.0 is unchanged. connect appends one PendingItem; pulse removes that same item before newClient or acquire. A failed connection pulses before delivering its failure. | Held queue timeout, promise/callback cold promotion, reuse, failed cold connection promoting another owner, custom-method refusal. |
| Connection/startup | Client construction, startup packet dispatch and authentication/readiness handlers retain their observed contracts. Connection.startup still synchronously writes the serialized buffer once. | Matched original client, held startup, successful readiness, app entrypoints, Error/null and cancellation retirement. |
| Protocol writer | Startup serialization logic is unchanged; the shared writer now copies only initialized bytes when growing. Bind reserves and fills format codes in one buffer. | Large Unicode text with binary, null, array and date parameters on actual PostgreSQL, through callback and promise queries. |
| Query lifecycle | Config normalization copies descriptors rather than mutating the caller. Named empty statements are recognized as previously submitted. Sync no longer marks the connection as ending. | Reuse one caller config across both APIs; repeat a named empty statement; confirm later parameterized work and non-ending connection state. |
| TLS | The secure-stream options now include the destination host while leaving IP SNI unset. Upstream adds host-selection tests. sslconnect still precedes Node secureConnect. | Preserve the existing distinction; current local native selection is plaintext and does not establish certificate or TLS handshake coverage. |
| Other paths | Pipeline portal refusal, native libpq pipeline/error fields, invalid-date deprecation, IPv6 parsing and Cloudflare socket fixes are also present. | Inspect source and identify applicability. This project does not enable pipeline mode or use libpq/Cloudflare in this validation. Do not claim those paths passed native tests. |

The small pg-observer-driver-policy module admits exactly
pg 8.23.1 / pg-pool 3.14.0 / pg-protocol 1.16.1. The installed-driver adapter reads
metadata and fails closed on missing/unreadable metadata. Version values use
strict comparison without coercion. Pool class, Client and method identity
checks remain intact. Unreviewed versions continue ordinary native checkout
without instrumenting unsupported private surfaces. A focused test also fails
when the installed dependency tuple loses review coverage.

No pool size, checkout/scenario timeout, retry, fixture scheduling, diagnostic
payload, TLS verification setting or application API changes accompany this
upgrade. Existing factory-owned queue/connection/write observers remain separate.

## Validation and recovery

Run focused policy/queue/connection/startup/record tests, then the six selected
native files listed in the outcome, serially through the existing preflight and
file-process owners. Use fresh immutable PostgreSQL/media/reader identities and
retain failed collections. Run validate:fast on the stable source. Hash all
source, including package manifests/lockfile, before and after native validation.
Do not describe selected native coverage as the complete integration gate.

Rollback must restore the package pair and driver policy together, reinstall the
lock with lifecycle scripts disabled and validate the restored installed tuple.
PR 46 remains open: its Express/Vue/router changes require separate qualification.
The randomly selected PR 48 has its own [outcome](OPEN_PR_48_LOCAL_EVALUATION_OUTCOME.md).
