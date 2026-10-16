# Integration preflight official practices

Consulted 2026-10-15 through MCP search and page opening. URLs were discovered
from search results; GitHub repository metadata supplied the PR collection URL.

| Source and status | Applicable practice | Project decision and evidence owner |
| --- | --- | --- |
| [Docker create CLI](https://docs.docker.com/reference/cli/docker/container/create/), current framework documentation | Create acknowledges an ID without starting the container; explicit command/security options | Validate acknowledged identity before attached start; owned probe controls |
| [Docker Engine security](https://docs.docker.com/engine/security/), current informative guidance | Daemon access is powerful; minimize granted capabilities and validate parameters | No socket or host bind in prerequisite probes; fixed executable/argument allowlist |
| [Docker image inspect](https://docs.docker.com/reference/cli/docker/image/inspect/), current CLI documentation | Inspect reports selected image metadata | Verify Linux/content identity independently from executing required tools |
| [Docker image digests](https://docs.docker.com/dhi/explore/security-concepts/digests/), current informative guidance | Tags can move; digests identify content; manifest and platform digests differ | Resolve actual local metadata, verify pinned reference resolves to the same local ID; do not assume a digest is a tool capability |
| [Node 24 child processes](https://nodejs.org/download/release/v24.21.0/docs/api/child_process.html), versioned API documentation | close follows process termination and stdio closure; exit alone is earlier | Shell-free execFile with argument arrays and bounded output; remote container retirement is separately verified |
| [OWASP command injection](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html), informative guidance | Separate executable/arguments and validate allowed inputs; escaping alone does not prevent argument injection | Fixed five version commands and validated image/reference forms; no shell evaluation |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/), Working Draft 2026-09-01 | Monotonic elapsed observations avoid wall-clock adjustments | Existing performance.now durations remain descriptive; timing is not completion or resource-isolation proof |

Host Node was 24.18.1, within the package's >=24.15 <25 contract. Versioned
24.21 documentation is used only for long-established child-process behavior.
The reader is checked against the actual package runtime floor. Binary probes
and strict pre-database admission are project inferences from these sources,
not requirements attributed to W3C. No browser interaction changes are proposed;
WCAG/ARIA conformance is outside this infrastructure slice.

Tradeoff: constrained disposable execution costs five short lifetimes and
cannot guarantee later daemon availability. It detects known capability failures
before lengthy native work without changing test eligibility or resource bounds.
Continue to require real suite assertions; a version probe is not a functional
database/media/socket certification.
