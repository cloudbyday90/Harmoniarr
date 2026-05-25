-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

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
