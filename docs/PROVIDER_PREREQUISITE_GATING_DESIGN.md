# Provider Prerequisite Gating Design

Status: Implemented
Date: 2026-06-27

## Scope

This document covers the follow-up after system alert hardening: background
jobs should not queue work that depends on an unconfigured provider. The
immediate target is Library discovery dispatch, which depends on Soulseek
through slskd.

## Official Sources Reviewed

- slskd configuration documentation: https://github.com/slskd/slskd/blob/master/docs/config.md
- MusicBrainz API documentation: https://musicbrainz.org/doc/MusicBrainz_API
- MusicBrainz rate limiting documentation: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OWASP Error Handling Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html

## Findings

- slskd is an external dependency with explicit configuration and API-key
  requirements. A missing API key is a setup state, not a runtime failure.
- MusicBrainz is a public dependency that can be temporarily unavailable or
  rate-limited. That remains a paused runtime state, not a local setup state.
- Harmoniarr already had dependency-health checks for `slskd` and
  `musicbrainz`, but Library discovery did not consult slskd readiness before
  queuing `library_discovery_dispatch` runs.
- Topbar operator notifications intentionally alert on heartbeat `paused` or
  `error` states. Therefore an unconfigured provider should use a separate
  `setup_required` heartbeat state if the goal is to show a calm setup hint
  without creating alert noise.

## Options Considered

### Option A: Let Discovery Dispatch Queue And No-op In The Worker

Pros:

- Minimal wiring change.
- Keeps all dependency checks in the worker path.

Cons:

- Still creates operation runs for known setup gaps.
- Background Jobs and Notifications can imply a system failure when the system
  is simply not configured yet.
- Wastes queue capacity.

### Option B: Gate Discovery Heartbeat On slskd Readiness

Pros:

- Prevents known-unrunnable work from entering the operation queue.
- Preserves real paused/error alerts for transient provider failures.
- Lets overview surfaces display setup guidance without generating topbar
  failure notifications.

Cons:

- Manual discovery actions may still need route/service-level provider
  readiness handling in a later slice.
- Requires a new small policy service and startup wiring.

### Option C: Disable All Discovery Features Until slskd Is Configured

Pros:

- Strongest prevention for unconfigured provider access.

Cons:

- Too broad for this slice. Some Discovery and metadata views are useful
  without Soulseek provider dispatch.

## Final Recommendation Stack

1. Add a library discovery dispatch policy service that interprets dependency
   health for slskd.
2. Treat `slskd_not_configured` / disabled as `setup_required`, not `paused`.
3. Keep unavailable, degraded, unauthorized, or misconfigured slskd states as
   paused operational states because they require operator attention.
4. Wire the policy into the Library discovery heartbeat before snapshot reads
   or run creation.
5. Keep notification behavior unchanged except to explicitly ignore
   `setup_required` heartbeat hints.

## Outcome

Implemented:

- `library-discovery-dispatch-policy-service.js` maps slskd dependency health
  into `allowed`, `setup_required`, or `paused` readiness.
- `library-discovery-heartbeat.js` now checks slskd dependency health before
  reading discovery snapshots or queuing a run.
- `pausable-heartbeat-state.js` preserves provider/code/message metadata for
  `setup_required` states.
- `heartbeat-overview.js` renders `setup_required` as a non-error setup state.
- `system-service.js` provides operator-facing setup copy for Discovery
  dispatch.
- `startup-runtime.js` wires dependency health and the new policy into the
  Library discovery heartbeat.
- `operator-notification-service.js` remains alert-only for paused/error
  heartbeat states and now has explicit coverage proving setup hints do not
  generate topbar alerts.

Follow-up:

- Browser verification for the operator overview/topbar behavior on an
  unconfigured walkthrough stack is implemented through
  `DOCKER_PROVIDER_SETUP_STATE_BROWSER_VERIFICATION_DESIGN.md`.
- Consider route-level setup responses for manual slskd-backed actions so user
  initiated searches produce the same calm setup language.
