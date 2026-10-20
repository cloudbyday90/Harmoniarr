# Native search through canonical acquisition

October 20, 2026. Replace the audio lane's controlled HTTP search responses with
actual slskd search requests and compressed native peer responses. Preserve its
real canonical intent, reconciliation, ingestion, manual choice, transfer,
inspection and publication checks. Keep this bounded scenario opt-in.

Review the implementation linked by the released immutable provider: slskd
0.26.1 uses Soulseek.NET 10.0.2. Independently implement only the needed ESM wire
subset. The central fixture accepts an authenticated listen-port announcement
and two exact declared global queries with distinct nonnegative tokens, including
the released client's initial zero token. Responses
connect only to that same central connection's remote address and announced
port. Unknown queries, duplicate query/token, missing endpoint and unsupported
identities refuse before outbound admission.

A narrow codec emits one declared WAV descriptor per peer, with fixed metadata,
bounded uncompressed and zlib-compressed lengths. Two owned peer identities keep
the existing manual-review scenario. Each delivery owns its socket through close;
shutdown closes admission, aborts sockets and drains admitted work. Fixture stats
retain query/token/peer and payload length/hash provenance. Socket write completion
is distinct from native API acceptance.

The API bridge uses the actual client/service inside the private network. Return
the native start result immediately and let the host's actual ingestion polling
observe native state/responses. Do not pre-complete the provider search. Record one search POST per query;
subsequent observations are reads. Do not seed provider storage or return a fake
search result. Keep file transfer and valid/corrupt publication unchanged.

Fast controls cover framing, independent bounded inflation, token/query/endpoint
refusal and real socket retirement. The full native case proves released binary
decompression, actual API files/metadata and downstream publication. An internally
isolated owned peer is not public-network discovery, general decompression attack
coverage or remote-source authentication. See the
[research and alternatives](NATIVE_SEARCH_RESEARCH_2026_10.md); record executed
results in a separate outcome. No release or new branch is required.
