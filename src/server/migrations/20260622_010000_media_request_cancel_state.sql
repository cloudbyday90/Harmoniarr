-- Expand media_requests.request_state to support cancelled and failed states.
--
-- The application layer already references these states in dedup queries
-- (media_request_store.findActiveDuplicateRequest) and client presentation
-- (request-status.js STATUS_MAP), but the CHECK constraint did not include them.
-- This migration makes the constraint consistent with the application logic.

ALTER TABLE media_requests
  DROP CONSTRAINT media_requests_state_check,
  ADD CONSTRAINT media_requests_state_check
    CHECK (request_state IN (
      'already_exists',
      'cancelled',
      'failed',
      'needs_fetch',
      'needs_review'
    ));
