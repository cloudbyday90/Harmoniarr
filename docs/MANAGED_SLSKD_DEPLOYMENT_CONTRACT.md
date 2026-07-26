# Managed slskd Deployment Contract

Status: **Implemented deployment foundation.**

This document defines the supported managed slskd deployment shape. It replaces
the former standalone example with an optional Docker Compose overlay while
preserving the existing external-provider setup for Unraid and VPN-managed
installations.

## Decision

Harmoniarr manages slskd as a **separate Docker service**, never as a process
inside the Harmoniarr image. The managed overlay generates slskd's persistent
`slskd.yml` from Docker secret files, gives Harmoniarr the same API-key secret,
and mounts completed downloads at `/data/downloads` in both containers.

The supported modes are:

| Mode | Ownership | Use when |
| --- | --- | --- |
| Managed slskd | Harmoniarr Compose overlay owns the service and generated configuration. | A normal Docker deployment should work with minimal configuration. |
| External slskd | The operator owns the service, configuration, and VPN topology. | slskd already runs on Unraid, behind a separate VPN container, or on another host. |
| Disabled | No download provider runs. | The app is used without Soulseek downloads. |

The external path remains required for an existing Unraid container. Harmoniarr
must not try to modify an independently deployed container or its configuration.

## Research Outcome

