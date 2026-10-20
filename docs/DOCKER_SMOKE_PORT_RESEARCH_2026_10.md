# Docker smoke port recommendations

Consulted 2026-10-19 through MCP search and official navigation. Apply Docker
contracts to the observed Compose 5.6.0 installation, not a guessed version.

| Official source and status | Applicable practice |
| --- | --- |
| [Compose service ports](https://docs.docker.com/reference/compose-file/services/), product documentation | Let the engine allocate a host port and set the host address explicitly. |
| [Compose merge rules](https://docs.docker.com/reference/compose-file/merge/), product documentation | !override replaces ports rather than appending another exposed mapping; requires 2.24.4+. |
| [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/), product documentation | Loopback binding limits host exposure under normal bridge networking; older engines and custom routing have additional caveats. |
| [Docker inspection](https://docs.docker.com/reference/cli/docker/inspect), product documentation | Read structured NetworkSettings.Ports for actual external addresses and ports. |
| [OWASP Docker security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html), informative guidance | Explicit loopback publication reduces accidental external access during local validation. It does not remove Docker-daemon authority. |
| [W3C Secure Contexts](https://www.w3.org/TR/secure-contexts/), November 10, 2023 Candidate Recommendation Draft | Loopback can be potentially trustworthy for browser capabilities. This is distinct from TLS, authentication or network isolation; verify actual enabled-worker browser behavior separately. The draft is not a certification claim. |

## Alternatives

| Option | Pros | Cons |
| --- | --- | --- |
| Docker allocation, smoke-only override and inspected endpoint | Removes host reservation gap, limits exposure, supports independent phase mappings | Requires supported Compose merge semantics and explicit endpoint resolution |
| Host probe then publish | Simple original flow | Releasing the socket cannot reserve it for a different allocator; observed bind failure remains possible |
| Fixed port or retries | Convenient local workaround | Conflicts across runs; retries obscure original failure and do not establish ownership |
| Rewrite canonical deployment ports | Fewer Compose files | Changes unrelated deployment behavior and introduces unnecessary configuration surface |

Recommend the existing Node 24 ESM/npm 12, static Vue/Router, Express and
PostgreSQL 18 stack with a small endpoint module and smoke-only Compose overlay.
Preserve image pins, non-root/read-only execution, native cleanup verification,
security defaults and serial resource bounds. Local timing is descriptive, not
a whole-CI speed claim. Keep TypeScript 6 until actual language-service consumers
support the selected TypeScript 7 package. See the
[current PR review](OPEN_PR_48_DOCKER_PORT_EVALUATION.md).
