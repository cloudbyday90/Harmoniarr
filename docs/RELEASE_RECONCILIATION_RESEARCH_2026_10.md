# Release reconciliation research

Client-facing task date: **October 10, 2026, America/New_York**.
Observed host time: 2026-10-10T00:03:13.4856243-04:00; observed UTC:
2026-10-10 04:03:14 UTC. Node v24.18.1 and npm 12.0.2 were read directly.
The parent supplied clean-main baseline `29fa665`; its separate baseline
verification remains with the root. PostgreSQL 18 is the consulted documentation
version, not proof of the running database version.

The initial verified draft was saved before the new release-reconciliation runtime
changes. Research consultation and publication dates are separate.

## Observed boundary and accepted bounded direction

The baseline service awaits a global coverage query, then the raw store opens
a different transaction, deletes projection rows and upserts captured values.
Coverage depends on observed/nondeleted library files, matched file rows and
the metadata artist/group/release/media/track graph. Existing-row locks alone
cannot cover newly inserted eligible input rows.

The initially considered source-table SHARE barrier is **not the accepted
solution**. Table SHARE permits ROW SHARE; a producer can hold a parent
FOR UPDATE row lock, then wait for a source-table UPDATE blocked by the
aggregate's SHARE lock, while the aggregate's FK insert waits for that parent.
This is a permitted design counterexample, not a reproduced current-program
deadlock or proof about a particular producer's lock strength. This agent has
not reproduced it with PostgreSQL. Parent-table-first ordering
or NOWAIT table acquisition alone does not exclude that later row-lock cycle.

The accepted project option preserves a bounded read model:

1. Capture original scan/run/acquisition context before the first await.
   Keep the existing coverage SQL and mapping behavior. Accept no outside
   aggregate as the transaction's authoritative captured input.
2. Use one short transaction. Set READ COMMITTED explicitly before maintenance
   reads, so a host default of Repeatable Read cannot retain an earlier view.
   Then use maintenance → run → advisory lease key/row →
   global projection advisory order. All raw projection replacers acquire that
   same projection admission key. Do not add root/file/metadata row locks or
   source-table barriers to this owner.
3. After global admission, load and capture coverage on that same client.
   Subsequent READ COMMITTED queries compare their full global aggregate
   value with this transaction-owned captured value. Include
   new eligible rows and coverage from other roots; do not reduce the comparison
   to the current requested root or already captured rows.
4. Repeat fresh coverage/current authority/time checks before DELETE, before
   one bulk UNNEST upsert statement and after writes before commit: three
   validation boundaries after initial capture, rather than one query per
   release. Refresh expiry time after
   awaited coverage reads. Changed coverage or failed
   authority/cardinality rolls back the whole replacement. Preserve valid
   current empty coverage, which can delete an obsolete projection.
5. Verify returned projection identities; propagate refusal and SQL errors.
   Do not automatically retry a cached aggregate as though it were fresh.

The guarantee is **latest committed coverage at each query snapshot**, together
with serialized projection replacement. It is not strict commit-fresh coverage:
a source commit after the final query snapshot awaits a later pass. The
advisory barrier serializes cooperating projection writers; it does not block
source-table producers. It does not certify global database state atomically
with provider/filesystem work.

## Primary evidence and consultation status

