# Verified operator track requirements outcome

Completed October 12, 2026, America/New_York, on main. See
[design](OPERATOR_TRACK_CATALOG_DESIGN.md) and
[official research](OPERATOR_TRACK_CATALOG_RESEARCH_2026_10.md).

## Delivered behavior

Resolved track exceptions now require an exact current recording/medium/track
position match. Missing, ambiguous and unsupported track-MBID identities cannot
manufacture a grant. The current schema does not store MusicBrainz track MBIDs;
those saved overrides remain available for review rather than being matched to a
different identity. Descriptive desired/suppressed/review counts remain separate
from verified resolved counts. An incomplete desired set blocks the requirement.

Three narrow ESM modules own catalog reads, typed scope and current verification.
The internal Wanted catalog read includes track identities; execution and final
publication capture and compare that catalog. Exact track requirements are stored
in atomic request/event publication's request evidence and owner-specific Wanted
evidence. Discovery participant and candidate context carry those requirements.
Presence flags preserve explicit nulls rather than treating them as absent consent.
Full manual release selections and ordinary broad policy retain their independent
contracts. A saved track requirement covering the complete verified catalog uses
the existing whole-release workflow, including its quality, media and path gates.

**Proper subsets remain blocked for release-wide acquisition.** Discovery keeps
a bounded verification reason without consuming search/research budgets or calling
the provider. Current participant checks retain every owner. Candidate selection,
legacy preparation, final dispatch admission and each import filesystem mutation
recheck the requirement; manual apply also checks it before filesystem/media work.
Whole-catalog proofs are compared against fresh catalog values, not trusted as
permanent permission. Recovery checks forward the owning transaction queryable.
This is conservative scope enforcement, not an enabled partial-download feature.

Standalone medium insertion, track insertion, recording upsert and media deletion
now use existing exclusive source admission with captured inputs and owned/borrowed
transactions. Supported catalog writers cannot change this proof after final
publication checks through commit. Raw SQL is outside cooperative coordination.
Other projection-reader enrollment remains separate work; current acquisition
verification does not make every projection globally stable.

## Reproduction and corrections

Two selected native baseline cases at commit `350180c` passed 0/2: an unknown
recording created an acquisition request, and a proper subset produced a release
request without track scope. The diagnostic temporarily restored tracked runtime
files from that commit and restored this round's exact buffers in cleanup. Logs
and the restoration script remain private. No branch or publication was involved.

The first focused cohort passed 335/353. Old DTO fixtures lacked catalog proof and
expected policy blockers where explicit review was required. Corrected fixtures
and new boundary coverage passed 392/392, then final focused coverage including
null-marker mapping passed 404/404. The new native file first passed 4/4; its
extended closure diagnostic passed 4/5 because the test candidate omitted required
schema columns. The fixture now supplies a valid persisted candidate.

The first complete fast gate passed 9,931 plus builds. Final review identified an
explicit-null SQL mapping gap; after correction the final fast gate passed 9,932.
The initial affected native cohort passed 162/172: eight setup failures borrowed
a pool as a transaction client, and two assertions expected the old blocker count.
Correct transaction owners and precise review counters passed 17/17 in focused
repair, then the complete affected cohort passed 172/172. Retain those diagnostic
results separately; they are not extra unique coverage or final proof.

## Final evidence

| Gate | Final result | Local scope / duration |
| --- | --- | --- |
| Focused services/consumers | 404/404, zero failures/cancellations/skips | 48 verified literal files; TAP 1.301 seconds |
| Complete `validate:fast` | 9,932/9,932 plus both builds | 4,996 server + 4,384 client + 552 script; wrapper 106.755 seconds |
| Affected PostgreSQL | 172/172, zero failures/cancellations/skips | 23 verified files; 20 suites plus standalone tests; TAP 343.129 seconds |
| Dependency inventory audit | Zero reported vulnerabilities | `npm audit`; not whole-system certification |
| Skills | Five structural validators pass; seven installed standards/scoped files match source hashes | Reference maintenance; no new blind trial or invocation-policy expansion |

Thirty-six JavaScript files are frozen: 26 runtime and 10 test/fixture files. The
three native fixture files changed after the fast gate; every other original
frozen hash remained exact. Corrected fixture lint and complete test hygiene
passed, followed by the final complete native cohort. No production/unit change
followed the passing fast gate. Candidate hashes, manifests, logs and retained
diagnostics are in ignored `.tmp/operator-track-catalog-2026-10-12/`.

Five new catalog cases prove saved unknown/unsupported identities, exact request
and durable Wanted scope, blocked provider/filesystem work, fresh whole-catalog
refusal and post-plan request/event refusal. Four new writer cases observe actual
PostgreSQL blocking after final publication check and drain both owners. Existing
publication, reconciliation, discovery, preparation, recovery, quality, file apply
and worker-lifetime cases cover affected callers. Pool max 2, checkout 10 seconds,
scenario deadlines, serial file isolation and teardown remain intact. The
acknowledged media image was
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`;
network-disabled ffmpeg/ffprobe checks returned 8.0.1. No exhaustive-native,
matched benchmark speedup, Docker deployment or W3C/WCAG certification is claimed.

## Recommendation and next item

Use saved owner intent → current catalog proof → typed requirement → guarded
request/Wanted publication → complete shared participants → current selection,
pre-provider and filesystem checks → actual drainage. Benefits: unknown identity,
stale catalog and partial intent cannot silently become whole-release permission.
Costs: an additional internal catalog read, globally serialized catalog writers,
conservative refusal when any participant needs a subset, and deliberate review
for incomplete/unsupported identities.

Next: implement exact subset file selection and media/import verification, then
owner-specific track fulfillment before enabling partial acquisition. Start with
one valid two-track release requesting one track; prove only that track is selected,
downloaded and imported, and reject extra/ambiguous files, wrong recording metadata,
changed consent and mixed recipients. Filename scoring cannot substitute for that
proof. Track-MBID persistence needs a separate migration/remapping decision.

The [PR assessment](OPEN_PR_APPLICABILITY_TRACK_CATALOG_2026_10_OUTCOME.md) records
unchanged previously replayed open revisions and no applicable new random replay.
No branch, release, tag or PR merge was created. Historical unrelated PostgreSQL
reset causes remain unconfirmed.
