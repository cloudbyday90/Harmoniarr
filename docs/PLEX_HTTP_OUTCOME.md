# Owned Plex HTTP implementation outcome

October 27, 2026. Plex HTTP now has bounded request admission, elapsed result
deadlines, header/body validation and actual native/DNS retirement ownership.
The existing application shares one client across direct sign-in, owner linking
and directory preview. No dependency, schema artifact, public route or additional
deployed service was added. All modules use ESM factories. See
[official research/tradeoffs](PLEX_HTTP_RESEARCH_2026_10.md) and the separate
[implementation design](PLEX_HTTP_DESIGN.md).

## Delivered behavior

The thin client preserves five endpoint operations and collection wrapper forms.
It no longer uses unbounded response.text() or default fetch redirects. One
application owner admits at most four requests with no application queue. Each
request has a 15-second monotonic result deadline through DNS, connection/TLS,
headers, streamed body, JSON validation and cleanup. Deadlines cannot publish a
late result. Other calls receive a fixed busy refusal while slots remain held.

Transport uses only the two fixed Plex HTTPS origins, public-address OS DNS
answers, an isolated non-keepalive agent, explicit TLS servername/verification,
identity encoding and a 16 KiB header cap. Redirects, compression and unexpected
authorities refuse. PIN requests discard an extra supplied token; authenticated
operations send it only as the Plex token header. Identifiers/tokens are bounded
printable primitives and PIN IDs remain a safe path segment.

Successful body limits are 64 KiB for PIN creation/lookup, 256 KiB for current user,
1 MiB for Home users and 2 MiB for resources. Content-Length is an early check;
streamed bytes are counted independently. Full framing, valid fatal UTF-8, JSON
content type and expected root shape are required. Refused/non-success bodies
are destroyed rather than parsed/reflected. Fixed operation-specific diagnostics
preserve existing 401 mappings without exposing response text or native errors.
There is no automatic retry, including PIN creation.

Native request, response and socket closes plus every issued DNS callback remain
owned through actual drainage. A timed-out caller cannot release admission while
native/DNS work remains. Uncertain drainage refuses even a valid body, seals
future admission and makes close reject. App shutdown closes HTTP ingress and
drains producer workers, then closes/cancels the shared Plex owner before pool
retirement. Close is permanent and idempotent for that owner.

## Frozen source and validation

Source fingerprint: **3,765 files**, SHA-256
`22c919cf0784a3af8a8f6fc87ddfb1e2086d8804ab34c0bad4794752cab5b295`.
Sixteen production/test/fixture files were frozen before final validation. Only
documentation followed. Eight intended production paths comprise the image change.

The focused command passed **30 tests**:

```text
node --test test/server/plex-http.test.js test/server/plex-direct-sign-in-service.test.js test/server/plex-owner-link-service.test.js test/server/plex-directory-import-service.test.js test/server/startup-runtime.test.js test/server/app.test.js
```

The complete fourteen-stage fast gate passed with server concurrency eight:
**6,313 server + 4,504 client + 703 script = 11,520 tests**, zero failures,
cancellations or skips. Pinned local Node 24.22.1/npm 12.0.2 were used.

```text
npm run check:node-baseline
npm run check-copyright
npm run migration:check
npm run check:schema-snapshot
npm run check:schema-anchor-contract
npm run check:esm
npm run check:image-tags
npm run check:compose-topology
npm run lint
npm run check:test-hygiene
node --test --test-concurrency=8 test/server/**/*.test.js
node --test test/client/**/*.test.js
node --test test/scripts/**/*.test.js test/compose-image-tag-policy.test.js
npm run build
```

`npm audit` reported zero vulnerabilities. CRLF-aware whitespace checks passed.
The final implementation uses the existing first-error-preserving cleanup helper;
an unsafe-finally lint finding during development was corrected before the final
gate. A unit fixture's derived close promise initially lacked rejection handling;
that test was corrected. Public fixture certificate generation used an explicit
local OpenSSL configuration after the image lacked the CLI and the host's default
configuration path was stale. No production package, TLS verification or deadline
was changed to make a fixture pass.

## Packaged and browser qualification

The immutable-image native HTTPS entry passed **19 scenarios**, covering all five
endpoints, exact body limit, declared/chunked/header overflow, compressed response,
invalid UTF-8/JSON, truncation, redirect trap, private error diagnostics, header/
body stalls, untrusted/wrong-name TLS, private DNS refusal, delayed DNS drainage
and a mounted callback timeout followed by explicit retry. It observed **27 native
requests, 27 request closes and 27 socket closes**, with 23 verified TLS handshakes
and zero redirect-trap calls. The callback timeout published no new refresh row,
success audit or auth cookie; retry completed normally.

Callback-state, retention and linked-login entries passed **19/14/23** scenarios:
**75 scenario executions** across four fresh immutable-image entries. Each used
3 GiB, exited zero, and was removed with absence verified. No final application
binary overlay was used. Native TLS trust was scoped to a public fixture
certificate; no global CA or TLS-verification bypass was installed.

The secure-cookie browser fixture was adapted to the changed internal transport
interface and passed against the same image: cross-site Lax return, original-
browser success, other-browser refusal, independent tabs and replay with no
session-cookie replacement. Its isolated loopback proxy's browser chain exception
is distinct from the native TLS verification above. Owned app/network/context
cleanup passed. Existing-admin live login and automatic schema diagnostics also
passed; the [Docker outcome](LOCAL_DOCKER_PLEX_HTTP_OUTCOME.md) owns that evidence.

## Recommendation and limits

Use the implemented stack: shared admission and deadline owner, fixed verified
native HTTPS, streamed operation budgets and strict JSON, fixed private errors,
then actual native/DNS drainage and shutdown. This prevents the tested oversized,
redirect, malformed, timeout and premature-release outcomes. Its cost is additional
TLS connections and refusal of compressed, redirected, proxied or oversized
provider responses. Empty bodies no longer silently become empty objects.

OS DNS is not application-cancellable to a guaranteed completion time. Its pending
callback retains capacity and can delay complete shutdown or other OS resolver
work. Four slots apply to the one shared application owner, not every separately
constructed client in a process. Byte caps are not a total RSS or CPU guarantee.
Sequential calls have separate deadlines, not one whole-workflow deadline.

Native fixture trust and hostname verification do not establish live Plex or
public DNS acceptance, certificate pinning, proxy compatibility or arbitrary
administrator trust-store safety. No new memory minimum, throughput benchmark or
manual screen-reader/device acceptance is claimed. Existing browser/state/SQL
authorization remains required; transport limits do not make owner-link token
publication atomic. [Docker outcome](LOCAL_DOCKER_PLEX_HTTP_OUTCOME.md) owns
packaged evidence, deployment parity, retained checks and cleanup.

GitHub MCP checks returned no open PRs, including Dependabot PRs. There was no
random PR to apply locally or stale Dependabot PR to rebase/close. None was merged.
Work remains on main with no release, tag or separate branch.

The owner-link follow-up is now implemented with browser/current-session binding,
atomic publication and clear/relink revision fencing. See the
[owner-link outcome](PLEX_OWNER_LINK_OUTCOME.md). Its next recommendation evaluates
the remaining Spotify/YouTube linking boundaries separately.
