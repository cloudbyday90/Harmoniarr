# Docker smoke published-port ownership

Use for fresh/restart or baseline/upgrade smoke networking changes. Trace
scripts/docker-smoke-validation.js, docker-smoke-endpoint.js and compose.smoke.yaml.
Other deployment or managed-provider validators have independent contracts.

A host socket probe released before Docker binds cannot reserve a port for the
daemon. Prefer Docker allocation within the owned project. Compose normally
merges ports by resource key; another entry can leave the original public
binding exposed. Check the installed CLI's supported replacement semantics and
the actual merged config before startup. The current override requires 2.24.4+.

Resolve one concrete service container after each successful start, inspect its
actual bindings and refuse absent/unassigned, ambiguous or wider publication
before sending credentials or HTTP. Do not echo raw malformed inspection data.
Restart/upgrade can change host ports: create sessions against the current phase,
retain each endpoint and keep Compose interpolation separate from hook URLs.

Container-free tests should hold HTTP behind resolution and verify refusal plus
cleanup, not just parse expected config text. Native proof should exercise
fresh/restart and baseline/upgrade with actual persistence/authentication, inspect
loopback publication, and verify removal of owned containers/networks/volumes
before deleting bind data. Preserve failed candidates and original resource bounds.

The worked source/status/tradeoffs and executed scope are in
docs/DOCKER_SMOKE_PORT_DESIGN.md, docs/DOCKER_SMOKE_PORT_RESEARCH_2026_10.md and
docs/DOCKER_SMOKE_PORT_OUTCOME.md. W3C loopback trust does not provide TLS or network
isolation; OWASP guidance does not make a Docker-daemon compromise safe.
