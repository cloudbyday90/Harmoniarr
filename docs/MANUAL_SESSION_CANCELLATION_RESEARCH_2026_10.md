# Manual session cancellation research and recommendation

Consulted October 21, 2026 through MCP search and official navigation. The actual
local baseline is Node 24.22.0/npm 12.0.2. Rolling Node 24.x documentation can
display a later patch version; it is API guidance, not proof of the installed
version or a dependency upgrade in this change.

## Applicable official guidance

| Source / status | Decision supported |
| --- | --- |
| [WHATWG DOM, living standard](https://dom.spec.whatwg.org/) | Abort signals carry a reason; checkpoints can throw that exact reason. Use one signal and preserve Error/null instead of inventing a different cancellation cause. |
| [Node 24.x globals, API documentation](https://nodejs.org/docs/latest-v24.x/api/globals.html) | Apply AbortController/throwIfAborted in the installed runtime; distinguish signaling from the underlying work actually completing. |
| [Node 24.x readline, API documentation](https://nodejs.org/docs/latest-v24.x/api/readline.html) | Close can follow EOF or explicit closure and does not instantly suppress buffered line events. Seal command admission explicitly and own listener disposal. |
| [Node 24.x timers, API documentation](https://nodejs.org/docs/latest-v24.x/api/timers.html) | Cancel a readiness delay cooperatively; timer rejection wrapping does not replace the caller's original reason. |
| [Docker container removal, official CLI contract](https://docs.docker.com/reference/cli/docker/container/rm/) | Force removal sends SIGKILL; volume removal concerns associated anonymous volumes. Apply it only to the exact disposable container this invocation owns, after admitted command completion. |
| [OWASP Docker Security, informative security guidance](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html) | Preserve exposure reduction, privilege restrictions and resource bounds. Removing unwanted test work does not replace those controls or grant daemon/socket access. |
| [W3C CSS Environment Variables Level 1, Working Draft](https://www.w3.org/TR/css-env-1/) and [WebKit safe-area guidance, historical vendor guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) | Insets describe the user agent's safe rectangle; cover changes layout and requires compensating insets. The older vendor article is not evidence that current physical hardware passed. Defer a global cover change until its device-specific need is reproduced. |

These sources inform separate boundaries. DOM/Node cancellation is not resource
retirement; Docker removal is not graceful application completion; W3C layout
guidance is not screen-reader/device evidence. Tests own each concrete claim.

## Options and tradeoffs

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| Consume stop only after setup | Minimal code | Starts unwanted work and can publish readiness after quit | Replace |
| Force process exit on quit | Fast visible exit | Can strand an admitted Docker run/container and truncate cleanup/output | Decline |
| Race setup against an abort promise | Quickly returns to the caller | Discards actual completion unless an independent owner still drains it | Decline for the Docker owner |
| Eager input owner plus cooperative checkpoints/drainage | Stop applies during setup, no late command queue, cleanup stays reviewable | An admitted external command can still take its original bounded time | Implement |
| Global viewport-fit cover change now | Could enable an intended edge-to-edge layout | Requires shell/auth/landscape inset work and physical evidence that is currently unavailable | Defer |

## Recommendation stack

Keep the existing ESM Express/Vue app and isolated PostgreSQL fixture. Add a small
Node readline/AbortController owner, checkpoint admission in the session/database
owners, await actual external command completion, and preserve exact Docker
cleanup identity. Use focused controlled failure/ordering tests plus the explicit
native CLI/Docker/app lane. Keep routine feedback small and retain the manual AT
acceptance procedure for an available operator.

Next acceptance remains actual screen-reader navigation/speech and real-device
safe-area/keyboard checks. OS signal delivery is a separate platform-specific
qualification; emitting a controlled signal event alone does not prove that path.