| Discovered/opened source | Classification / version | Applicable finding |
| --- | --- | --- |
| [Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) | PostgreSQL 18 database documentation | READ COMMITTED uses a statement snapshot; successive reads can see new commits. Repeatable Read retains an earlier snapshot. Serializable adds conflict monitoring and possible rollback; serialization is not a claim that a read occurred after every concurrent commit. |
| [Explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | PostgreSQL 18 database documentation; reached from current navigation | SHARE conflicts with ordinary DML's ROW EXCLUSIVE but permits ROW SHARE used by locking reads. Row locks and table modes are separate. Consistent acquisition order matters, including FK row locks. Transaction-scoped advisory locks provide cooperative application admission. |
| [Application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | PostgreSQL 18 database documentation; reached from current navigation | Serializable and explicit blocking locks are alternatives with different obligations. Snapshot timing and participating writers matter; adding a lock after an old snapshot does not by itself refresh that snapshot. |
| [LOCK](https://www.postgresql.org/docs/18/sql-lock.html) | PostgreSQL 18 command documentation; followed the explicit-locking page's actual LOCK link | A table SHARE barrier can stabilize ordinary DML under READ COMMITTED. Repeatable Read/Serializable require correct snapshot timing. Writers sharing a table SHARE lock can deadlock while upgrading, so lock mode/order must be designed together. These are alternatives, not the adopted projection protocol. |
| [SET TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html) | PostgreSQL 18 command documentation | Isolation cannot be changed after the first query/data-modification statement. Set READ COMMITTED immediately after BEGIN, before maintenance or authority reads. |
| [Date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html) | PostgreSQL 18 database documentation | NOW/transaction time stays fixed; clock_timestamp reports actual current time, including after waits and coverage reads. |
| [DELETE](https://www.postgresql.org/docs/18/sql-delete.html), [INSERT](https://www.postgresql.org/docs/18/sql-insert.html) and [UPDATE](https://www.postgresql.org/docs/18/sql-update.html) | PostgreSQL 18 command documentation | RETURNING describes rows actually mutated, including successful conflict updates. Zero affected rows need not be a SQL error; exact completeness/identity refusal is the application contract. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Informative explanation of WCAG 2.2 criterion 4.1.3 | Existing status reporting should describe actual accepted work. This unchanged frontend slice adds no new semantic control/live region and provides no speech or full-conformance evidence; the Understanding page is not itself the normative Recommendation. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Informative security guidance | Fail closed and validate current server-side authority. Applying this principle to an original worker acquisition is a project inference, not a standardized lease algorithm. |

The exact projection key, aggregate comparison and bounded freshness promise
are project decisions. A strict stable-global-input design would need a broader
producer-coordination and lock-order contract, with actual interleaving proof;
it is deferred rather than implied by this slice.

For projection timestamps, the same official date/time distinction applies:
clock_timestamp at the INSERT/conflict UPDATE records the SQL write stage after
global admission waits. NOW would retain transaction-start time and could
backdate a completed replacement. This is a project timestamp choice, not a
commit timestamp or proof that coverage stayed unchanged until acknowledgement.
Current source uses clock_timestamp for last_reconciled_at and updated_at;
that observation is read-only source inference, not an executed timing test.

## Evidence required and limits

Use actual PostgreSQL to hold coverage lookup or projection admission, replace
the acquisition or commit changed/new/other-root coverage, then resume the old
body: no obsolete replacement. Exercise current complete/partial/duplicate and
empty controls, required all-row identity/cardinality, cancellation/maintenance,
expiry after waits, DELETE/upsert failures and final-check rollback. Include
metadata FOR UPDATE/cascade and catalogue/tag/match/organize coexistence, proving
the chosen owner has no added source-table/parent-row waiting cycle.

No tests, PostgreSQL, provider, parser or browser were executed for this
research. The frontend is unchanged. W3C status guidance can inform existing
truthful job reporting, but this work adds no control/dialog/live-region or
assistive-technology conformance claim. Installed host versions do not establish
container or database versions.

## Retained evidence and separate PR assessment

The verified draft was saved at **2026-10-10 04:07:43 UTC**, before the new
release-reconciliation runtime changes. Its original raw evidence remains in
`research-draft.json`, SHA256
`a276fad16ee21c8548c5bce0541cb178f22bc726a8e5b43dc6590a2ef09f7d6a`.
Subsequent accepted design refinements capture coverage only after global
admission, set transaction isolation before reads and use one bulk upsert.

Fresh raw responses, actual navigation and source observations are ignored
artifacts under `.tmp/release-reconciliation-2026-10/`:

| Evidence | SHA256 |
| --- | --- |
| repository-discovery.json | fd67c509fb7b92a18dcc95eb27de96c911b3178ace16253a54cd4fe5e9ec567c |
| official-research.json | 5eaf22d7cfdc49a273fad42a40855c3caa0b08371c7900cbcafc666fb6a15a74 |
| open-pr-evidence.json | 363cf26f90007891475a6600a28c3f2207b110d8394d4025ff6f14daf391213d |
| source-and-design-observation.json | d0f0c12c64d21ad5fdfc5f0381ae24495915601e00a4df1b73f06e0e0cc51f69 |

Source/lock-mode reasoning is distinct from execution. In particular, the
SHARE/FK cycle is a permitted design counterexample; it is not a reproduced
current-program deadlock. Ordinary FK/row conflicts may still abort a
transaction. Safe rollback is required; no universal deadlock freedom is
asserted. A literal nonblocking search in the isolation page returned no match;
the application-consistency page supplies that description. Raw lookup
responses are retained and imply no failed application test.

The separate [PR design](OPEN_PR_APPLICABILITY_RELEASE_RECONCILIATION_2026_10_DESIGN.md)
and [outcome](OPEN_PR_APPLICABILITY_RELEASE_RECONCILIATION_2026_10_OUTCOME.md)
record fresh repository discovery and complete observed open pages, exact
head/base/state metadata and full changed-file lists. Only unchanged,
already locally replayed PRs 23, 24 and 40 were observed. Eligible set: empty;
random draw/replay: N/A.
