# Music Queue Provider Repair Context Design

Status: **Implemented.** Canonical module ownership now follows Missing Music;
see [Missing Music Provider Repair Presentation Migration](MISSING_MUSIC_PROVIDER_REPAIR_PRESENTATION_MIGRATION_DESIGN.md).

## Objective

Show one concise, actionable explanation on operator Home and Music Queue when
queued music cannot advance because Soulseek downloads are off, Managed setup
is incomplete, or the selected provider is not ready. The notice must point to
Settings > Connections without repeating deployment controls, raw diagnostics,
or secrets.

## Research

Compose profiles selectively activate optional services and Compose secrets are
granted to only the services that explicitly declare them. A home-user-facing
repair notice should therefore identify a missing managed deployment but leave
profile activation and secret ownership to Compose. [Docker Compose
profiles](https://docs.docker.com/compose/how-tos/profiles/) and [Docker
Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/).

slskd warns that remote configuration can expose YAML-held secrets and is
disabled by default. Its configuration and writable download paths stay outside
the Harmoniarr browser surface. [slskd configuration
reference](https://github.com/slskd/slskd/blob/master/docs/config.md).

W3C classifies `role="status"` as advisory, polite live-region content. It is
appropriate for a newly loaded repair explanation that should not interrupt the
operator. [W3C WAI-ARIA status role](https://www.w3.org/TR/wai-aria-1.0/complete).

## Options Considered

| Option | Advantages | Drawbacks | Decision |
| --- | --- | --- | --- |
| Show raw provider health everywhere | Small implementation. | Leaks technical wording and is noisy when no music needs the provider. | Rejected. |
| Put configuration controls on Home and Music Queue | Seems convenient. | Duplicates Settings and weakens deployment boundaries. | Rejected. |
| Add a queue-level notice for every release | Clear visibility. | Repeats the same cause and overwhelms release-specific progress. | Rejected. |
| One conditional queue-level repair notice | Gives the cause and next step once, only when relevant. | Requires combining mode and health read models. | Adopted. |

## Final Design

`useMusicQueueProviderRepairContext` combines existing dependency health with
the reduced Settings mode state. Its pure presentation helper recognizes only
provider-dependent queue states: searching, checking matches, choosing a
match, trying the next match, and downloading.

| Condition | Title | Copy | Action |
| --- | --- | --- | --- |
| Disabled provider | Downloads are off | Turn on a Soulseek provider before queued music can continue. | Choose provider mode |
| Managed overlay absent | Managed setup required | Finish the managed setup before queued music can continue. | Finish managed setup |
| External provider not configured | Soulseek needs setup | Connect Soulseek before queued music can continue. | Set up Soulseek |
| Provider unreachable or misconfigured | Soulseek needs attention | Queued music will continue when Harmoniarr can reach Soulseek. | Check Soulseek connection |
| Healthy or no provider-dependent queue work | No notice | No notice | None |

Home renders the notice immediately above its compact Music Queue progress.
Music Queue renders it below the page header and above the summary. It is not
shown to requesters because they cannot manage system connections.

## Security Rules

- The repair context retains only the provider mode, the managed-overlay
  boolean, and the bounded health status. It emits its own application repair
  code and discards provider URLs, secret metadata, secret values, paths, and
  raw error text.
- The UI does not call Docker, Compose, or slskd configuration APIs.
- The server remains responsible for preventing calls in Disabled and
  missing-Managed states. This is explanatory UI only.
- One named Settings route is used for all actions, preserving role-based
  access checks and avoiding untrusted external links.

## Validation

Pure tests cover every repair condition and verify that quality-only and empty
queues stay quiet. Browser verification intercepts the existing health and
Settings reads, proves Home and Music Queue show the same bounded Managed
setup notice, and verifies their Connections links.

## Follow-Up

Provider repair recovery confirmation is now implemented. Saving a relevant
Connections change refreshes bounded provider health and shows whether Music
Queue is eligible to continue, without claiming that a download has started.
See [Music Queue Provider Repair Recovery
Confirmation](MUSIC_QUEUE_PROVIDER_REPAIR_RECOVERY_CONFIRMATION_DESIGN.md).
