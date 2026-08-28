# Missing Music Legacy Settings Recovery Context — Outcome

**Status:** Implemented and validated
**Date:** 2026-08-28

## Result

The Settings recovery helper translates the historical `music_queue_release`
token into `missing_music_decision` before it validates a destination, builds
a Settings handoff, or creates a Missing Music return action. Saved links using
either `returnTo` or the older `repair` key remain supported when they carry a
valid release ID. Every new handoff emits the canonical token.

The duplicate legacy destination metadata and redundant legacy-context checks
are removed from canonical Missing Music presentation paths. The legacy
constant remains solely as a documented input compatibility marker.

## Operator and accessibility outcome

- A repair from an old or new URL exposes the same **Return to Missing Music**
  action and returns to the same scoped decision route.
- The visible action is not renamed based on technical history, which keeps the
  same operation identifiable across Settings and Missing Music.
- No markup, focus, keyboard, or live-region contract changes.

## Security and multi-user outcome

- The helper still rejects arbitrary paths, external URLs, arrays, malformed
  IDs, and missing IDs for scoped decision recovery.
- Only fixed internal contexts reach a named route. Old input is canonicalized
  before route lookup and cannot select a Music Queue route.
- No user identity is placed in a URL. The existing server-side Missing Music
  scope check continues to authorize every decision read or mutation for the
  authenticated user or authorized administrator.

## Open PR assessment

GitHub CLI listing could not authenticate (`HTTP 401`). The reachable
Dependabot PR #41 was fetched and inspected locally without merging. It only
updates `@vue/language-server`, `eslint`, and `globals` to versions already on
`main`, so it is stale and was not applied.

## Validation record

- Focused Settings, Activity, Missing Music, and Settings Connections client
  coverage passed: 32 tests.
- `npm run lint:client`, `npm run lint:test`, and `npm run check:esm` passed.
- `npm run test:client` passed: 4,159 tests. Existing Vue lifecycle-harness
  warnings did not cause failures.
- The current Activity history browser verification passed with the canonical
  Settings URL assertion.
- `npm run validate` passed copyright, migration, schema snapshot, ESM, image,
  Compose-topology, lint, server, client, script, integration, and production
  client/server build gates.

Two pre-existing browser files remain stale after the earlier Music Queue to
Missing Music route migration:

- `music-queue-automatic-download-handoff-browser-verification.test.js`
- `music-queue-folder-setup-recovery-confirmation-browser-verification.test.js`

They time out before the changed URL assertion because they look for removed
Music Queue controls after the app redirects to Missing Music. Their canonical
outbound URL assertions were updated, but the larger interaction migration is
intentionally deferred to a dedicated browser-test modernization change.

## Next recommended work

Audit the remaining generic `MUSIC_QUEUE` Settings recovery token separately.
It has different, non-release semantics and must not be folded into this
release-scoped mapping without first mapping its historical URLs, provider
ready-state behavior, and administrator-visible history requirements.

## Related design

See [Missing Music Legacy Settings Recovery Context Design](MISSING_MUSIC_LEGACY_SETTINGS_RECOVERY_CONTEXT_DESIGN.md).
