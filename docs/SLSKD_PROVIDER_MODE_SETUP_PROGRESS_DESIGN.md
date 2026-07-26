# Soulseek Provider-Mode Setup Progress Design

Status: **Implemented.**

## Objective

Make the default Settings > Setup page identify a missing managed Soulseek
deployment as a setup action rather than presenting it as a generic connection
failure. The page must keep one clear handoff to Settings > Connections and
must not gain deployment controls or secret handling.

## Research

Docker Compose profiles make optional services an explicit operator choice, and
Compose secrets are mounted only into services that declare them. This supports
showing managed-deployment progress without granting the browser Docker or
secret access. [Docker Compose profiles](https://docs.docker.com/compose/how-tos/profiles/)
and [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/).

slskd documents that remote configuration can expose YAML-held secrets and is
disabled by default. Its download and incomplete directories must already exist
and be writable, so path ownership remains an operator/deployment concern.
[slskd configuration reference](https://github.com/slskd/slskd/blob/master/docs/config.md).

W3C recommends `role="status"` with an atomic polite announcement for updated
status information. [W3C ARIA22 status-message technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22).

## Options Considered

| Option | Advantages | Drawbacks | Decision |
| --- | --- | --- | --- |
| Treat missing Managed deployment as unavailable | Minimal code. | Misstates the actionable problem and makes the recovery guidance hard to find. | Rejected. |
| Add Docker or secret-file controls to Setup | Appears self-service. | Requires privileged host access and weakens the Compose secret boundary. | Rejected. |
| Add a separate setup wizard | Can explain every deployment variation. | Duplicates Settings and adds navigation. | Rejected. |
| Add mode-aware progress with one Connections link | Makes the state actionable while preserving ownership boundaries. | Requires a read-only Settings status fetch. | Adopted. |

## Final Design

`useSettingsSetupProgress` reads the existing admin-only Settings payload and
reduces it immediately to one boolean: `managedDeploymentMissing`. It does not
retain form state, provider URLs, or secret metadata and values.
`buildSettingsSetupSteps` combines that read-only mode status with the existing
dependency-health result.

| Mode state | Setup status | Copy | Handoff |
| --- | --- | --- | --- |
| Managed without deployment marker | Managed setup required | The managed Docker overlay is not running yet. Finish the managed setup before downloads can start. | Finish managed setup -> Connections |
| Disabled | Optional | Soulseek downloads are intentionally off. | Choose provider mode -> Connections |
| Ready or unknown | Existing dependency-health status | Existing healthy, unavailable, or error explanation. | Existing Connections action |

The setup-status announcement uses a polite, atomic `role="status"` region
while the asynchronous checks finish. The step remains a single link rather
than duplicating the command, secret-file list, external provider form, or path
controls that already belong on Connections and Media & storage.

## Security Rules

- The Setup request uses the existing admin-only settings endpoint. The client
  immediately reduces its response to one deployment-state boolean and never
  displays secret values or metadata.
- Setup does not invoke Docker, write Compose files, mount paths, or modify
  slskd configuration.
- `managed_deployment_missing` remains a server-enforced no-call state; the UI
  only explains it.
- External provider URLs and stored API keys are not included in the progress
  model or displayed on the landing page.

## Validation

Pure presentation tests prove the missing-managed, disabled, and existing
health fallbacks. Composable tests prove payload reduction and fetch failure
containment. Browser verification opens Settings > Setup with managed mode
missing its overlay and proves the exact status and Connections handoff.

## Next Item

The next high-value item is **mode-aware Home and Music Queue repair context**:
when a release cannot progress because Soulseek is Disabled, Managed setup is
incomplete, or an External provider is unreachable, show one concise cause and
the relevant Settings handoff without turning those pages into configuration
workbenches.