slskd stores its durable configuration in `<application directory>/slskd.yml`,
supports a persistent Docker application directory at `/app`, and allows
separate incomplete and completed-download directories. Its own documentation
also warns that remote configuration can expose configuration secrets; managed
mode therefore renders configuration at deployment time with remote
configuration disabled. [slskd configuration reference](https://github.com/slskd/slskd/blob/master/docs/config.md)

Docker Compose secrets are mounted as files and granted only to services that
explicitly declare them, which avoids passing provider credentials in ordinary
environment variables. [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
Compose health checks can gate initial dependency startup, but they do not
replace Harmoniarr's ongoing provider health and retry logic. [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/)

## Deployment Shape

Use the canonical base plus the managed overlay:

```powershell
docker compose -f compose.yaml -f compose.slskd-example.yaml up -d --build
```

Before the first start, create the host directories and make them writable by
the configured `PUID`/`PGID`: `HARMONIARR_APPDATA`,
`HARMONIARR_SLSKD_APPDATA`, `HARMONIARR_SLSKD_INCOMPLETE`,
`HARMONIARR_DOWNLOADS`, `HARMONIARR_MUSIC`, `HARMONIARR_STAGING`, and
`HARMONIARR_TRANSCODE_TEMP`. On Linux or Unraid, create the directories as the
Docker operator and assign the chosen numeric owner before starting Compose.
This prevents a root-owned auto-created bind directory from blocking the
non-root configuration renderer or provider.

The overlay defines three services:

1. `harmoniarr`: connects to `http://slskd:5030` and reads only the API-key
   secret file.
2. `slskd-config`: a one-shot, non-privileged configuration renderer. It reads
   the six secret files and atomically writes `/app/slskd.yml` with mode `0600`.
   It has `network_mode: none` because rendering configuration has no network
   requirement.
3. `slskd`: the pinned `slskd/slskd:0.26.0` provider. It starts only after the
   renderer succeeds, persists `/app`, and has no default host mapping for its
   admin API or web UI.

The provider API is private on the internal `harmoniarr-provider` bridge. The
Harmoniarr and slskd egress networks are intentionally separate, so the app
does not share slskd's outbound network. Docker documents bridge networking and
service network namespaces as the supported Compose mechanisms for this
separation. [Docker Compose networking](https://docs.docker.com/compose/how-tos/networking/)

The only published managed-slskd port is the Soulseek listener (default
`50300/tcp`). Forward that port through the router or VPN provider only when
appropriate. slskd documents that a correctly routed listener improves search,
browse, and download reachability. [slskd listener configuration](https://github.com/slskd/slskd/blob/master/docs/config.md)

## Required Secrets

Set `HARMONIARR_SLSKD_SECRETS_DIR` to a host directory that is not in the
repository and is readable only by the Docker operator. It must contain these
newline-free files:

| File | Purpose |
| --- | --- |
| `slskd_api_key` | Harmoniarr's 16-255 character read/write provider API key. |
| `slskd_soulseek_username` | Soulseek account name. |
| `slskd_soulseek_password` | Soulseek account password. |
| `slskd_web_username` | Reserved slskd web authentication user. |
| `slskd_web_password` | Reserved slskd web authentication password. |
| `slskd_jwt_key` | slskd JWT signing secret, at least 16 characters. |

Generate high-entropy values for `slskd_api_key`, `slskd_web_password`, and
`slskd_jwt_key` with a password manager or a secure local generator. Do not put
these values in `.env`, Compose source, browser settings, shell history, logs,
or tickets. Docker identifies API keys and passwords as secret material and
recommends file-mounted secrets over environment-variable injection. [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)

`slskd.yml` necessarily contains the rendered slskd credentials. Its app-data
directory is therefore also sensitive and must be backed up and permissioned as
such. The renderer never prints secret values.

When `SLSKD_API_KEY_FILE` is present, Harmoniarr treats that mounted managed
secret as authoritative over an older key stored through Settings or a direct
`SLSKD_API_KEY` value. This avoids a stale historical setting silently talking
to a different provider configuration after a managed deployment is enabled.

## Security Rules

- The managed overlay does not mount the Docker socket into Harmoniarr.
  Docker-daemon access can provide host-level control and must not be exposed to
  an application web process. [Docker daemon security](https://docs.docker.com/engine/security/)
- `slskd-config` is one-shot, non-privileged, read-only apart from the mounted
  configuration directory, and receives only the secrets required to render
  the file.
- slskd receives no Docker secret mounts. It consumes its own persistent config
  file after the renderer exits.
- Remote configuration and remote file management are disabled in generated
  slskd configuration.
- slskd's UI/API port `5030` is not published by default. The provider uses a
  private internal bridge with a read/write API key because Harmoniarr must
  search and enqueue downloads. For a cross-host or externally published API,
  use HTTPS and a separately reviewed reverse-proxy boundary; slskd warns that
  API keys over plain HTTP are observable. [slskd API-key guidance](https://github.com/slskd/slskd/blob/master/docs/config.md)
- The slskd image is version pinned. Docker notes that a digest provides the
  stronger immutable supply-chain pin; release work should promote the pinned
  version to an audited digest after compatibility validation. [Docker image pinning](https://docs.docker.com/build/building/best-practices/)

## VPN and Unraid

Managed mode does not include a VPN container. It deliberately leaves that
choice to the operator because VPN credentials, provider port forwarding, and
Unraid network ownership are deployment-specific.

For a Compose-owned VPN gateway, the future VPN overlay will attach slskd with
`network_mode: service:<vpn-service>`. In that topology the gateway owns slskd
port publication and the provider route; Harmoniarr remains outside the VPN.
Docker documents `service:<name>` as the supported shared-network-namespace
form. [Docker Compose networking](https://docs.docker.com/compose/how-tos/networking/)

For an existing Unraid slskd/VPN application, keep **External slskd** selected
and configure its reachable base URL, API key, download mount, and folder
mapping in Harmoniarr. Do not run the managed overlay against the same
application data or ports.

## Validation Contract

This foundation is covered by:

- unit tests for file-secret precedence and managed key status;
- renderer tests for secure defaults, safe path validation, and atomic config
  output;
- Compose contract tests proving private API exposure, persistent configuration,
  pinning, and least-secret access;
- existing Compose image-tag enforcement.

The next implementation slice must add a Docker-backed managed-slskd smoke
test with disposable credentials, then add provider-mode onboarding so managed,
external, and disabled setups are explicit in Settings.
