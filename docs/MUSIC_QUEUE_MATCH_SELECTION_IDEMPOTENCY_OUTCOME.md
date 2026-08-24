# Music Queue Match-Selection Idempotency Outcome

## Delivered

On 2026-08-24, Music Queue match selection was connected to Harmoniarr's
existing control-plane idempotency service.

- The browser now sends a scoped `Idempotency-Key` for the use-match action
  and retains it for a same-match retry only when no HTTP response was
  confirmed.
- The route authenticates with a fresh session and validates CSRF before it
  performs an idempotency lookup.
- A successful first request stores the original result under the actor,
  operation scope, key, and request fingerprint.
- A completed retry with the same key and selection data replays the stored
  payload without running candidate selection again.
- The app now shares one control-plane idempotency-service instance between
  recovery/system mutations and Music Queue wiring.
- No migration, new cache, CommonJS module, external service, or new large
  singleton was introduced.

The existing 48-hour retention and scheduled expired-record cleanup apply to
this route. The shared discovery-request selection guard remains in place for
simultaneous candidate choices.

## Validation

The following checks passed on 2026-08-24:

| Check | Expected evidence |
| --- | --- |
| Focused Music Queue, client, control-plane idempotency, and app-composition tests | 44 passing; correct scope, actor, fingerprint, fresh-session/CSRF boundary, stored-response replay, and same-key transport retry. |
| `npm run validate` | Passed; copyright, migration, schema, ESM, image/topology policy, lint, server/client/script/integration tests, and production build all passed. |
| Local walkthrough Compose rebuild | Passed; local image rebuilt, app recreated and healthy on `127.0.0.1:47956`, bootstrap helper completed normally, `/healthz` reported zero pending migrations. |

## Open PR assessment

The checked-out local copy of open Dependabot PR #41
(`codex/pr-41-local`, `e210d0f`) was reviewed rather than merged. Its four
development dependency ranges are already present on `main`:
`@vue/language-server` and `@vue/typescript-plugin` at `3.3.10`, ESLint at
`10.8.1`, and `globals` at `17.11.0`. Applying that stale branch would discard
substantial later work, so it has no remaining change to apply locally.

Live PR status could not be refreshed because the local GitHub CLI credential
is unauthorized; this assessment is limited to the available local PR branch.

## Next recommended work

Extend the shared control-plane idempotency service with a durable
**in-progress reservation** only if same-key concurrent retries need an
explicit idempotency-specific `409`. That should be one generic migration and
recovery design with bounded stale-reservation handling, not a Music Queue
special case. The current shared-selection lock is already the correct
business-state protection for different candidates and different operators.
