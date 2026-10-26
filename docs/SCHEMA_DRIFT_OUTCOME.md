# Read-only schema drift outcome — October 26, 2026

## Delivered behavior

`npm run diagnose:schema` now observes existing schemas without bootstrap or
repair. It compares bounded migration lineage and 164 critical catalog facts,
reporting those states independently. The command returns exit 0 only when both
are current; attention, busy or unavailable return exit 1 with distinct text.

Small ESM store, owner, report-policy and service modules reuse the current
packaged expected contract and preparation namespace. A shared pure comparison
also serves snapshot bootstrap. No table, migration, dependency or second runtime
service was added; existing startup and migration diagnostic behavior remains.

The observer explicitly overrides role isolation defaults with Read Committed /
Read Only, sets local 2s lock, 5s statement/idle and 15s transaction limits, and
obtains a nonwaiting shared transaction lock on HARM/PREP. Readers can coexist;
conflicting preparers or observers refuse admission. Successful results require
acknowledged ROLLBACK and idle status. Broken/dirty/inherited connections are
discarded, primary Error/null survives cleanup failure, and no retry occurs.

Lineage reads are public-table qualified and capped at 116 rows. Overflow is
explicitly incomplete, not a fabricated full count. Missing ledgers are not
created; unreadable state is unavailable. Results contain approved counts and
missing/altered anchor identities. Raw function bodies, SQL, stored errors,
unexpected filenames and checksums stay private.

## Validation

The focused owner/comparison/bootstrap/reader/CLI cohort passed 44 tests. The
complete fast gate passed 6,198 server, 4,497 client and 703 script tests without
failures, skips or cancellations, plus static checks, lint and build. npm audit
reported zero vulnerabilities. The frozen fingerprint covers 3,674 source files;
all 11 changed code files are bound to that stable candidate.

The immutable no-cache image
`sha256:50d449db7c63f7e0f4a10eca673643fe2cd60e9bf49d28695124bf5f6a17733e`
passed the new 12-case native diagnostic fixture:

| Case | Observed result |
| --- | --- |
| Restricted role and both actual CLI entrypoints | Current state; ledger/catalog/function fingerprint preserved; child processes closed |
| Concurrent readers versus preparer | Readers coexist; writer callback never enters while shared fence is held |
| Active preparer versus readers | Service and actual CLI refuse immediately as busy |
| Missing index | Matching lineage with structural drift; no repair |
| Required column made nullable | Structural drift; no repair |
| Root-authority trigger disabled | Structural drift; no repair |
| Failed ledger row | Noncurrent lineage with current anchors; private stored error omitted |
| Ledger SELECT revoked | Fixed unavailable result; no raw permission/SQL material |
| Empty database | Ledger unavailable and 164 missing anchors; no schema creation |
| Actual ACCESS EXCLUSIVE ledger lock | Real configured lock timeout; fence retired |
| Permanent CREATE attempt in observer | PostgreSQL read-only refusal; no relation or leaked lock |
| Actual backend termination | Client discarded despite cached protocol state; preparation key retired |

The fixture role had no superuser, create-role or create-database capability and
only schema usage/ledger SELECT. Its default isolation was deliberately Repeatable
Read; observer settings were verified as Read Committed. The two acknowledged
owned databases, restricted role and test container retired with absence verified.

On that same immutable image, the affected regressions passed: all 17 snapshot
scenarios (including missing/altered-anchor rollback and actual COMMIT loss), six
preparation serialization cases, the 12 migration CLI reader cohorts and the
concurrent observation/backup fixture with 20 reads and three encrypted artifacts.
All five native fixture containers retired. Live status, checksum, lineage and
new structural diagnostics preserved ledger/catalog identity at 115 applied
migrations. Native-library and entrypoint identities match prior qualification.
The configured data-bind probe removed its owned workspace. See the Docker
outcome for the explicitly retained, rather than rerun, recovery matrices.

## Recommendation and limits

Recommended stack: trusted contract → captured read-only client → local server
limits → shared preparation fence → bounded ledger/catalog comparison → separate
state projection → acknowledged rollback → names-only output. Benefit: useful
drift investigation without mutation authority or a second service. Costs:
catalog work, additional round trips and possible brief busy refusal for preparers.

The fence coordinates participating code, not arbitrary external SQL or old
binaries. The selected facts do not prove all permissions, dependencies or SQL
semantics. Connection/filesystem/transport timing remains outside the server
transaction limits. Existing startup admission and repair policy are unchanged.
No markup changed; manual AT/device acceptance remains deferred.

GitHub MCP found no open repository or Dependabot PRs. Random local application
and stale cleanup/rebase were inapplicable; no PR was merged. Work stays on main,
with no new branch, release or tag.

Next: expose this bounded summary in the existing administrator diagnostics,
using current authorization, no-store, explicit refresh and accessible
current/attention/unavailable status. Keep repair and startup admission separate.
See [research/pros and cons](SCHEMA_DRIFT_RESEARCH.md),
[design](SCHEMA_DRIFT_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_SCHEMA_DRIFT_OUTCOME.md).
