# Push endpoint registration and outbound destination security

Design reviewed September 12, 2026, against baseline `9470ceb`.

Harmoniarr currently accepts any nonempty subscription endpoint and key strings. Its native push transport requires HTTPS and validates certificates, but does not restrict destination addresses. A stored user-supplied hostname can therefore resolve to a local or otherwise unsuitable destination when a notification is sent. Registration-token fencing protects cleanup races; it does not authorize the network destination.

## Accepted URL and key boundary

Add a pure, shared `parsePushEndpoint(endpoint)` policy returning a parsed URL or a fixed safe error. Accept HTTPS on the standard port 443 only, with a DNS hostname rather than an IP literal. Enforce a 4096-byte endpoint bound and reject raw whitespace, control characters, backslashes, fragments, and URL credentials. Reject single-label, trailing-dot, and reserved local hostnames. Validate the parsed hostname as well as the input so alternative numeric IPv4 representations cannot bypass literal rejection.

Keep the accepted original endpoint string in storage. A push endpoint is an opaque capability: do not reconstruct, decode, reorder, strip, or otherwise normalize its path and query before persisting it. Standard URL parsing can be used for the network connection without rewriting the stored registration identity. Return fixed client errors without echoing the endpoint or keys. The limit and HTTPS443/hostname restrictions are Harmoniarr product constraints, not universal requirements imposed on every W3C-compatible push service.

