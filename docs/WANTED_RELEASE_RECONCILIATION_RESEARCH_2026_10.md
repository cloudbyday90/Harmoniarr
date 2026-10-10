# Wanted-release reconciliation research

Client task date: **October 10, 2026, America/New_York**. Observed host:
2026-10-10T07:56:43.5588539-04:00; observed UTC: 11:56:45 UTC.
Node v24.18.1 and npm 12.0.2 were read directly. The parent supplied clean-main
baseline `96d1f56`; root baseline verification is separate. PostgreSQL 18 below
is the consulted documentation version, not the observed database version.

The initial verified draft preceded the new wanted-reconciliation runtime changes.
Consultation dates are separate from publication dates.

## Existing boundary and minimum owning contract

The baseline wanted service reads monitoring, metadata artist/releases, release
selections, track overrides and release reconciliation through several awaited
calls, then invokes a raw replacement that starts its own transaction. Ordinary
producers include scan, generic discovery and metadata refresh. The raw writer
also serves authorized backup restore while maintenance is active. These paths
have different authority; a scan-only or blanket maintenance refusal in the raw
writer would break legitimate callers.

Accepted ordinary API: optional workerContext for library_scan,
library_discovery_dispatch and metadata_artist_refresh. Capture the original
run/type/acquisition before the first await. Omitted context retains the internal
direct rebuild contract; a present null, undefined or malformed context refuses
instead of falling back. Forward the actual metadata worker context through
refresh. Scoped recovery discovery retains its global-reconciliation skip.
Backup restore stays on the separate raw contract under its own maintenance
authority; no fabricated scan lease or live-policy rebuild is imposed.

For ordinary reconciliation, use a short caller-owned transaction, explicitly
READ COMMITTED before the first maintenance/source query, ordered operation/lease
fences when context exists and one shared publication advisory key. Both raw
wanted and raw discovery publishers acquire it before their parent mutations,
because they synchronize the same links. Locking only inside link sync is too
late for the identified reciprocal publisher pattern. This coordinates those
two paths, not all source/manual/FK writers or discovery's cached-source rebuild.
Capture fresh decision-input frames and wanted rows after admission. Compare
both before DELETE, one bulk upsert, required link sync and final commit check;
refresh authority/time after awaited source reads. Refusal, lost authority,
incomplete mutation or link failure rolls back the complete publication. No
cached projection retry is added.

Preserve current desired-state, explicit selection, missing/partial, date,
count and evidence semantics through existing metadata/read/projection factories.
The accepted adapter uses a new narrow getArtistWantedProjection method with
existing repository SQL and release/group mappers, avoiding alias, detection,
legacy monitoring, provider and cache reads. Bind monitoring, selections,
overrides and availability to that same client. A pool-bound or cached getArtist
is not a freshness substitute. The existing minimal getArtistProjectionInputs
shape omits release fields consumed by wanted projection and is not equivalent.
Clone monitoring before later metadata awaits and metadata/selection/override
inputs before availability awaits. Compare normalized input frames and derived
rows, excluding only verified unused timestamps.

Current monitoring/object policy remains part of projection input. Existing
disabled-account projection semantics are preserved; this slice adds no actor
eligibility cleanup or new role filter. The schema's app_users.is_disabled is
relevant to separate downstream active-target authorization, which remains its
owner. Wanted rows are saved derived intent, not permission for a new acquisition.
OWASP does not define that application policy or historical restore semantics.
Preserve the pair (appUserId, metadataReleaseId), not independent columns.

The adapter performs several SELECTs under READ COMMITTED. Each statement has
its own snapshot; a whole projection pass is assembled from component snapshots,
not necessarily one global instant. Repeated full-value comparison establishes
observed output stability only. Source commits after a component's final read
may require another pass. It does not provide strict commit freshness, one
global snapshot, physical-file identity or distributed exactly-once behavior.

## Primary findings and consultation status

