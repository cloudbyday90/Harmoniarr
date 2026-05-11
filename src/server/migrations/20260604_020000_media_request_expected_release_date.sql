-- Add expected_release_date to media_requests to support pre-requests for
-- upcoming albums. Stores the anticipated release date so the fulfillment
-- UI can surface a "Coming Soon" indicator without polling discovery state.
ALTER TABLE media_requests ADD COLUMN expected_release_date DATE;
