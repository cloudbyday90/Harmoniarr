# Missing Music manual match selection

**Status:** implemented — selection only; download start deferred

**Date:** 2026-08-26

## Purpose

This document records the first command slice for the household-wide
**Missing Music** workflow. An authorized user can select one safe, visible
match for an active release. Selection records the next download step; it does
not start a transfer, enqueue files, or expose a peer, path, or provider
diagnostic.

The second command slice will add an explicit **Start download** confirmation
and hand the accepted transfer to Downloader. Keeping those commands separate
means that a person can make an informed release decision without an accidental
network or filesystem side effect.

## Research and recommendation

Sources checked 2026-08-26:

- [W3C WCAG 2.2 — Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
- [W3C WCAG 2.2 Technique H102 — HTML dialog](https://www.w3.org/WAI/WCAG22/Techniques/html/H102)
- [W3C ARIA APG — Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Vue — Composables](https://vuejs.org/guide/reusability/composables)

W3C calls for headings and labels that describe purpose. The interface therefore
uses **Choose a match** and **Use this match**, not a generic review label.
Each choice states only the decision-relevant facts: file count, formats, and
total size. It deliberately omits peer identities, remote paths, queue depth,
and provider diagnostics.

No confirmation dialog is used in this slice. A modal requires a complete
focus, Escape, inert-background, and focus-return contract; a simple reversible
selection does not justify that interruption. The later transfer-start command
will use a native HTML `dialog` only if its confirmation needs a modal
decision.

OWASP recommends deny-by-default authorization and validating permissions on
every request. The browser supplies only a release decision ID and a candidate
ID. The server resolves the target account from the authenticated actor and
the decision on every read and mutation; a candidate ID is never accepted as
proof of access. Disabled accounts retain readable history but cannot be
changed. The command also requires a fresh session, CSRF protection, a bounded
rate limit, and an idempotency key.

## Alternatives

| Approach | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Reuse the Music Queue mutation route | Smallest change | Forces actor and target to be the same user; unsafe for household administration | Rejected |
| Select and immediately start a download | Fewer clicks | An irreversible provider side effect occurs without a clear user confirmation | Rejected |
| Custom ARIA confirmation modal for selection | Visually prominent | Adds focus-trap and keyboard responsibility without improving this reversible step | Rejected |
| Dedicated Missing Music command with inline choices | Keeps actor/target distinct, preserves history, and gives a clear next step | Adds focused modules and tests | Adopted |

## Design

### Server boundary

`missing-music-decision-target-service.js` resolves one wanted release within
the actor's server-authorized scope. It is reused by the read and command
services so the target-account rule cannot drift between them.

`missing-music-decision-command-service.js` owns **Use this match**. It:

1. validates bounded identifiers;
2. resolves the release and target user again at mutation time;
3. rejects disabled targets and candidates that are not currently selectable;
4. delegates only the candidate state transition;
5. records an audit event with the actor, target user ID, release, candidate,
   and `transferStarted: false`; and
6. records the ordinary release history event without provider-private data.

The HTTP adapter is deliberately thin. It enforces the fresh session and CSRF
middleware before an idempotent execution wrapper calls the command service.
It uses its own Missing Music rate-limit bucket rather than inheriting the
legacy Music Queue route's scope.

### Client boundary

The detail read returns a narrow `matchChoices` projection only when a release
needs a match decision. `useMissingMusicMatchSelection.js` owns mutation,
retry-key, error, and result state. The inspector stays a semantic layout
component: it presents an ordinary named section and native buttons, then
refreshes the authorized detail after a selection.

The outcome text is explicit: **Match selected. Download has not started.**
It is exposed through one concise status region. If the changed state removes
the invoking button, focus moves to the updated current-status heading.

## Security and privacy constraints

- Actor and target are separate durable facts; an administrator may act for an
  active household account while a non-administrator remains limited to their
  own release.
- A guessed release or candidate outside the actor's scope receives the same
  not-found response used for an unavailable resource.
- The read projection excludes peer usernames, remote file paths, transfer
  identifiers, queue position, upload speed, score breakdowns, and provider
  payloads.
- The command records a purpose-built audit event. It contains durable IDs and
  a transfer-side-effect flag, not raw candidate or request payloads.
- Selecting a candidate never invokes the import execution service. A later,
  separately protected command is the only route that can start a download.

## Validation

Completed 2026-08-26:

- `npm run validate` passed, including the full server, client, script, and
  integration suites; ESM, migration, schema, Compose-policy, copyright, and
  production-build checks also passed.
- Focused server and client tests cover actor/target scope, disabled-account
  enforcement, candidate ownership, audit data, safe projection, retry keys,
  and route middleware.
- The focused browser scenario verified the labelled selection path, CSRF and
  idempotency headers, no transfer start, refreshed status, and focus return
  to the updated current-status heading.

## Implemented outcome

The delivered command is:

```text
POST /api/v1/missing-music/decisions/:decisionId/matches/:matchId/select
```

It records the candidate transition and returns `downloadStarted: false`. The
Missing Music projection then presents **Match selected**, explains that a
download has not started, and makes **Start download** the next named step.
That status remains in the Missing Music action worklist rather than being
misclassified as generic match checking.

The browser supplies no target user, provider source, path, transfer ID, or
candidate score. The command re-resolves scope and selection eligibility on
the server; a disabled target remains readable as historical context but is
not mutable. Activity and audit history retain the actor and target identity
without storing raw provider evidence.

## Next item

Implement the separate **Start download** command. It must use a clearly named
confirmation that identifies the release and active target account, require the
same fresh-session/CSRF/idempotency boundary, preserve the target user through
the Downloader handoff, and have a complete keyboard focus contract.
