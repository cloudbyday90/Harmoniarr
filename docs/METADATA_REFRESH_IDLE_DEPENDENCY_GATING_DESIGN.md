# Metadata Refresh Idle Dependency Gating Design

Status: Implemented
Date: 2026-06-27

## Scope

This document covers a follow-up found during clean Docker walkthrough
verification: Metadata refresh reported `MusicBrainz is temporarily
unavailable` as a topbar alert even when the reset walkthrough had no monitored
artists and no metadata refresh work due.

## Official Sources Reviewed

- MusicBrainz API documentation:
  https://musicbrainz.org/doc/MusicBrainz_API
- MusicBrainz rate limiting documentation:
  https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- OWASP Logging Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OWASP Error Handling Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html

## Findings

- MusicBrainz availability matters when Harmoniarr has metadata refresh work to
  dispatch.
- On an idle system, probing MusicBrainz before checking due work can turn an
  irrelevant transient external outage into a user-facing operator alert.
- Maintenance locks are local operator-controlled safety states and should still
  be checked before scheduler reads.

## Options Considered

### Option A: Keep Dependency Check First

Pros:

- Fails early before any scheduler reads.
- Preserves previous paused-state behavior for all MusicBrainz outages.

Cons:

- Noisy on clean or idle systems.
- Creates alerts for external conditions that do not currently block any work.

### Option B: Check Due Work Before External Dependency Health

Pros:

- Keeps clean idle systems calm.
- Still pauses before dispatching when MusicBrainz is unavailable and an artist
  is due.
- Avoids unnecessary external probes.

Cons:

- Requires scheduler lookup before provider-readiness checks.

### Option C: Suppress All Metadata Refresh Paused Alerts

Pros:

- Removes topbar noise.

Cons:

- Hides real blocked refresh work when monitored artists are due.

## Final Recommendation Stack

1. Keep maintenance-lock readiness first.
2. Query the metadata refresh scheduler for a due artist.
3. If no artist is due, record `not_due` and do not probe MusicBrainz.
4. If an artist is due, evaluate MusicBrainz dependency readiness before
   queueing the refresh run.
5. Preserve paused alerts for real due-work dependency failures.

## Outcome

Implemented:

- `metadata-refresh-heartbeat.js` now checks for due refresh work before
  calling MusicBrainz dependency health.
- Focused heartbeat coverage proves idle ticks do not probe dependencies.
- Existing paused behavior remains covered when a due artist exists and
  MusicBrainz is unavailable.

Follow-up:

- Route-level setup responses for manual slskd-backed actions remain the next
  provider-readiness enhancement.
