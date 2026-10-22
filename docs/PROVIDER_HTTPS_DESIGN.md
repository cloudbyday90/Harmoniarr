# Provider HTTPS qualification design

## Decision

Qualify the shared Spotify, YouTube and Apple Music JSON request boundary with
Node 24.22.1's actual bundled fetch. Keep the existing origin allowlist, default
TLS verifier, redirect refusal, response limits and sanitized error projection.
Do not replace transport policy merely to make it injectable in tests.

The native admission probe exposed a concrete gap: malformed URLs escaped as
Node parser errors with an `input` field. Normalize that failure to the existing
`request_rejected` projection before dispatch, retaining no raw input or cause.
This establishes diagnostic containment, not an externally exploitable endpoint.

## Owned fixture

A test-owned HTTP CONNECT proxy listens on an ephemeral IPv4 loopback port. It
accepts only explicit fixture authorities and opens sockets only to the owned
loopback HTTPS server. It never resolves or connects to the supplied authority.
A fresh child enables Node's documented environment proxy and loads a public
test CA at startup. Production provider URLs, Host, SNI and certificate identity
remain intact. The parent process and application deployment never trust this CA.

Separate certificates prove matched DNS/IP identity, mismatched DNS/IP identity
and untrusted-chain refusal. IP fetches are runtime controls; the production
provider origin allowlist must continue to reject IP URLs before dispatch.

Exercise real client credentials/token handling using synthetic credentials,
normal gzip/Brotli decoding, compressed decoded-byte overflow, malformed bodies,
redirect refusal and bounded HTTP error diagnostics. Observe actual server
requests and connection retirement rather than relying only on fetch options.
Await child process/stdio close before retiring fixture sockets and listeners.
Keep output bounded, and never print credentials, response bodies or full URLs.

## Alternatives and tradeoffs

| Option | Benefits | Costs / decision |
| --- | --- | --- |
| Child-scoped native proxy and CA | Executes bundled fetch and real provider clients; no package addition or process-global trust changes | Small proxy/process fixture; qualifies the proxied path, not live DNS or provider infrastructure. Recommended |
| Synthetic Response injection | Very fast and useful for policy branches | Cannot prove TLS, redirects, decompression or socket behavior. Retain alongside native proof |
| Add an external Undici dispatcher | Detailed per-request routing control | Adds a dependency/version surface and can differ from bundled transport. Defer |
| Disable certificate verification or expand provider origins for tests | Convenient routing | Weakens the contract being tested. Reject |
| Live provider tests | Vendor compatibility evidence | Accounts, rate limits and nondeterminism; inappropriate for routine local gates. Separate opt-in work |

## Recommended stack and validation

Retain Node 24.22.1/npm 12.0.2, modular ESM factories, built-in fetch, strict TLS,
fixed provider origins and bounded decoded JSON. Add small native loopback tests
to the server lane so they need neither Docker nor PostgreSQL. Run owning policy
and client tests first; run the stable fast gate once after source review.
Record the preserved no-cache Docker rebuild separately from native HTTPS proof.
No schema, UI, release, branch or dependency-resolution change is required.

Research and limitations belong in [the research document](PROVIDER_HTTPS_RESEARCH_2026_10.md);
executed results belong in [the outcome](PROVIDER_HTTPS_OUTCOME.md).
