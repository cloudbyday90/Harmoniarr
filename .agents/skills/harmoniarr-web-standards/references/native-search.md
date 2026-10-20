# Standards method for native search evidence

Use when replacing controlled search responses with an actual provider binary.
Read the [design](../../../../docs/NATIVE_SEARCH_DESIGN.md) and
[source/tradeoff stack](../../../../docs/NATIVE_SEARCH_RESEARCH_2026_10.md).

Resolve the released provider's linked library and tag through MCP metadata,
then read request, response, file and token implementations at that identity.
Do not infer a private protocol from a newer branch or fixture assumptions.
Soulseek.NET 10.0.2 starts at token zero and repeats the same listen port during
login. Accept those reviewed semantics while refusing token reuse and changed
endpoint authority. A token is correlation data, not authentication.

Apply OWASP input limits before scheduling: declare queries/peers/files, capture
the authenticated central connection's address and port, cap both plain and
compressed payloads, and bound delivery counts and socket lifetime. Independent
bounded test inflation checks the emitted format; native API observations prove
released-binary acceptance. Neither supplies a general provider decompression
security assessment.

Apply W3C provenance guidance by inference: retain source/runtime identity and
query/token/peer/payload correlation. Separate socket write, native response,
candidate ingestion, native transfer and inspected publication. Preserve the
actual HTTP status: native search returns 200, while transfer batch acceptance
returns 201. One search POST must not turn into repeated intent during polling.

Close admission and await socket/task retirement. A receiver seeing bytes is
earlier than sender close: shutdown may cancel that still-owned delivery. Test
these boundaries separately rather than waiting an arbitrary duration. Keep
fast controls and one explicit native scenario, with failed prototypes retained.
This proves isolated owned search, not public-network discovery, directory browse,
rendered commands, remote content authenticity or general standards conformance.
