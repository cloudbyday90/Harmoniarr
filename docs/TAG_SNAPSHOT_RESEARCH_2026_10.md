# Tag snapshot ownership research

Read-only primary-source research, 9 October 2026 local / 10 October UTC.
Root reports clean main cab4e73. Host clock at discovery:
2026-10-09T22:28:16.9219569-04:00 / 2026-10-10 02:28:17 UTC.
Local commands observed Node 24.18.1/npm 12.0.2. These are host observations,
not deployed-container or running PostgreSQL proof.

The [prior scan outcome](SCAN_CATALOGUE_OUTCOME.md) identifies awaited metadata
extraction followed by unguarded snapshot/file persistence as the next boundary.
It also identifies broad failure fallback as a risk of a second stale snapshot.
This research reads that finding and official sources; it does not independently
inspect or execute the current Harmoniarr tag owner.

## Fresh official guidance

MCP discovery supplied publisher URLs; canonical PostgreSQL 18 navigation and
W3C publication history supplied selected versions. Detailed reads continued
through 10 October 02:35:15 UTC.

| Primary source | Authority/version | Applicable guidance |
| --- | --- | --- |
| [PostgreSQL 18 locks](https://www.postgresql.org/docs/18/explicit-locking.html) and [consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | Versioned official documentation | Current cooperating rows need appropriate locks and snapshot timing. Preserve a consistent root-before-file order with catalogue/organize producers. |
| [PostgreSQL 18 transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html) | Versioned official documentation | Snapshot history and file updates can commit or roll back together; uncommitted intermediate changes remain invisible. |
| [PostgreSQL 18 clock](https://www.postgresql.org/docs/18/functions-datetime.html) and [UPDATE](https://www.postgresql.org/docs/18/sql-update.html) | Versioned official API guidance | Refresh time after waits. Transaction-start now() is not a final wall clock; zero affected rows is not automatically an error. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html?trk=article-ssr-frontend-pulse_little-text-block) and [workflow](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Informative mutable guidance | Verify authority at execution, validate server-owned transitions and conditional writes. Financial examples do not prescribe new MFA here. |
| [WCAG 2.2](https://www.w3.org/TR/2024/REC-WCAG22-20241212/) and [status explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Normative Recommendation 12 December 2024; informative explanation | Existing status should distinguish parsed, persisted, failed and refused work without forcing focus or implying completed acquisition. |

PostgreSQL 18 is the consulted documentation version, not an observed database
version. No publication date is invented for mutable guidance and no UI change
or standards conformance is proposed.

## Exact installed parser contract

Corrected read-only lockfile extraction and installed package.json both report
music-metadata 11.16.0; package exports the Node entry from lib/index.js as ESM.
The lockfile pins strtok3 10.3.5. Package-integrity/source equivalence was not
executed or verified.

GitHub MCP rediscovered [Borewit/music-metadata](https://github.com/Borewit/music-metadata).
The returned release collection, per_page=100/page1, contains
[11.16.0](https://github.com/Borewit/music-metadata/releases/tag/v11.16.0),
published 22 September 2026 at 16:10:20 UTC. Its verified Git ref resolves to
commit 9e995a31c9e5526057a63936cb83d9f8b02e0fcc. The non-truncated tree supplied
the exact source paths; this is not a claim about every release page or later APIs.

The [Node entry](https://github.com/Borewit/music-metadata/blob/9e995a31c9e5526057a63936cb83d9f8b02e0fcc/lib/index.ts)
passes a path to awaited strtok3.fromFile, awaits ParserFactory parsing, and
rethrows errors. Once the tokenizer exists, parsing uses a finally block to close
it. Initial tokenizer-open errors precede that block; the dependency's own cleanup
implementation was not inspected.

The tagged [README](https://github.com/Borewit/music-metadata/blob/9e995a31c9e5526057a63936cb83d9f8b02e0fcc/README.md)
and [error classes](https://github.com/Borewit/music-metadata/blob/9e995a31c9e5526057a63936cb83d9f8b02e0fcc/lib/ParseError.ts)
document type-detection, unsupported-type, content, field-decoding and internal
parser failures. The
[factory](https://github.com/Borewit/music-metadata/blob/9e995a31c9e5526057a63936cb83d9f8b02e0fcc/lib/ParserFactory.ts)
selects/probes a parser and can reject unknown/unsupported formats. These
dependencies do not implement Harmoniarr lease, cancellation, source CAS or
database persistence. Parsing is not a content hash or atomic filesystem snapshot.

## Bounded owning recommendation

The following is application inference, not executed parser/transaction proof.

Capture the original acquisition and original catalogue file/root/path/size/mtime
before awaited extraction. Copy mutable Dates to scalar timestamp identity;
never reread a newer token/root after parsing to bless older metadata. Scan
context must not fall through to an unguarded writer when ownership is missing
or malformed.

Persist required history and the file's tag/source stamps in one short current-
owned transaction. Recheck maintenance, active run/acquisition, cancellation,
current root and source fields under the same consistent root-before-file order
as scan/organize. Use fresh post-wait time and checked source-CAS cardinality.
If a required insert/update or authority check fails, roll back both parts.
Keep parser/filesystem I/O outside database locks.

Where feasible, catch only metadata/read failures for the per-file failure
fallback. Keep snapshot transactions, source refusal and database errors outside
that catch. At minimum typed lease-loss/cancel/pause/source refusal must escape;
a new persistence error must not trigger a second failed-snapshot write.
Genuine parser/read failures may retain their existing per-file behavior only
under the same current ownership/source guard.

Start downstream artwork only after a successful owned snapshot decision.
Refused old work must produce no replacement tags, failed snapshot or artwork.
Effects after a valid commit are separate boundaries unless explicitly guarded;
this research does not promise rollback of filesystem reads/effects or external
exactly-once. Catalogue source stamps identify the compared observation, not
universally immutable bytes during parsing.

| Option | Benefit | Gap | Assessment |
| --- | --- | --- | --- |
| Gate before metadata read only | Small change | Extraction can outlive ownership/source | Insufficient |
| Compare source stamps after writing | Preserves existing measurement fields | Stamps do not condition the update or roll history back | Insufficient |
| One captured-ownership/source transaction after extraction | Protects required history/file writes together | Requires propagation, consistent locks and adverse proof | Preferred |
| Treat every caught exception as parser failure | Keeps enrichment moving | Ownership/write failures can create a second stale write | Reject |

Minimum proof: delay old A's actual metadata read, let B update source/tags, resume
A and assert zero replacement/history/artwork; current extraction succeeds.
Cover genuine parser failure versus ownership refusal, source path/size/mtime/root
drift, same-PID acquisition replacement, cancellation/maintenance, fresh expiry
after waits, insert/update failure rollback, nullable timestamp semantics, private
projection and coexistence with scan/organize locks. Real PostgreSQL owns CAS and
concurrency proof; real parser/files own metadata semantics. Doubles prove wiring
only. No media-byte certification or actual AT/conformance claim follows.

## Evidence limits

Raw standards/host/package observations:
.tmp/tag-snapshot-2026-10/official-source-discovery-and-reads.json,
SHA-256 f145ec13e8637de57d222ef711392047310f3c5dfe7da20d547a14a5dc1048bb.
Exact parser repository/release/ref/tree/source:
.tmp/tag-snapshot-2026-10/music-metadata-11.16.0-source.json,
SHA-256 2c9840ea3ff1ea5c8b4d4423c204feb6893c5af99b8ed47652afcbf095a2c406.

The first PowerShell lockfile read required AsHashtable because of an empty JSON
key; its corrected read supplied the version. MCP rejected the returned tags
collection endpoint; release metadata plus verified Git-ref/tree discovery
supplied the exact source. Rejections are retained and not counted as verified.

No application source/test edit or execution, PostgreSQL operation, Git mutation,
provider mutation, external message, branch, release or merge occurred.
No parser/provider upgrade is proposed. PR evidence is separate:
[design](OPEN_PR_APPLICABILITY_TAG_SNAPSHOT_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_TAG_SNAPSHOT_2026_10_OUTCOME.md).
