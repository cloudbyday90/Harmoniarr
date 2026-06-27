BEGIN;

ALTER TABLE activity_events
  DROP CONSTRAINT IF EXISTS activity_events_event_type_check;

ALTER TABLE activity_events
  ADD CONSTRAINT activity_events_event_type_check
  CHECK (event_type IN (
    'request_created',
    'download_completed',
    'release_added',
    'artist_monitored',
    'artist_policy_saved',
    'request_fulfilled'
  ));

COMMIT;
