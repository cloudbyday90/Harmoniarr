# Legacy Acquisition Client Cleanup — Outcome

## Status

Implemented and validated on 2026-08-27.

## Intended result

Remove only the unreachable former Music Queue/Acquisition workspace implementation. Preserve the canonical Missing Music → Downloader flow, legacy URL redirects, shared live helpers, multi-user authorization behavior, and user/history information.

## Implementation record

- Removed 31 unreachable client modules: the retired `MusicQueueView`, `AcquisitionView`, and `AcquisitionWorkspaceView`, plus the components, composables, and presentation helpers imported only by those views.
- Removed 22 tests that directly covered those retired modules, including one source-contract test that read `MusicQueueView.vue` from disk.
- Retained active Missing Music, Downloader, artist-detail, activity, and settings functionality even where a shared internal module still carries a historical `music-queue` or `acquisition` name.
- Retained all legacy route aliases. They remain redirect-only compatibility entries and continue to defer rendering and authorization to the canonical Missing Music or Downloader destination.
- No API, database, server authorization, user scope, request ownership, history, or visible navigation behavior changed.

## Validation record

`npm run validate` passed after the final cleanup:

- copyright, migration, schema snapshot, ESM, image-tag, and Compose-topology checks;
- lint and test-hygiene checks;
- 4,146 Node tests and 37 PostgreSQL-backed integration tests;
- production Vite client build and server build.

The first validation run identified one omitted source-contract test for the deleted view. It was removed as part of the same retired-view test set, then the complete suite passed.

## Open PR result

Dependabot PR [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) was assessed locally and intentionally not applied. Its requested build-push action version is older than the current pinned v7.3.0 workflow dependency, and its stale branch is not a narrowly applicable change.

## Follow-up recommendation

Plan a separate, compatibility-preserving terminology migration for the **reachable** internal `music-queue` and `acquisition` module names. Start by mapping their public imports and server correlations, introduce neutral Missing Music/Downloader names through small adapters, and remove aliases only after callers and tests have moved. Do not fold that rename into this deletion change: these live modules participate in artist progress, activity diagnostics, settings recovery, and Downloader handoff behavior.
