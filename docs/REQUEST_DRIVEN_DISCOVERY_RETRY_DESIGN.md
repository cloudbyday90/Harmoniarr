# Request-Driven Discovery Retry Design

Status: Implemented
Date: 2026-06-28

## Problem

Submitting a Missing or Release Detail request creates a `media_requests` row, but
the matching `library_discovery_requests` row can remain behind an automatic
cooldown from earlier monitored-release discovery. In local Docker validation,
slskd showed successful searches while Harmoniarr produced no import candidates;
the affected discovery rows had been claimed before a later persistence failure
and then reconciled back into cooldown with no recorded search result.

The user-facing symptom is bad: clicking `Request` appears to do nothing, and
the Downloader remains empty.

## Researched Guidance

- OWASP API Security recommends minimizing writable/object-level surface and
  not trusting client-controlled properties for authorization decisions:
  https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
- PostgreSQL's `INSERT`/conflict and typed-expression documentation supports
  keeping state changes explicit and typed at persistence boundaries:
  https://www.postgresql.org/docs/current/sql-insert.html
- Playwright recommends user-visible locators and actionability-driven checks
  for browser verification:
  https://playwright.dev/docs/locators and
  https://playwright.dev/docs/actionability
- Docker bind mounts are the correct mechanism when an application container
  must see host-managed files produced by another container or service:
  https://docs.docker.com/engine/storage/bind-mounts/

## Options Considered

1. Convert request-driven discovery rows to `manual`.
   - Pros: Simple model for explicit user intent.
   - Cons: Current dispatch only claims `search_mode = 'automatic'`, so this
     would make request rows visible as ready but not dispatchable.

2. Always clear cooldown for media-request-backed rows.
   - Pros: Requests would appear responsive immediately.
   - Cons: A request that already searched and found no candidates would be
     re-queued on every reconciliation cycle.

3. Keep request-backed rows automatic, but prioritize request intake only when
   it is a new request, newer than the last search, or an interrupted claim has
   no recorded result or failure.
   - Pros: Preserves the automatic dispatcher, bypasses stale cooldowns for
     explicit requests, retries interrupted claims once, and avoids continuous
     background search loops.
   - Cons: Does not solve completed-download visibility by itself; external
     slskd download folders still need container path mapping.

## Final Recommendation

Use option 3.

The implementation adds `source_requested_at` to request-backed discovery rows
and a small request-intake readiness policy in
`library-discovery-request-service.js`.

Request-backed rows now become `ready` while staying `search_mode =
'automatic'` when:

- no prior search exists for that release,
- the media request was created after the last discovery search, or
- the last claim has no recorded `lastSearchResult`, `searchExhausted`, or
  `lastDispatchFailure`.

Rows that already have a recorded search outcome stay under the normal cooldown
and exhaustion policy.

## Security Outcome

- No new privileged route was added.
- Client input does not decide dispatch state directly; the server derives
  request intent from persisted `media_requests` rows and existing discovery
  evidence.
- Provider secrets, raw slskd payloads, and filesystem paths are not copied into
  discovery evidence.
- The fix remains modular and ESM-only.

## Validation

- `node --test test/server/library-discovery-request-service.test.js`
- `node --test test/server/library-discovery-request-store.test.js`

## Follow-Up

The next high-value item is discovery response ingestion diagnostics. slskd can
return search responses while Harmoniarr still creates zero candidates because
responses are filtered by quality, tracklist, format, ownership, or provider
payload shape. Wanted and Import Review should expose a bounded "why no
candidates" summary for those cases.