| Discovered/opened source | Classification / version | Decision it informs |
| --- | --- | --- |
| [SET TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html) | PostgreSQL 18 command documentation | READ COMMITTED uses statement snapshots; isolation must be set before the transaction's first query or data-modification statement. Do not depend on the host default. |
| [Explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | PostgreSQL 18 database documentation, reached via the 18 navigation link on the discovered 17 page | Advisory admission is cooperative; row/FK/table modes and lock order differ. It does not freeze source producers. Avoid a broad source-lock or universal deadlock claim. |
| [Array functions](https://www.postgresql.org/docs/18/functions-array.html) | PostgreSQL 18 database documentation | Multi-array UNNEST zips storage-order values and pads shorter arrays with SQL NULL. Build all arrays from the same validated rows and preserve exact paired keys. Independently filtering arrays can change ownership pairs. |
| [Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) | PostgreSQL 18 documentation, reached through the versioned concurrency chapter | READ COMMITTED refreshes each statement snapshot; successive queries can see different commits. Several same-client component reads are not one global snapshot. |
| [INSERT](https://www.postgresql.org/docs/18/sql-insert.html) and [DELETE](https://www.postgresql.org/docs/18/sql-delete.html) | PostgreSQL 18 command documentation | RETURNING covers rows actually inserted/conflict-updated or deleted. Verify complete unique composite identities; a zero-row result is not inherently a SQL error. |
| [Date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html) | PostgreSQL 18 documentation, reached via supported-version navigation from a discovered 17 page | clock_timestamp supplies actual time after waits/reads; NOW remains transaction-start time. Mutation timestamps are not commit acknowledgement timestamps. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Informative Understanding guidance for WCAG 2.2 criterion 4.1.3 | Existing job status should describe actual accepted work. No frontend change, speech test or full conformance follows from this backend research. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Informative security guidance | Deny by default; validate server-side object/actor relationship and relevant current attributes. A background intent or visible UI is not continuing authority. Exact application policy remains a project decision. |

For bulk persistence, require complete unique returned composite identities and
verify expected deleted pairs, including a current empty projection. Preserve
raw restore compatibility deliberately, including any accepted last-value
duplicate handling, rather than apply ordinary projection policy to imported
history implicitly. SQL rollback/cardinality, source drift, lease waits and
all-producer wiring need actual PostgreSQL and service evidence.

## Required evidence and bounds

Delay nested metadata/projection reads and change monitoring, explicit selection,
track overrides or release availability. Preserve disabled-account projection
controls separately from downstream active-target authorization. Include another
user wanting the same release: pair identity must stay intact. Exercise new rows,
empty cleanup, admission waits, original acquisition replacement/expiry,
DELETE and bulk-upsert failures, exact RETURNING sets and link-sync/final rollback.
Prove scan, discovery and metadata refresh still use their actual owners; prove
authorized backup restore still runs under its own maintenance authority.

No tests, database, provider, parser, browser or Git operation were executed for
this research. The frontend is unchanged; W3C status guidance will be consulted
only for truthful existing job reporting, without a new control/dialog/live-region
or conformance claim. Host versions do not establish deployed container/database
versions. Source/FK conflicts can still abort publication; ordinary safe rollback
is required, not a promise of universal deadlock freedom.
Draft save observed at 2026-10-10 12:00:58 UTC.

## Retained evidence and separate PR assessment

The initial verified draft preceded the new runtime changes. Its original raw
responses remain in `research-draft.json`, SHA256
`653bda050d7980623f9cf48a453327edb79b074f4af10c814e4c23967d4d540e`.
The final ledger incorporates the accepted optional-context, narrow-reader,
source-frame comparison, disabled-projection and shared-publication refinements.

Ignored raw evidence under `.tmp/wanted-release-reconciliation-2026-10/`:

| Evidence | SHA256 |
| --- | --- |
| repository-discovery.json | 695348606a3f9b320b2fee8fc21e7737cc4bb37142819b942f202b67295d9025 |
| official-research.json | 756146df023c84d9777d1022509eb6c867434b205fc4c7ac4477e819c797155c |
| open-pr-evidence.json | db0364b067cdaf97e7a45d467b04357779a116d0d3e541f22d5403909372da35 |
| source-boundary-observation.json | 26531abe6bda4e39a2cbf1cc5a460575f760f4c3d740e4fc565c6b1084ea9835 |

Official discovery used search results and actual version-navigation links.
Version-targeted searches sometimes returned older pages; the relevant 18
pages were reached and opened through official navigation, rather than assuming
a source URL or claiming a newer running database.

Separate [PR design](OPEN_PR_APPLICABILITY_WANTED_RELEASE_2026_10_DESIGN.md)
and [outcome](OPEN_PR_APPLICABILITY_WANTED_RELEASE_2026_10_OUTCOME.md) retain
fresh repository discovery, explicit terminal empty pages and exact immutable
head/base/state plus complete filename comparisons. Only unchanged locally
replayed PRs 23, 24 and 40 were observed. Eligible set: empty; draw/replay: N/A.

## UUID pair identity defect and verified closure

A bounded source review found that raw restore preserved accepted UUID input
spellings while deduplication and mutation verification compared their original
text. SQL UUID casts and RETURNING instead used canonical values. A valid
uppercase/braced/compact pair could therefore be mistaken for an omitted or
foreign pair; equivalent spellings could also evade last-value deduplication.

The [official PostgreSQL 18 UUID documentation](https://www.postgresql.org/docs/18/datatype-uuid.html)
accepts uppercase digits, braces and optional hyphens after four-digit groups,
while output uses the standard lowercase/hyphenated form. This page was discovered
through a returned 17 UUID page and its actual supported-version 18 link.
Raw search/open/navigation evidence was recorded at **2026-10-10 12:31:43 UTC** in
`uuid-restore-identity-source.json`, SHA256
`75a4a39b45c48a18721716842720710ba244e6a0413d4f16680e932fd01e1475`.
That is the recording time, not a separately captured timestamp for each HTTP call.

The root's patch adds canonicalUuidText/canonicalizeWantedPair and canonical
paired identity before raw last-value deduplication, persistence arrays and
returned keys. The same pair helper covers expected deletion and written sets.
Documented spelling variants now identify the same SQL pair; malformed forms
retain SQL rejection. Ordinary captured rows and original worker contexts retain
their strict UUID validation. This changes identity representation, not restore
authority, source freshness or permission to acquire music.

The root implemented the normalization and inspected the retained results.
**product_experience executed the injected unit tests; backend_architecture
executed the PostgreSQL tests.** This reviewer inspected source/logs and ran none:

| Evidence | Observed result / boundary | SHA256 |
| --- | --- | --- |
| .tmp/wanted-release-reconciliation-2026-10/wanted-uuid-alias-red.log | product_experience injected store regression: 0 pass, 1 fail, 0 skip; library_wanted_projection_incomplete | 04cd3c9e4e88bb7bca0bb8f5b7190c70853207cbfc93bd90903d0a4787fd83b5 |
| .tmp/wanted-release-reconciliation-2026-10/wanted-uuid-alias-green.log | Same product_experience injected regression: 1 pass, 0 fail, 0 skip | 6331b76ea33b72772a76ff1e871a4478fc67780f5cca912ff1c24fe2c9a2975c |
| .tmp/wanted-release-reconciliation-2026-10/wanted-uuid-alias-focused.log | product_experience focused owner/service/store/publication suites: 66 pass, 0 fail, 0 skip | 501d4ef8fe7a14f312bf7daf6c2f02446b5c2689c55c2111660b6f13fc2185f3 |
| .tmp/wanted-reconciliation-2026-10/backend-restore-uuid-red.log | Backend actual PostgreSQL restore-scope adapter regression: 0 pass, 1 fail, 0 skip; same completeness refusal | 3eb34f77754235df9d0af1cba1327ff0213a70f56c016296da010731136f34e6 |
| .tmp/wanted-reconciliation-2026-10/backend-restore-uuid-green.log | Same backend actual PostgreSQL regression: 1 pass, 0 fail, 0 skip | d926bee8ac2f6892b3f1b37af656d48fa8cd3c79be911b484400f2521faea43e |
| .tmp/wanted-reconciliation-2026-10/backend-postgres-canonical-uuid.log | Complete backend new reconciliation suite: 9 pass, 0 fail, 0 skip | 9def759467327dd94d8cc076184473312293241c8445b3d092b6e5bdb65cb223 |

The isolated backend logs identify the test fixture as PostgreSQL 18.3 on Linux;
this is evidence about that executed fixture, not an independently inspected
deployed database. They exercise the actual restore-scope adapter/raw writer and
preservation of existing wanted-row/link identity. They do not establish an HTTP
administrator/session flow, archive upload or whole backup-restore atomicity.
The source reread found no remaining mismatch in this bounded UUID closure.
Initial official-source and PR evidence remains unchanged. Full-gate and broader
execution outcomes belong to the root's separate outcome ledger.

## Observed node-postgres single-client queue deprecation

A completed root validation run emitted an actual node-postgres deprecation
before the wanted integration suite. The original warning text remains in
the retained stdout archive below. The parent reported exit 0; the warning is
a driver compatibility finding, not an invented failing test or proof that
PostgreSQL executed statements concurrently.

Read-only host inspection at **2026-10-10 13:02:58 UTC / 09:02:58 EDT** found
both package-lock and installed pg at **8.23.0**. The installed manifest's gitHead
is `df274d1ba9ad9d11a8f1079314faeafde7208207`. Fresh GitHub MCP repository
discovery/metadata, the exact commit's returned complete tree and discovered
file paths verified the same version in its immutable package manifest.

| Discovered/opened primary source | Status / relevant guidance |
| --- | --- |
| [node-postgres client API](https://node-postgres.com/apis/client) | Driver API documentation, consulted October 10; describes the Promise query interface and explicit client configuration. |
| [Pooling](https://node-postgres.com/features/pooling) | Driver guidance: work on one connected client is processed serially; pooling can serve independent work on different clients. This is not permission to move this transaction's statements to pool.query. |
| [Transactions](https://node-postgres.com/features/transactions) | Driver guidance: every statement in one transaction must use the same client instance; pool.query cannot substitute for that ownership. |
| [Immutable pg 8.23.0 client source](https://github.com/brianc/node-postgres/blob/df274d1ba9ad9d11a8f1079314faeafde7208207/packages/pg/lib/client.js) | Official source at the installed gitHead. The default non-pipeline queue path raises the installed deprecation notice for queued overlapping client calls and recommends await/flow control. The notice announces a pg@9.0 removal plan; this ledger does not assert a pg9 release or compatibility with future versions. |

The correction must serialize artist preparation and policy queries on the
existing transaction client. The reachable narrow metadata method's release-group
and release queries also require sequential awaits; fixing only the outer artist
loop would leave same-client overlap inside that method. No dependency upgrade
or pipelining feature adoption is implied. Awaiting each client operation avoids
reliance on deprecated driver queue behavior while keeping the transaction intact.

This is separate from PostgreSQL 18 READ COMMITTED semantics. Sequential driver
calls still read several component snapshots; they do not create a single global
snapshot, freeze source producers or strengthen commit-time freshness. Retain
the existing input capture, current authority and publication revalidation.

| Retained evidence | SHA256 / scope |
| --- | --- |
| .tmp/wanted-release-reconciliation-2026-10/pg-client-overlap-research.json | 6fa64f68c170fa8f57664467a5e4883b7fe377514998e9154fd87ea0a3141960; actual version, official discovery/navigation, immutable source and warning observations |
| .tmp/wanted-release-reconciliation-2026-10/full-validate-pg-overlap-preserved-20261010-1303.log | 87c9bc9a1600c63317f12c4ff8042846dc61d34e24b038863d9a80a6d20b73fb; preserved root stdout, exact warning at line 10393 |

The immutable client blob is
`7a2fc9a649344855b9fcf7183463cfddec825aeb`; package manifest blob is
`d028179cafc85c384a1b76b44b5513c8305909df`. Installed manifest metadata and source
inspection are not an independent byte-for-byte package integrity audit.
This reviewer ran no tests, PostgreSQL, runtime or Git operations. Warning
absence after correction and final validation remain the root/backend's executed
evidence; this research note does not claim those pending results.
