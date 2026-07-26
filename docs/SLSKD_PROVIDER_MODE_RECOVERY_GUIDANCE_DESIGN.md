# Soulseek Provider-Mode Recovery Guidance Design

Status: **Implemented.**

## Objective

Finish the provider-mode experience with a direct, safe recovery path. A user
who chooses Managed without the Docker overlay needs the exact deployment
command and the names of the required secret files. A user who chooses External
needs to know that completed downloads must be visible to Harmoniarr, without
being sent into an unrelated diagnostics workflow.

## Research

Docker Compose profiles make optional services explicit rather than starting
them by default. Compose file-mounted secrets are scoped to services that
declare them. Compose startup conditions coordinate initial dependency start,
but runtime provider health still belongs to Harmoniarr. Sources: [Docker
Compose profiles](https://docs.docker.com/compose/how-tos/profiles/), [Docker
Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/), and
[Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/).

slskd persists its configuration in its application directory and warns that
remote configuration may expose secrets. Its API keys should not traverse an
untrusted HTTP boundary. [slskd configuration
reference](https://github.com/slskd/slskd/blob/master/docs/config.md)

## Options Considered

| Option | Advantages | Drawbacks | Decision |
| --- | --- | --- | --- |
| Put Docker controls in Settings | Appears centralized. | Requires Docker socket access and conflicts with Unraid/VPN ownership. | Rejected. |
| Link all modes to generic docs | Small implementation. | Leaves the user to discover the specific missing step. | Rejected. |
| Show mode-specific guidance in Connections | One direct recovery action at the point of selection. | Requires careful conditional UI. | Adopted. |
| Create another setup wizard | Can explain more. | Adds navigation and repeats existing Settings surfaces. | Rejected. |

## Final Design

`SoulseekProviderModeGuidance` receives the selected provider mode and managed
deployment marker and renders only one of these bounded states:

| State | Guidance |
| --- | --- |
| Managed with no deployment marker | Lists the six secret filenames, says to keep them in `HARMONIARR_SLSKD_SECRETS_DIR`, shows the documented Compose command, and offers a local copy action. |
| Managed with marker | No setup card. The managed deployment is already authoritative. |
| External | Explains the completed-download visibility requirement and links to the existing `Settings > Media & storage` folder/path-translation screen. |
| Disabled | No setup guidance. Disabled is an intentional idle state. |

The component does not collect secret values, write a Compose file, mount
volumes, invoke Docker, modify a VPN topology, or expose a provider URL/key.
Those remain deployment/operator responsibilities.

## Security Rules

- Secret **filenames** are safe to display; secret values never enter browser
  state, copied commands, or logs.
- The displayed command uses the checked-in Compose overlay; no browser-provided
  interpolation reaches a shell.
- External deployments retain their existing operator-owned topology. The route
  handoff covers only Harmoniarr's local folder and translation settings.
- The existing server-side mode policy remains the enforcement point for
  disabled and missing-managed modes; this component is guidance only.

## Validation

Unit tests cover every mode guidance state. Settings contract and browser tests
cover the Connections provider-mode controls. Existing Settings form and
provider-mode server tests continue to cover persistence, secret preservation,
and no-poll enforcement.

## Follow-Up

Mode-aware setup progress is now implemented on the Settings landing page. It
distinguishes a missing Managed overlay from generic connection health and
keeps one handoff to Connections. See [Soulseek Provider-Mode Setup
Progress](SLSKD_PROVIDER_MODE_SETUP_PROGRESS_DESIGN.md).
