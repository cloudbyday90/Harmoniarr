# Artwork connection-time destination enforcement outcome

Completed October 22, 2026 on `main`. See the separate
[design](ARTWORK_EGRESS_DESIGN.md), [official research and alternatives](ARTWORK_EGRESS_RESEARCH.md)
and [Docker outcome](LOCAL_DOCKER_ARTWORK_EGRESS_OUTCOME.md).

## Implementation

Artwork downloads now use a narrow ESM HTTPS transport that resolves both A and
AAAA before each hop. Any private, reserved, malformed or wrong-family answer
blocks the complete destination. At most 64 answers form an immutable snapshot;
only that snapshot supplies Node's connection fallback. Redirects and CAA retries
resolve again. Cancelled DNS cannot create a later request.

The ordinary-public-address policy and cancellable resolver were extracted from
Web Push into small shared network modules. Push adapters retain the existing
export names, fixed diagnostics, timeout and first-address selection. No general
HTTP client migration or new dependency was introduced.

Each artwork hop owns a fresh non-pooling HTTPS agent. The original hostname
continues to supply Host, SNI and default certificate verification. Only approved
image headers and the existing CAA User-Agent are forwarded. The adapter uses a
byte-sized Web Stream queue, observes stream failures, awaits response close on
cancellation and retires its agent. Existing URL admission, chain deadline,
manual CAA redirects, byte/raster/pixel limits and Sharp publication remain owned
by their existing modules. Errors retain no remote URL, proxy credential or native
exception cause.

This transport supports direct egress. Configured HTTP_PROXY, HTTPS_PROXY or
ALL_PROXY, in either case, causes `proxy_refused` before DNS or request admission,
including when NO_PROXY is present. This deliberately prevents silent proxy
bypass; proxy-dependent installations cannot fetch new artwork through this
transport. JSON clients retain their existing separate transports. Proxy support
requires a separately qualified destination-pin and routing design.

## Validation

| Check | Result |
| --- | --- |
| Focused image, DNS/address, CAA, provider and Push compatibility cohort | 111 passed |
| `npm run validate:fast` | 10,916 passed: server 5,749; client 4,470; scripts 697 |
| Isolated Linux cohort using the exact rebuilt image | 52 passed: 28 provider HTTPS checks and 24 Push policy/resolver/transport checks |
| Client build comparison | All 155 artifacts unchanged |
| Actual packaged ESM probe | Address policy, immutable DNS snapshot, Push adapter, default proxy refusal, pinned lookup and streamed body passed |
| Both project skill validators and changed-document links | Passed |

Native HTTPS controls cover approved-address fallback, mixed public/private DNS
refusal, hostile proxy non-contact, DNS changes between CAA redirects and retries,
mismatched TLS identity and absent fixture trust. The existing three image
journeys still perform actual PNG inspection, Sharp rewrite and temporary-file
publication. Failed sockets close before a healthy request is released while the
child remains alive. Proxy/tunnel contact is zero in direct artwork scenarios.

Controlled test-only adapters inspect production lookup, agent and TLS options
before mapping approved synthetic destinations to owned loopback TLS listeners.
Host/SNI and default verification remain intact; trust is child-scoped. This proves
native TLS, streams, fallback and refusal under controlled routing. It does not
establish live public DNS, native IPv6 reachability, live provider acceptance or
PostgreSQL assignment durability. Other provider transports and operating-system
routing remain separate trust boundaries.

Initial fallback assertions missed Node's first connection-attempt event because
it can precede the request's socket listener. The corrected fixture reads the
socket's completed attempted-address list and proves both failed and successful
attempts. Failed logs are retained; the event-observation correction is not a
production fallback fix. Earlier lifecycle review also added pre-aborted-response
and close-before-headers refusal before the final passing source was frozen.

Fifteen changed/new code and fixture files were frozen for validation and Docker
packaging. The fingerprint covers 3,293 source files:
`0e799d66ecfb1500576de5e3a667e6d76e69daf3a43a497161a7cd08eac95590`.
Private logs, inventories and cleanup evidence remain under ignored
`.tmp/artwork-egress-2026-10-22/`. The testing and web-standards skills now document
the snapshot, proxy, fallback and evidence boundaries. GitHub MCP found no open
PRs at selection and completion; random implementation and stale-PR cleanup were
inapplicable. No SQL, client UI, dependency, release-version or tag changes were
needed. Unrelated database/browser matrices were not repeated.

## Recommendation and next item

Retain provider URL admission → cancellable A/AAAA resolution → conservative
public-address snapshot → owned direct HTTPS/default TLS → bounded image bytes →
Sharp rewrite → existing storage/assignment. Benefits are explicit destination
ownership and shared reviewed policy. Costs are DNS/connection setup per hop,
policy maintenance, stricter special-purpose address compatibility and direct-only
routing. The [research](ARTWORK_EGRESS_RESEARCH.md) compares alternatives.

**Next: bound aggregate artwork concurrency and in-flight work.**
`resolveArtworkBatch` currently admits its batch with `Promise.all`. Per-image byte
and pixel limits do not cap aggregate buffers, native allocations or CPU. Add an
owned admission budget across download, decode and publication, qualify queued
cancellation and permit release after actual completion, and measure the real
consumer before selecting defaults. Keep process-memory and performance claims
separate from queue/backpressure thresholds.
