# Recovery CLI delivery: official research, October 2026

Consulted October 21, 2026 through the connected MCP search service. URLs were
identified by search and official navigation, then opened. Node's unversioned
documentation currently displays v26.12.1; following its 24.x LTS link displays
v24.22.1. This checkout and Docker baseline run v24.22.0/npm 12.0.2. The selected
APIs predate those patches and are qualified on the installed runtime; this round
does not claim that the pinned runtime is the newest patch or upgrade it.

| Official source and status | Applicable practice | Project owner / evidence |
| --- | --- | --- |
| [Node 24.x process documentation](https://nodejs.org/docs/latest-v24.x/api/process.html), vendor API contract | Immediate exit can abandon asynchronous stdout/stderr writes. Use exit status and natural event-loop completion. Pipe synchrony varies by platform. | CLI writer and entrypoint; actual child stdio/exit checks on the installed runtime plus packaged Linux proof |
| [Node 24.20 stream documentation](https://nodejs.org/download/release/v24.20.0/docs/api/stream.html), versioned vendor API contract | `write` callback observes handling/failure of that chunk; false return requests backpressure before further writes. Callback failure precedes the error event. Destroy can abandon buffered data. | One-record writer; held native Writable callback, borrowed ownership, error/close and listener-retirement checks |
| [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html?trk=public_post_comment-text), informative security guidance | Recovery material needs secure generation/storage, limited life and single use. | Existing recovery crypto/expiry/transaction services retained; no persisted plaintext delivery or automatic re-arm |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude or protect secrets and connection strings; validate and bound diagnostic data. | Approved error-code/message projection, secret-free secondary diagnostics, explicit status fields |
| [W3C Understanding SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block), informative explanation of a WCAG requirement | Web status feedback needs suitable programmatic exposure; success, warnings and progress have distinct roles. | Existing recovery web handoff remains unchanged. A CLI write callback does not prove a web live-region announcement or WCAG conformance. |

The older versioned stream page is retained as an explicit source rather than
presented as the current release. Node's current process page also corroborates
the long-standing exit behavior. No private runtime hooks are needed.

Our architectural inference is to model service outcome, local output handoff and
cleanup separately. These sources do not prescribe Harmoniarr's private outcome
object or CLI orchestration. Callback completion does not establish a durable
file, downstream parser acceptance, terminal rendering or human receipt.

Recommended stack, in order: existing transactional recovery authority; native
Node output/exit contracts; small ESM execution and projection owners; fixed
security diagnostics; focused controlled and native-process/database tests.
The [design](RECOVERY_CLI_DELIVERY_DESIGN.md) compares the alternatives. Broader
relevant practices include OWASP security guidance, vendor lifecycle contracts,
PostgreSQL transaction integrity and W3C accessible feedback; each applies only
at its owning boundary. The existing standards skill now routes to a practical
[CLI delivery reference](../.agents/skills/harmoniarr-web-standards/references/cli-result-delivery.md).