Require canonical unpadded base64url keys. `p256dh` must decode to a 65-byte uncompressed P-256 point beginning with byte `0x04`; validate the point through native `ECDH.convertKey` rather than accepting length alone. `auth` must decode to exactly 16 bytes. Reject alternate alphabets, padding, whitespace, invalid trailing bits, and invalid points before storing or sending them. Preserve safe subscription removal for existing registrations; deletion does not need to authorize an outbound connection. [RFC 8291](https://www.rfc-editor.org/info/rfc8291/) specifies the authentication-secret length and the user-agent public-key representation; the [W3C Push API](https://www.w3.org/TR/push-api/) defines subscription keys and unpadded URL-safe browser serialization. [Node 24 cryptography](https://nodejs.org/download/release/v24.18.0/docs/api/crypto.html) supplies the elliptic-curve conversion boundary.

Run the shared policy at the registration service boundary and again before sending persisted subscriptions. Older rows must not bypass the transport policy merely because they predate stricter registration checks. Do not add network access to registration validation: current destination validation belongs immediately before the connection that will use it. Browser permission and application notification preferences remain separate existing controls.

## DNS validation and pinned connection

Create a separate `node:dns/promises.Resolver` for each send and query A and AAAA records in parallel through `resolve4` and `resolve6`. Treat `ENODATA` or `ENOTFOUND` for one family as an empty result for that family; other resolver errors fail the attempt. Require at least one returned address and no more than 64 raw combined entries before deduplication, with well-formed address strings and consistent family values. The 64-entry ceiling is a bounded product policy. Fail the entire attempt if any returned address is disallowed, rather than discarding the unsafe answer and choosing a convenient safe one.

Select one validated address from the accepted result and supply it through the native HTTPS request's custom lookup function. Do not perform another system lookup, retry another address, or fall back to the original resolver for that attempt. Handle the callback shape expected by Node, including requests for an address array. Retain the original DNS hostname for the HTTP Host header, TLS SNI, and certificate identity verification. Keep `rejectUnauthorized: true`, no caller-supplied TLS or proxy override, no reused agent, and no redirects. Node documents [custom HTTP lookup](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html), [DNS queries and resolver cancellation](https://nodejs.org/download/release/latest-v24.x/docs/api/dns.html), and [TLS hostname verification](https://github.com/nodejs/node/blob/main/doc/api/tls.md).

The resolver and native connection remain within the existing absolute 15-second delivery deadline. The transport owns an internal abort signal and calls the per-send resolver's `cancel()` on abort so outstanding DNS promises reject. A timeout must prevent late resolver results from starting a socket; destroying an active request remains effective during connect, TLS, headers, and response-body work. No caller-facing cancellation API or new deadline is required. Preserve bounded response parsing and fixed diagnostics without raw endpoint, address, key, authorization header, or provider-body output.

This binding prevents the application from validating one DNS answer and independently connecting using a later changed answer. Explicit DNS queries bypass hosts-file and other operating-system name-service overrides; this is a deliberate compatibility boundary. They do not authenticate a particular push provider, prove authoritative DNS data, or override deployment routing. Configured DNS servers, trusted certificate authorities, and the network remain trust boundaries. [OWASP's SSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) supports validating IPv4 and IPv6 destinations, accounting for DNS changes, and disabling redirects; network egress restrictions can provide an additional deployment boundary.

## Conservative address policy

Use one explicit, tested address classifier for this transport. Do not reuse the existing integration URL policy unchanged: it supports intentionally private integrations and does not bind DNS validation to the connection. Do not import an undeclared transitive dependency for the new security boundary.

For IPv4, reject all special-purpose ranges in the current IANA registry, plus multicast and reserved address space. This includes loopback, unspecified, private, shared carrier-grade NAT, link-local, documentation, benchmarking, and special-purpose anycast blocks. For IPv6, accept only the currently allocated global-unicast space `2000::/3`, excluding special-purpose ranges within it. The excluded ranges include `2001::/23`, `2001:db8::/32`, `2002::/16`, `2620:4f:8000::/48`, and `3fff::/20`. This rejects mapped and compatible IPv4 forms, known translation prefixes, and scoped addresses. Also reject recognized ISATAP interface identifiers, with low 64 bits beginning `0000:5efe` or `0200:5efe`, including equivalent compressed or dotted-tail notation. [RFC 5214](https://www.rfc-editor.org/info/rfc5214/) describes this embedded-IPv4 layout. Use native binary address membership and canonical parsing rather than relying on raw textual prefixes.

The [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry) and [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry) distinguish purpose from global reachability. Some special-purpose entries are globally reachable; rejecting all of them is intentionally more conservative than rejecting only entries marked unreachable. The [IANA IPv6 address-space registry](https://www.iana.org/assignments/ipv6-address-space) currently limits ordinary unicast assignments to `2000::/3`. Keep source references next to the maintained policy and test its boundary addresses. This is an application destination policy, not a claim that accepted addresses are currently routed or that IANA data never changes.

The selected policy excludes private push services, IP-literal endpoints, alternate ports, known DNS64/NAT64 prefixes, recognized transition forms, and globally reachable special-purpose services. It cannot identify an arbitrary deployment-configured translation prefix inside accepted global address space; routing and network egress remain deployment trust boundaries. Public browser-provider hostnames continue to work when their returned addresses meet this policy. No fixed provider-host allowlist is introduced in this slice; such a list would require maintained provider coverage and a separate compatibility decision.

## Alternatives and recommendation

| Approach | Benefits | Costs and limitations |
| --- | --- | --- |
| HTTPS with normal DNS only | Broad compatibility and simple transport. | TLS alone does not constrain where the connection is attempted; reject. |
| Validate DNS at registration | Earlier detection of unsuitable answers. | Adds network work to registration and cannot protect a later changed answer; insufficient alone. |
| Validate all connection-time answers and pin one | Covers persisted rows, avoids a second resolution, preserves normal TLS identity, and bounds address processing. | Intentionally rejects mixed answers and cannot fail over to another address in the same attempt; selected. |
| Fixed provider hostname allowlist | Smaller destination trust set. | Requires current provider coverage and excludes custom public services; defer rather than inventing provider URLs. |
| Network egress proxy or firewall | Independent control over reachable networks. | Deployment-specific configuration and operation; useful additional protection, not a substitute for the application policy. |

Recommended stack: modular ESM endpoint/key validation, a small native IP classifier with explicit registry policy, a bounded injectable resolver, and the existing deadline-controlled native HTTPS transport using a pinned lookup callback. Reuse existing subscription storage, registration-token cleanup, recipient-policy checks, and queue claim fencing. No migration, UI, new queue, or external service is required.

## Verification and outcome limits

Cover valid browser key fixtures, invalid P-256 points, exact key lengths, alternate base64 spellings, endpoint byte limits, encoded/numeric IP literals, local names, credentials, raw separators, nonstandard ports, and unchanged stored capability strings. Test all address-range boundaries, IPv4-mapped IPv6, mixed public/private answers, inconsistent families, empty/oversized results, resolver throws/rejections, and no fallback lookup.

Prove with controlled transport tests that the connection receives only the pinned answer while retaining the original hostname for TLS. Exercise a changed second DNS answer that must never be consulted, deadline expiry before resolver completion, and late callbacks that cannot open a connection. Keep real HTTPS certificate-verification, encrypted payload, timeout, response-limit, subscription-invalidation, and queue-fencing tests passing. Test-only resolver/request injection must not become a production environment bypass.

Existing registrations rejected by the new policy must produce safe delivery failure without a network attempt or an inferred provider-expiration response. This slice does not prove live push-provider acceptance, delivery to a browser, or exactly-once notification delivery. Record implemented behavior and executed validation separately in the outcome document.

## Open pull requests

GitHub MCP search and complete file patches were refreshed September 12, 2026. No open PR addresses this boundary, and no PR was applied, merged, or remotely modified.

| PR and immutable head | Patch disposition |
| --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40), `649659f1e199d48d55cc8d5cccf9f079dc235d86` | One controlled-provider fixture image change, Node 24.19.0 to 26.7.0; unrelated major-runtime upgrade. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24), `40cf4d117b69bd55b9a0a7353361838216e1e952` | One build-push-action change to 7.2.0; superseded by local 7.3.0 pin `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a`. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23), `ae651337286216e92be7ae977e39fcedc14de7f9` | One metadata-action change to 6.1.0; superseded by local 6.2.0 pin `dc802804100637a589fabce1cb79ff13a1411302`. |

Sources were discovered through search or MCP and opened for review. No real subscription endpoint, private key, credentials, or live provider probe was used.
