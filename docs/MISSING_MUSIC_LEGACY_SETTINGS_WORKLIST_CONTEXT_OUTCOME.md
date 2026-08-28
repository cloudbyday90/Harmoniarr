# Missing Music Legacy Settings Worklist Context — Outcome

**Status:** Implemented and validated
**Date:** 2026-08-28

## Result

Historical Settings links carrying `returnTo=music_queue` or
`repair=music_queue` resolve to the canonical Missing Music worklist. Newly
constructed Settings links carry `returnTo=missing_music`. A successful
Soulseek repair returns to Missing Music with the fixed,
one-time `recovery=provider_ready` visibility marker.

The Settings recovery helper now translates the legacy token before choosing a
destination. The former duplicate `music_queue` destination metadata is gone.
The canonical Missing Music provider-ready presentation now consistently uses
the name **Missing Music**, including its ready and retry status messages.

No user, administrator, provider, or release data was added to the generic
worklist URL. The fixed query marker remains presentation-only; API requests
continue to determine the authenticated user's or administrator's authorized
worklist on the server.

## Accessibility and compatibility outcome

- Historical and current links expose the same **Return to Missing Music**
  action and resolve to the same generic worklist route.
- A generic legacy context cannot be mistaken for a scoped decision because it
  has no release ID and is normalized to `missing_music`, not
  `missing_music_decision`.
- The recovery message no longer asks people to reconcile the legacy Music
  Queue name with the current Missing Music destination.
- No control, markup, focus, keyboard, or live-region behavior changed.

## Open PR assessment

GitHub CLI listing remains unavailable because the configured credentials return
`HTTP 401`. The reachable Dependabot PR #41 was previously fetched and reviewed
locally without merging. It contains only dependency versions already present
on `main`, so it is stale and was not applied.

## Validation record

- Focused Settings recovery, Missing Music provider-visibility, and Settings
  Connections contract tests passed: 19 tests.
- `npm run lint:client`, `npm run lint:test`, `npm run check:esm`, and
  `npm run build:client` passed.
- `npm run test:client` passed: 4,160 tests.
- `npm run validate` passed repository policy, schema/migration, ESM, Compose,
  lint, server, client, script, integration, and production build gates.
- The pre-existing Music Queue browser suites remain intentionally deferred.
  They exercise removed controls after legacy routes redirect to Missing Music;
  their broader interaction modernization is the next focused browser task.

## Next recommended work

The deferred Music Queue browser work is superseded by the focused acceptance
modernization documented in
[Missing Music Browser Acceptance Modernization Design](MISSING_MUSIC_BROWSER_ACCEPTANCE_MODERNIZATION_DESIGN.md).
That audit identified four obsolete browser modules and one stale Activity
compatibility assertion, rather than only two suites.

## Related design

See [Missing Music Legacy Settings Worklist Context Design](MISSING_MUSIC_LEGACY_SETTINGS_WORKLIST_CONTEXT_DESIGN.md).
