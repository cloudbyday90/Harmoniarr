# Docker smoke port ownership

Date: 2026-10-19. Follow the [runtime closure outcome](RUNTIME_DEPENDENCY_CLOSURE_OUTCOME.md).
An earlier smoke run released a successfully probed host port before Docker could
bind it, then failed at publishing. The exact original conflict is unknown.

## Design

Use a smoke-only Compose override to replace the complete published-port list
with one Docker-allocated TCP port on 127.0.0.1 targeting app port 3000. Use
!override, because an ordinary ports merge can retain the original all-interface
mapping. This requires Compose 2.24.4 or newer; the local CLI is 5.6.0.
Canonical deployment and walkthrough Compose files retain their own contracts.

After every successful start, resolve the single service container from the
explicit Compose project, then inspect only its NetworkSettings.Ports. A small
ESM endpoint module refuses missing/multiple container identities, malformed or
unassigned ports, non-loopback bindings, multiple bindings and extra published
ports before any HTTP request. Diagnostics must not echo arbitrary CLI output.
The Docker daemon remains the trusted local control plane, not an untrusted API.

Fresh install/restart and baseline/upgrade independently resolve their current
mapping. HTTP clients and runtime hooks use that phase's endpoint. Preserve
phase endpoint evidence and keep the top-level port as the last running phase's
port for existing consumers. Hooks retain their existing env.HARMONIARR_PORT
view while Compose interpolation continues to use port zero and the override.
Preserve authentication, persistence, migration, startup-refusal and cleanup.

Remove the host-socket allocator and its test injection. Do not add a retry,
fixed port, extended deadline or fallback to a wider interface. Other validators,
including managed-provider smoke, remain separate follow-ups.

## Verification

Container-free tests exercise endpoint refusals, command ordering, cleanup after
refusal and changed mappings across restart/upgrade, including fresh session
clients for the new port. Native Compose config verifies replacement, then a real
image runs fresh/restart and baseline/upgrade with strict resource cleanup.
Bind final source/configuration and package bytes before/after collection.
Use the existing fast gate; avoid repeating unchanged database or UI suites when
the owning packaging flow supplies direct evidence. The [research](DOCKER_SMOKE_PORT_RESEARCH_2026_10.md)
records alternatives and the [outcome](DOCKER_SMOKE_PORT_OUTCOME.md) records actual results.
