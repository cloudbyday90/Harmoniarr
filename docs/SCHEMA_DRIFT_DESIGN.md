# Read-only schema drift design

## Command and ownership

`npm run diagnose:schema` runs `scripts/diagnose-schema.js`, a thin ESM wrapper
around the packaged `src/server/diagnose-schema.js` entrypoint. Containers can run
`node /app/server-dist/diagnose-schema.js` directly. Existing migration diagnostic
commands keep their APIs, output and exit behavior.

The new command observes existing schema only. It does not call bootstrap,
migrations, schema creation, business maintenance acquisition or repair. No
runtime service, dependency, table, migration or release version is added.

`schema-drift-service.js` loads the current manifest, raw snapshot and validated
packaged anchor contract before connecting. A stale/missing contract refuses
without database admission. It delegates client ownership to
`schema-observation-owner-service.js`, SQL to `schema-observation-store.js`, and
projection/formatting to `schema-drift-report-policy.js`. The existing pure anchor
policy now owns a shared names-only comparison used by bootstrap and diagnostics.

## Observation protocol

Require an idle client with no inherited preparation-key ownership. Start
`BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY`, explicitly overriding role
isolation defaults. Set local lock timeout 2s, statement timeout 5s, idle transaction
timeout 5s and transaction timeout 15s. Attempt a shared transaction-level lock
using the exact HARM/PREP two-integer namespace already used by preparers.

Readers coexist; an active exclusive preparer causes immediate diagnostic busy
refusal, and a held observation causes a participating preparer to return its
existing busy result. No waiting queue or second lock namespace is introduced.
The shared key is automatically released by transaction completion. Read-only
observation remains available during ordinary backup/application activity; it
does not acquire or mutate business maintenance locks.

Read only the public ordinary migration table, qualified explicitly. A missing or
wrong-kind ledger becomes unavailable; it is never created or replaced. Read at
most manifest length plus one rows (currently 116) and omit stored error messages.
Excess rows mean not-current with an explicitly incomplete bounded-prefix count.
Use the existing lineage comparison for normal bounded rows, projecting only
counts. Permission/query failures make the diagnostic unavailable, not clean.

Read the same 164 catalog facts and canonical local deparser context used by
bootstrap. Compare privately against independent trusted expected facts. Return
separate lineage and critical-anchor states, counts and approved missing/altered
identities. Definitions, function bodies, unknown filenames, checksums and stored
errors never enter the result. The expected contract is unchanged.

Always ROLLBACK, even after a successful read. Accept a result only after its
ROLLBACK command acknowledgement and idle status. Error/end events separately
track connection liveness; cached ReadyForQuery state is insufficient. Failed
BEGIN, inherited ownership, disconnect or uncertain rollback discards the client.
Preserve primary Error/null across rollback/release failures and never retry.

## Output and limits

Exit 0 means both lineage and critical anchors are current. Exit 1 means attention,
busy or unavailable; text identifies which. Expected failures are bounded fixed
messages. Internal causes remain private. CLI reporting/cleanup reuse the existing
migration CLI lifecycle; this is repeatable observation, not one-time secret
delivery. Human receipt or general broken-pipe reliability is not established.

The server transaction limits do not bound filesystem reads, pool connection
admission or transport delivery. Existing connection-timeout configuration still
applies. External DDL, old binaries and arbitrary SQL that ignore HARM/PREP can
invalidate or race a scan; quiesce them for authoritative investigation. Read
Committed is deliberate: a repeatable-read snapshot created by the lock-acquisition
SELECT could precede a just-completed preparer. No global snapshot/coherence claim
is made against uncoordinated actors.

This scan covers critical selected facts, not every schema property, permission,
function dependency or external SQL effect. Existing nonempty startup admission
is unchanged. Future UI integration needs administrator-only access, no-store,
bounded refresh and accessible status announcements, with separate acceptance.

See [research and tradeoffs](SCHEMA_DRIFT_RESEARCH.md),
[outcome](SCHEMA_DRIFT_OUTCOME.md) and
[Docker validation design](LOCAL_DOCKER_SCHEMA_DRIFT_DESIGN.md).
