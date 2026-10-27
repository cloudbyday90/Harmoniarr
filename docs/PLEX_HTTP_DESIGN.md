# Bounded owned Plex HTTPS design

October 27, 2026. Plex sign-in, owner linking and directory reads previously
buffered arbitrary response text without an application deadline. The shared
client now owns bounded HTTP work and actual retirement. No dependency, schema
artifact, public route or extra deployed service is added. See the separate
[research and tradeoffs](PLEX_HTTP_RESEARCH_2026_10.md).

## Module and lifetime ownership

| Module | Responsibility |
| --- | --- |
| `plex-http-policy.js` | Fixed origins, primitive header validation, operation budgets, response validation and private error mapping |
| `plex-https-transport.js` | Isolated native HTTPS request, bounded stream collection, public DNS answers and actual native/DNS drainage |
| `plex-request-service.js` | Existing deadline-task owner, four-slot admission, JSON publication fence, cancellation and close |
| `plex-http-client.js` | Thin asynchronous endpoint/collection facade preserving the five existing operations |
| App/provider/startup/drain composition | Share one owner across Plex consumers and drain it after producers, before closing the database pool |

All first-party modules use ESM factories. There is no large shared singleton or
process-global dispatcher mutation. Standalone client factories own their own
limits; the application's aggregate limit comes from sharing one client. Internal
DI permits controlled fixtures, not public transport/authority overrides.

## Request admission and transport

One owner permits four active requests with no application queue. Additional calls
return a fixed busy refusal; callers may retry explicitly. Each admitted call
captures destination/header primitives before asynchronous work and starts a
15-second monotonic result deadline through the existing deadline-task helper.
Tests may choose stricter limits; constructor policy cannot raise them.

Only the two fixed Plex HTTPS origins are admitted, without URL credentials,
fragments or nondefault ports. The endpoint facade retains the existing URL/query
contracts and validates PIN IDs and bounded printable identifiers/tokens. The
token is supplied only as `X-Plex-Token`; no browser cookies, arbitrary headers or
referrers are forwarded. HTTP redirects are never followed.

Each request gets a private non-keepalive HTTPS agent with empty proxy settings,
explicit TLS servername and `rejectUnauthorized: true`, and a 16 KiB header limit.
It neither inherits a global dispatcher/agent nor supports an environment proxy.
DNS lookup requests all OS answers, validates every address as public, and supplies
only that validated result to native connection selection. Private/mixed or
invalid answers fail before HTTP delivery. The fixture routes validated public
answers to its own loopback TLS server only through an internal test seam.

Headers, TLS or body failures destroy response/request/agent. Native request,
response and socket close promises are registered before work can retire. Every
issued OS lookup callback also has a completion promise, including a callback
arriving after cancellation. Native destruction does not falsely release a slot
while that callback is still pending. No cancellation acknowledgement is treated
as proof that all work is gone.

## Body and error policy

Request identity encoding; refuse any other content encoding. Successful responses
must declare JSON content type. Check Content-Length against the operation budget
before reading, and independently count streamed bytes so absent or misleading
lengths do not bypass the cap. Reject before appending an over-budget chunk.
Require complete HTTP framing, fatal UTF-8 decoding and valid object JSON; Home/
resource collections also permit arrays and retain their previous wrapper forms.
Empty bodies, scalar JSON and malformed data refuse rather than appearing empty.

| Operation | Maximum body bytes |
| --- | ---: |
| PIN creation/lookup | 65,536 |
| Current user | 262,144 |
| Home users | 1,048,576 |
| Resources | 2,097,152 |

Non-success HTTP bodies are not parsed or reflected. Cancel them and return fixed
operation-specific failure codes, retaining the existing 401 mappings. Redirect,
deadline, size and transport failures use fixed approved diagnostics without URLs,
tokens, response text or underlying exception messages. No automatic retry occurs,
including PIN creation. Successful values are returned only after validation,
deadline checks and confirmed transport drainage. Uncertain retirement refuses
publication, seals admission and causes close to reject.

## Cancellation and shutdown

Internal caller cancellation and owner close compose with the deadline. A result
deadline can finish before actual drainage; the request slot remains occupied
until the deadline task's actual `drained` promise settles. Close is idempotent,
permanently closes admission, aborts captured requests and awaits all drains. The
application drain helper closes this shared transport after producer workers and
before the pool. OS DNS callbacks have no guaranteed application-controlled close
deadline; ownership remains held rather than replaced. A slow DNS resolver can
therefore delay full shutdown while bounded result/capacity policy still holds.

HTTP request bounds do not make a two-request callback one 15-second workflow,
change existing SQL/state expiry, or atomically publish owner-link credentials.
Direct sign-in retains browser-bound state and atomic session/audit consumption.
The callback native fixture proves timeout has no session/audit/cookie publication
and an explicit retry can succeed. Owner-link command publication is the next
separate boundary recorded in the [outcome](PLEX_HTTP_OUTCOME.md).
