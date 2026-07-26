# Soulseek Provider-Mode Onboarding Design

Status: **Implemented.**

## Problem

Soulseek setup previously implied one external connection form. That obscured
three materially different deployment choices: a Harmoniarr-managed Compose
sidecar, an operator-owned service such as an Unraid/VPN container, and no
download provider at all. It also allowed an unconfigured system to look like
it should retry or poll a provider.

## Research And Decision

Docker Compose secrets are mounted as files and should be granted only to the
services that need them. Docker's dependency conditions coordinate initial
startup only; they are not an application-health replacement. slskd persists
its configuration in `slskd.yml` and warns that remote configuration can expose
configuration secrets. Sources: [Docker Compose
secrets](https://docs.docker.com/compose/how-tos/use-secrets/), [Docker Compose
startup order](https://docs.docker.com/compose/how-tos/startup-order/), and the
[slskd configuration reference](https://github.com/slskd/slskd/blob/master/docs/config.md).

The final stack is:

1. **Managed**: Compose owns the slskd service, rendered configuration, and
   file-mounted API key. The `SLSKD_API_KEY_FILE` deployment marker makes this
   effective mode authoritative.
2. **External**: Settings stores the reachable URL and write-only encrypted API
   key for an independently operated provider, including Unraid or VPN setups.
3. **Disabled**: Harmoniarr makes no Soulseek calls, queues no downloads, and
   does not poll the Downloader provider read path.

## Alternatives

| Approach | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| One generic connection form | Small UI surface. | Conceals provider ownership and encourages invalid polling. | Rejected. |
| Settings edits Docker or slskd config | Centralized-looking setup. | Requires Docker socket or remote configuration access and breaks VPN/Unraid ownership. | Rejected. |
| Mode selector without server enforcement | Fast to ship. | A disabled UI could still call the provider. | Rejected. |
| Explicit mode plus runtime policy | Matches deployment ownership and stops disabled calls at the boundary. | Adds a small persisted setting and policy module. | Adopted. |

## Runtime Contract

`slskd.providerMode` is an allowlisted persisted setting with values `managed`,
`external`, and `disabled`.

- `disabled` wins over a managed deployment marker. It preserves any external
  stored credential but blocks client construction and Downloader polling.
- When `SLSKD_API_KEY_FILE` exists, Managed is effective and External cannot
  override the deployment-owned address/key. Settings automatically reflects
  Managed unless the user has selected Disabled.
- Selecting Managed without the managed Compose overlay is a specific
  misconfiguration. It performs no outbound connection attempt.
- External-only address, timeout, and API-key mutations are not sent when
  Managed or Disabled is selected. The settings service enforces the same
  API-key rule for direct requests. This avoids accidentally overwriting or
  clearing retained external settings.

## Settings Experience

Settings > Connections now leads with three plain-language radio choices and
only shows URL/key fields for External. Managed explains that deployment
configuration owns the secret. Disabled explains that downloads are paused and
disables the test action. Provider health remains the runtime result, not an
additional setup workflow.

## Security Boundaries

- Harmoniarr does not mount a Docker socket or write Compose/slskd files.
- Managed secrets remain file-mounted deployment secrets; external credentials
  remain encrypted at rest and write-only in the UI.
- A Disabled mode is enforced by the server-side runtime configuration and
  queue read model, not merely hidden client controls.
- Cross-host External deployments must still use a reviewed HTTPS/reverse-proxy
  boundary because provider API keys must not be exposed over untrusted HTTP.

## Validation

Focused tests cover provider-mode normalization, managed-marker precedence,
missing-managed deployment, disabled client prevention, disabled Downloader
no-poll behavior, settings validation, payload preservation, and Settings UI
contract/presentation behavior. Browser verification covers the visible mode
controls in the existing Settings progressive-disclosure flow.

## Follow-Up

The next high-value item is a **mode-aware deployment helper**: show a concise
Managed Compose command and required-secret checklist only when Managed is
selected without its overlay, while External links to the existing folder/path
mapping guidance. That closes the recovery loop without making Settings control
Docker or a VPN container.
