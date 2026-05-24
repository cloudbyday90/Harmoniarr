-- Composite index for keyset (cursor-based) pagination on media_requests.
--
-- The cursor-based listMediaRequests query uses row-value comparison:
--   WHERE (created_at, id) < ($N, $N)
--   ORDER BY created_at DESC, id DESC
--
-- Without a matching composite index the planner falls back to a sequential
-- scan with an external sort.  With this index it can perform a backward
-- index scan that satisfies both the filter and the ORDER BY in a single
-- pass, giving O(log n) page lookups at any depth.

CREATE INDEX IF NOT EXISTS idx_media_requests_created_at_id_desc
  ON media_requests (created_at DESC, id DESC);
