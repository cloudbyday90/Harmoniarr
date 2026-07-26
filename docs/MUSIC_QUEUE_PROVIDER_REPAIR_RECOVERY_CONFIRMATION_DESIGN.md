# Music Queue Provider Repair Recovery Confirmation Design

Status: **Implemented.**

## Objective

After an operator opens Settings > Connections from a Music Queue repair
notice and saves a relevant change, verify the bounded Soulseek readiness state
and state whether Music Queue is eligible to continue. The result must never
claim that a transfer has started, expose connection details, or redirect to a
user-supplied URL.

## Research

W3C's ARIA22 technique identifies `role="status"` as the appropriate polite,
atomic live region for a result added after an action. The confirmation keeps a
persistent status container and reports the full result without interrupting
the operator. [W3C ARIA22 status-message technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22).

Vue Router supports named-route location objects with query data. The repair
handoff therefore uses a named internal route, not a hard-coded URL. [Vue Router
programmatic navigation](https://router.vuejs.org/guide/essentials/navigation.html).

OWASP recommends mapping a short allow-listed token to a known destination
instead of redirecting to an untrusted URL. The `music_queue` return context is
the only accepted value. [OWASP unvalidated redirects and forwards](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html).

## Options Considered

| Option | Advantages | Drawbacks | Decision |
| --- | --- | --- | --- |
| Send the operator directly back to Music Queue after save | Fast. | Hides whether the provider was actually reachable. | Rejected. |
| Persist a global recovery banner | Survives navigation. | Adds stale, noisy state to unrelated screens. | Rejected. |
| Redirect to an arbitrary query-string URL | Flexible. | Creates an open-redirect risk. | Rejected. |
| Conditional, in-place readiness confirmation | Verifies the result and keeps repair controls in Connections. | Requires one extra health read after save. | Adopted. |

## Final Design

The Music Queue repair notice links to the named `settings-connections` route
with the fixed `repair=music_queue` query value. Connections allow-lists that
value. It does not process route paths, hostnames, or arbitrary route names.

After a successful Settings save, Connections refreshes dependency health and
combines it with the reduced provider mode state. The result is shown only for
the Music Queue return context.

| Result | Meaning | Action |
| --- | --- | --- |
| Soulseek is ready | Music Queue can continue normal checks; no download has started. | Return to Music Queue with one bounded queue refresh |
| Downloads still off | Provider mode is still Disabled. | Keep the operator in Connections. |
| Managed setup still required | The managed deployment remains unavailable. | Keep the operator in Connections. |
| Soulseek still needs setup or attention | External configuration or reachability remains unresolved. | Keep the operator in Connections. |
| Connection not verified yet | Save succeeded but the fresh health read failed. | Keep the operator in Connections; Music Queue retries normally. |

## Security Rules

- Accept only the `music_queue` return token. Do not process a URL, pathname,
  hostname, or arbitrary route name from the query string.
- Reduce Settings data to provider mode and managed-deployment state before
  presentation. Do not display service addresses, API keys, paths, raw health
  messages, or transport errors.
- The client only reports eligibility. The server remains authoritative for
  retry scheduling and download dispatch.
- A confirmation is cleared when relevant Soulseek inputs change, preventing a
  stale readiness result from being presented as current.

## Validation

Pure tests cover allow-listed return context, ready, unresolved, and
unverified outcomes. Browser verification follows the Music Queue handoff,
saves Connections, proves the bounded ready message and return link, and
checks for browser errors.

## Follow-On

The bounded return refresh and waiting-release status are implemented in
[MUSIC_QUEUE_PROVIDER_RECOVERY_VISIBILITY_DESIGN.md](MUSIC_QUEUE_PROVIDER_RECOVERY_VISIBILITY_DESIGN.md).
