# Node 24 security patch research, October 2026

Consulted October 21, 2026 through MCP search and official navigation. The
published patch and image were verified rather than inferred from the earlier
security announcement. Opening release result references resolved successfully;
the registry supplies the actual image index/manifests.

| Official source | Status / applicable practice | Project decision |
| --- | --- | --- |
| [Node 24.22.1 release](https://nodejs.org/en/blog/release/v24.22.1/) | Vendor release and checksums, published October 21; security fixes and bundled dependency updates | Stay on Node 24, raise the canonical patch and package floor; retain npm 12.0.2 |
| [October security advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) | Vendor disclosure covering TLS identity, DNS NUL input, Brotli and other affected core surfaces | Preserve strict TLS; qualify applicable native consumers rather than claiming all CVEs reproduced |
| [Official Docker Node repository](https://github.com/nodejs/docker-node) | Vendor image/build guidance; Alpine uses musl, with architecture-specific support limits | Preserve Alpine 3.23 family; execute Linux amd64; arm64 metadata is not execution proof |
| [Docker build best practices](https://docs.docker.com/build/building/best-practices/) | Vendor guidance on trusted bases and digest pinning | Inspect the new registry digest, pin it, rebuild without cache and inspect actual runtime identity |
| [RFC 9525](https://www.rfc-editor.org/rfc/rfc9525.html) | IETF standards-track service-identity specification; DNS-ID and IP-ID matching have distinct rules | Keep the native verifier and DNS/IP mismatch controls; no blanket certificate bypass |
| [W3C PROV-O](https://www.w3.org/TR/prov-o/) | W3C Recommendation for provenance/derivation | By architectural inference, bind source/lock, tested artifacts and image identity in retained evidence; no RDF export or PROV conformance claim |

The checked Windows executable's SHA-256 is
`d702daa815eabbff763c7d3808e235cf031cf2ca70211b56847bc72f51e240e5`, matching
the release's `win-x64/node.exe` entry. This is checksum verification against
officially retrieved release material, not an independent release-signature audit.

Registry inspection found `node:24.22.1-alpine3.23` index digest
`sha256:4b00b6d1aa138805aace94cc2482808f2b4f01e5e9c9f8cdc0e217fd70600ef9`.
The index includes real architecture manifests and separate attestations; only
Linux amd64 is executed here. The runtime Alpine pin remains unchanged.

Installed host component metadata changes include OpenSSL 3.5.9 and bundled
Undici 7.30.1. Repository npm package resolutions remain unchanged. A release
component version is not a stand-alone proof of application-level exploitability.

The controlled DNS comparator observes dispatch/timeout on 24.22.0 and input
refusal on 24.22.1. The selected TLS alias comparator rejects its tested aliases
on both versions; it does not reproduce the disclosed TLS bypass. Actual native
PostgreSQL TLS controls and normal HTTP/Brotli handling own separate compatibility
claims. W3C interaction semantics remain unchanged; built UI checks are regression
evidence, not screen-reader or full accessibility acceptance.

See [tradeoffs and final stack](NODE_24_SECURITY_PATCH_DESIGN.md).
