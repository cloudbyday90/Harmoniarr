# Native search sources and recommendation stack

Consulted through GitHub and web-search MCP on October 20, 2026. Repository
metadata supplied content/ref URL templates; tag refs were resolved before
reading released source. Official implementation describes this private protocol;
it is not a W3C or IETF standard. Project fixture code is independently written.

| Source and status | Application |
| --- | --- |
| [Released slskd project](https://api.github.com/repos/slskd/slskd/contents/src/slskd/slskd.csproj?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable implementation | Verify linked Soulseek.NET 10.0.2 instead of assuming default-branch compatibility. |
| [Released search controller](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Search/API/Controllers/SearchesController.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable implementation | Search start returns HTTP 200; it is separate from transfer batch HTTP 201. |
| [Released search service](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Search/SearchService.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable implementation | Response bodies persist during finalization. Let real ingestion poll actual state/body publication; count updates alone are earlier evidence. |
| [Startup statistics response](https://api.github.com/repos/jpdillingham/Soulseek.NET/contents/src/Messaging/Messages/Server/UserStatisticsResponseFactory.cs?ref=94fba7d4056796af067e6d7b2a8628099723cd26), immutable implementation | Answer only the owned client's zero-share statistics, avoiding an unrelated artificial post-login timeout. |
| [Search request](https://api.github.com/repos/jpdillingham/Soulseek.NET/contents/src/Messaging/Messages/Server/SearchRequest.cs?ref=94fba7d4056796af067e6d7b2a8628099723cd26), immutable implementation | Bind the actual global query to its emitted token. |
| [Released token factory](https://api.github.com/repos/jpdillingham/Soulseek.NET/contents/src/Common/TokenFactory.cs?ref=94fba7d4056796af067e6d7b2a8628099723cd26), immutable implementation | Zero is the initial valid token; preserve exact nonnegative identity and refuse reuse rather than assuming tokens must be positive. |
| [Search response factory](https://api.github.com/repos/jpdillingham/Soulseek.NET/contents/src/Messaging/Messages/Peer/SearchResponseFactory.cs?ref=94fba7d4056796af067e6d7b2a8628099723cd26), immutable implementation | Emit zlib-compressed peer payload, declared file records, queue/slot fields and locked-file count. Native API acceptance owns decoding evidence. |
| [File serializer](https://api.github.com/repos/jpdillingham/Soulseek.NET/contents/src/Messaging/MessageBuilderExtensions.cs?ref=94fba7d4056796af067e6d7b2a8628099723cd26), immutable implementation | Preserve byte code, filename, 64-bit size, extension and typed attributes. |
| [Node 24 zlib options](https://nodejs.org/download/release/v24.20.0/docs/api/zlib.html), vendor reference | Bound emitted bytes and use maxOutputLength/rejectGarbageAfterEnd for independent test inflation on canonical Node 24.22.0. This does not add third-party provider decompression guards. |
| [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html), informative guidance | Apply allowlisted queries/identities, endpoint authority and numeric/byte limits before scheduling work. |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), Recommendation | By inference, retain source/version and query/token/native-response provenance separately from transport writes and publication. |

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep controlled HTTP responses | Fast, deterministic client/ingestion coverage | Omits native query and decompression | Retain historical evidence |
| Narrow native central/peer search fixture | Exercises released binary with owned inputs and no public account | Protocol maintenance and socket lifecycle work | Implement |
| Broad protocol emulator | Could support many scenarios | Unneeded parsing/identity surface and substantial maintenance | Defer |
| Public-network account/peers | Observes real remote behavior | Credentials, nondeterminism and external side effects | Separate operator activity |

Recommendation stack: exact released-source identity; bounded ESM query/response
codec; authenticated endpoint and token ownership; awaited socket lifetime;
actual native API observations; existing canonical ingestion/acquisition workers;
valid/corrupt media qualification; fast controls plus one explicit native lane.
Preserve process isolation and actual completion. Do not infer suite speedup from
one selected duration or standards conformance from a transport test.
