# Native provider fixture recommendations

Consulted 2026-10-20 through GitHub and web-search MCP. Released slskd 0.26.0
uses Soulseek.NET 10.0.2; the reviewed library tag resolves to
94fba7d4056796af067e6d7b2a8628099723cd26. Private source checkouts match the
MCP-discovered tag identities. Fixture code is independently implemented ESM.

| Official source and status | Application |
| --- | --- |
| [Released download service](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Transfers/Downloads/DownloadService.cs?ref=e42a525d700d6dc343f316447803138b8ea2fbe3), immutable implementation | Native batch creation primes a peer connection and persists transfer rows; remote queue acknowledgement is earlier than transfer completion. |
| [Released Soulseek client](https://api.github.com/repos/jpdillingham/Soulseek.NET/contents/src/SoulseekClient.cs?ref=94fba7d4056796af067e6d7b2a8628099723cd26), immutable implementation | Review login/address and peer request/queue behavior against the actual linked version, rather than an unrelated protocol guide. |
| [Node 24 TCP API](https://nodejs.org/download/release/v24.20.0/docs/api/net.html), vendor API reference | server.close closes admission; owned sockets require their own close/drain. The documented API is exercised on canonical Node 24.22.0. |
| [Docker internal networks](https://docs.docker.com/reference/compose-file/networks/), product documentation | Put both services on one externally isolated network and inspect the actual attachment. Run the API driver inside it; publish no ports. |
| [OWASP segmentation](https://cheatsheetseries.owasp.org/cheatsheets/Network_Segmentation_Cheat_Sheet.html), informative guidance | Constrain communication to the fixture; isolation does not replace input/authentication checks. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), HTTP specification | A missing POST result does not authorize a new request. Recover exact owned evidence using reads. |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), Recommendation | Preserve version/provenance in evidence. Applying dataset guidance to a private test artifact is our design inference, not transport certification. |
| [Node security announcement](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases?trk=public_post_comment-text), vendor announcement | Rechecked October 20: the announced October 21 patch remains future work; qualify the actual published release rather than inventing a version. |

## Alternatives and recommendation

| Option | Pros | Cons |
| --- | --- | --- |
| Real provider with a narrow owned central/peer fixture | Exercises native API serialization and persistent receipt identity; deterministic inputs; no public account | Requires maintaining the reviewed binary protocol subset and Docker ownership |
| Mock the provider HTTP API | Fast, useful for database authority and fault scenarios | Cannot qualify real provider serialization or batch creation |
| Seed provider database rows | Could exercise native GET serialization | Bypasses admission and risks coupling to private storage |
| Use a live public peer | Broad transfer realism | External credentials, nondeterminism and public side effects make routine validation unsuitable |

Retain Node 24 ESM/npm 12, Express, Vue, PostgreSQL 18 and pinned slskd 0.26.0.
Add this opt-in native lane alongside fast pure tests and the existing PostgreSQL/
HTTP authority tests. Keep protocol, socket lifetime, Docker setup and scenario
assertions in separate files. A queued receipt is not downloaded media or an
import result. Qualify 0.26.1 only after the stable fixture passes.
