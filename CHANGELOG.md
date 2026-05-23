# Changelog

All notable changes to Harmoniarr will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Request cancellation: requesters can cancel their own open requests (`needs_fetch`, `needs_review`); admins can cancel any request. Cancelled state is persisted with append-only event trail and audit logging. `POST /api/v1/library/media-requests/:id/cancel` (authenticated, CSRF-protected).
- Migration `20260622_010000_media_request_cancel_state.sql` expands `media_requests.request_state` CHECK constraint to include `cancelled` and `failed` states (already referenced by dedup logic and client presentation).
- Server: `updateRequestState` store method, `cancelMediaRequest` service method with authorization checks (owner or admin), state validation, event insertion, audit trail, and activity event emission.
- Client: `cancelMediaRequest` API function, `isRequestCancellable` / `getRequestStateTone` presentation helpers, cancel button on `RequestDetailView` (header) and `RequestMusicView` (per-request row).
- Request list filtering and search (`72e95d2`): server-side `requestState`, `requestKind`, `search` (ILIKE), `limit`/`offset` pagination. Client: `useRequestListFilters` composable, `RequestListFilters.vue` controlled component.
- Import candidate fulfillment pipeline section on request detail view (`54ab165`): shows linked import candidate status with link to import review workspace.
- Admin reassign action on request detail view (`623d3a6`): `ReassignRequestModal` wired into `RequestDetailView`.
