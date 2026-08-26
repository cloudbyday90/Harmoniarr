# Acquisition release-to-transfer correlation outcome

**Completed:** 2026-08-26

## Delivered

- Added `acquisition-release-transfer-presentation.js`, a small ESM-only
  module that groups only live linked transfers by durable Music Queue release
  ID.
- Extracted `buildReleaseScopedDownloaderHandoff` so callers can reuse one
  route, visible label, accessible name, and boundary description without
  duplicating query construction.
- The Acquisition overview now adds a compact **Download progress** line to a
  linked Release work row, such as `1 transfer is downloading; 1 transfer is
  waiting`.
- A linked Release work row and its matching Download progress row both use
  **View download progress** and open
  `/app/downloader?wantedReleaseId=…`; the new handoff contains neither a
  provider username nor a transfer ID.
- The Home progress strip continues to open release details, preserving its
  lightweight overview role.

## Outcome

An administrator can now tell that a release has a verified live transfer and
open the correctly scoped Downloader view directly from either Acquisition
lane. Music Queue continues to own decisions; Downloader continues to own
transfer controls. An unlinked transfer remains visibly separate instead of
being guessed into a release relationship.

## Validation evidence

The focused unit suite covers:

- exact `wantedReleaseId` grouping of active and queued transfers;
- rejection of filename/provider-identity fallback;
- release-scoped labels and routes;
- Acquisition transfer action routing; and
- preservation of Home's release-detail route.

The browser scenario verifies two named **View download progress** links for a
linked transfer and asserts their URLs contain only `wantedReleaseId`, not the
fixture provider username or transfer ID. Repository lint, build, validation,
and security results are recorded with the implementation commit.

## Next recommended item

Run the strict local provider acceptance probe only after an operator has
explicitly authorized a real, locally configured peer-to-peer transfer. The
probe should confirm the recorded `wantedReleaseId` relationship survives the
full Music Queue -> Downloader lifecycle. Do not manufacture a live provider
transfer merely to satisfy test evidence.
