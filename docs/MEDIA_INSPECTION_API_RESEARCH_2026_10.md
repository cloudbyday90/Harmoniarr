# Media inspection API research — October 14, 2026

Official URLs were discovered through the connected search/GitHub MCP services,
then opened or fetched. Live runtime evidence is separate: this host runs Node
24.18.1, Docker Desktop 4.94.0 and Linux Engine 29.8.2, API maximum 1.56/minimum
1.40, through its selected local Desktop named pipe. Private daemon identity was
compared in memory. Documentation alone cannot establish that identity.

## Applicable practices

Docker documents context/host precedence and API-version overrides. The adapter
resolves the selected target once, captures the environment, pins later CLI work
to the acknowledged socket and refuses unsupported overrides. This prevents a
later default-context change from splitting CLI mutations and API inspections.
[Docker CLI reference](https://docs.docker.com/reference/cli/docker/)

The Engine API exposes versioned HTTP endpoints and current container inspection.
The pilot deliberately uses API 1.56's inspection response while keeping every
existing configuration/ownership check and current ExecIDs/running check. We
infer that removing CLI startup may reduce measured read cost; API documentation
does not prove the benefit or eliminate read/daemon latency.
[Engine API](https://docs.docker.com/reference/api/engine/),
[API 1.56](https://docs.docker.com/reference/api/engine/version/v1.56/)

Docker treats daemon access as privileged and documents protected remote access.
Our narrower local-only reader does not expose a listener, forward credentials
or enable unauthenticated TCP. It is used by trusted local test tooling; GET
allowlisting is a client restriction, not daemon-side read-only credentials.
[Protect the Docker daemon socket](https://docs.docker.com/engine/security/protect-access/)

Node documents socket-path requests, response consumption, request destruction
and explicit shutdown of keep-alive agents. A timeout notification alone is not
termination. Our implementation uses an absolute timer, destroys the actual
socket on failure and awaits owned close events; it also bounds headers/body
and refuses compressed or redirected responses. The reviewed Node 24 HTTP
reference is v24.17.0; native verification uses the installed v24.18.1 host.
[Node 24 HTTP](https://nodejs.org/download/release/v24.17.0/docs/api/http.html)

W3C High Resolution Time supports monotonic elapsed observation and distinguishes
it from wall-clock time. Its September 1, 2026 publication is a Working Draft.
This informs performance evidence; it is neither a Recommendation claim nor
browser accessibility conformance. There is no UI/focus/form change this round.
[W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/)

OWASP recommends excluding sensitive data and testing failures in logging paths.
Fixed aggregate phase names/counts/durations are published; daemon/container IDs,
paths, arbitrary responses and original exception payloads stay private. Tests
preserve primary Error/null through failed cleanup and optional diagnostics.
[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Practical AI skill update

The existing `harmoniarr-web-standards` skill already covers W3C/WAI, HTTP,
OWASP, current resource authority and evidence selection. Its focused official
practices and project evidence references now map local API target pinning,
bounded HTTP and returned disposal to their actual modules/tests. The testing
skill's guarded-workload reference records explicit selectors, hybrid phase
semantics, native controls and reversed-order measurement limits. This extends
the practical workflow without another overlapping generic standards skill.

## Random open PR

GitHub MCP found two open PRs; random local selection chose
[PR #42](https://github.com/cloudbyday90/Harmoniarr/pull/42). Its five workflow
patches replace sixteen `actions/upload-artifact` v7.0.1 pins with v7.0.2.
The official tag resolves to `cf430e030ddbb5b0abf93d22962f4752f3646cd9`.
GitHub's official security guidance recommends verified action dependency pins;
the replay retains full commit references rather than substituting mutable tags.
[GitHub Actions security](https://docs.github.com/en/actions/how-tos/secure-your-work)
The [upstream comparison](https://github.com/actions/upload-artifact/compare/v7.0.1...v7.0.2)
updates the artifact library and its bundled output; release notes describe
rate-limit retry handling. Exact workflow pins and their three local contract
modules were updated together. No PR merge, rebase, comment or release action
is part of this implementation. Local contract tests cannot exercise GitHub's
hosted artifact service; that remains a CI validation boundary.

The [design](MEDIA_INSPECTION_API_DESIGN.md) compares options and gives the final
stack. The [outcome](MEDIA_INSPECTION_API_OUTCOME.md) records executed evidence
and remaining scope rather than treating these sources as proof of performance.
