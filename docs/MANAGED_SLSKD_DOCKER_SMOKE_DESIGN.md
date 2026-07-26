# Managed slskd Docker Smoke Design

Status: **Implemented and executed locally on July 25, 2026.**

## Goal

Prove that Harmoniarr's optional managed slskd deployment starts as a secure,
usable Compose stack without requiring an operator's Soulseek account, API key,
or download folder. This is a deployment-contract test, not a search or
transfer acceptance test.

## Research and Decision

Docker Compose starts services in dependency order but only waits for actual
readiness when `depends_on` uses `service_healthy` or
`service_completed_successfully`. The managed stack uses both: the renderer
must finish before slskd starts, and Harmoniarr waits for slskd health. [Docker
Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/)

Docker secrets are per-service files under `/run/secrets`; they are preferable
to ordinary environment variables for credentials because access is explicit
and environment values are easy to expose in diagnostics. [Docker Compose
secrets](https://docs.docker.com/compose/how-tos/use-secrets/)

The slskd configuration reference documents persistent `/app` data, YAML
configuration, API keys, and configurable download paths. The managed renderer
uses that model and disables remote configuration. [slskd configuration
reference](https://github.com/slskd/slskd/blob/master/docs/config.md)

The selected design is a dedicated Docker smoke runner using the real pinned
slskd image plus a temporary Compose project. It is stronger than a static
Compose assertion and safer than pointing the general walkthrough at a live
provider.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Static Compose contract only | Fast and deterministic. | Cannot prove image startup, permissions, or API authentication. | Retained as a fast unit test. |
| Manual local validation | Uses real containers. | Requires a real account and is not repeatable. | Not sufficient as the release contract. |
| Isolated managed Docker smoke | Uses real images and secret mounts while remaining repeatable and account-free. | Requires Docker and pulls/builds images. | **Implemented.** |

## Smoke Contract

`npm run validate:managed-slskd-smoke` creates a unique project and temporary
workspace. It:

1. Generates six disposable slskd secret files and a disposable VAPID pair.
2. Starts `compose.yaml`, the managed slskd overlay, and the test-only
   `compose.slskd-smoke.yaml` overlay.
3. Marks slskd's egress network internal, so no Soulseek login, search, or
   transfer can leave the test project.
4. Proves the one-shot renderer exited successfully and wrote `/app/slskd.yml`
   at mode `0600` with remote configuration and remote file management disabled.
5. Proves the real slskd container is healthy and does not host-publish API
   port `5030`.
6. Runs an ESM API probe inside Harmoniarr's private provider network. The
   probe reads the mounted API-key file and expects
   `http://slskd:5030/api/v0/application` to return HTTP `200`.
7. Verifies Harmoniarr's public health endpoint and writes optional redacted
   JSON evidence.
8. Removes the Compose project, volumes, temporary application data, and
   secret files in `finally`.

The result deliberately proves provider API reachability, not a healthy
Soulseek session. Egress isolation makes slskd's external session unavailable
by design during this test.

## Startup Hardening Found by the Smoke

The first live execution found two production-relevant defects:

- slskd is a .NET single-file application. With a read-only root filesystem,
  its default bundle extraction path was unavailable. Managed mode now sets
  `DOTNET_BUNDLE_EXTRACT_BASE_DIR=/app/.net`, a persistent directory writable
  only by the configured container user. Microsoft documents this explicit
  directory as the solution when the default extraction location is not
  usable, and advises against a shared `/tmp` extraction location. [.NET
  single-file deployment](https://learn.microsoft.com/en-us/dotnet/core/deploying/single-file/overview)
- The former `0.0.0.0,[::]` web binding caused a Kestrel port-`5030` collision
  on the Linux Docker runtime. Managed mode now binds the private API to
  `0.0.0.0` only. Docker service networking remains IPv4-capable, and no
  public API port is needed.

## Running the Evidence

```powershell
npm run validate:managed-slskd-smoke -- --evidence-path .tmp\managed-slskd-smoke\managed-slskd-smoke.json

$env:HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH = '.tmp\managed-slskd-smoke\managed-slskd-smoke.json'
npm run validate:docker-smoke-evidence
```

The local execution passed on July 25, 2026. It used only generated credentials
and produced verified evidence at
`.tmp/managed-slskd-smoke/managed-slskd-smoke.json`.

## Final Recommendation Stack

1. Use managed slskd for a standard Compose deployment: one provider sidecar,
   rendered config, private API network, and persistent app/download mounts.
2. Keep External slskd for Unraid or VPN-owned containers; Harmoniarr must not
   mutate an independently owned provider.
3. Keep this smoke command in Docker-capable validation before changing the
   managed Compose contract.
4. Add explicit Settings modes next so the UI clearly distinguishes Managed,
   External, and Disabled provider ownership.
