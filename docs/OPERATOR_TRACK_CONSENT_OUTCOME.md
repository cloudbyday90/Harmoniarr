# Operator track consent outcome

Completed October 12, 2026, America/New_York, on main. See the
[design](OPERATOR_TRACK_CONSENT_DESIGN.md) and
[official research](OPERATOR_TRACK_CONSENT_RESEARCH_2026_10.md).

## Result and architecture

Suppression-only, review-needed, orphaned and other-edition track overrides no
longer grant explicit acquisition-policy exceptions. A narrow ESM
`operator-track-consent-policy.js` supplies the positive/resolved/current-target
predicate; effective state derives `resolvedDesiredCount` while keeping existing
descriptive counts. The planner requires a positive safe integer count without
falling back to total/desired override counts. Reconciliation execution, Wanted
projection and final SQL publication all reuse the corrected decision.

Saved desired overrides marked resolved still grant the existing exception when
bound to the current edition, or with an existing null/group-scoped binding.
Manual selected/partial release choices remain independent; unselected choices
remain excluded. Suppression cannot grant an exception, but does not veto valid
broad policy or separate manual release intent. Broad-policy requests are now
classified as policy rather than explicit when the only override is suppression.
Existing requests, required events, acquired files and quality preferences retain
their existing owners and behavior. No migration, new endpoint, singleton or
parallel operation system was introduced.

`testing/integration/operator-reconciliation-execution-fixture.js` extracts the
opt-out test's real queue/worker/materializer owner for reuse. It captures accepted
source and the plan, awaits actual execution completion and closes the worker in
cleanup. Assertions read SQL state afterward, rather than relying on swallowed
callback assertions or treating queue claim completion as execution completion.

## Reproduction and final evidence

The original native candidate passed 3/9 and failed 6/9: five negative/forged cases
unexpectedly produced Wanted rows, and broad-policy suppression was mislabeled
explicit. The three valid positive/manual paths passed. The other-edition fixture
was strengthened with an actual medium/track for its saved recording identity.
A selected two-case pre-fix diagnostic then passed 0/2 and failed 2/2, directly
showing durable acquisition requests after a saved suppression and caller-forged
eligible/explicit flags. These are separate pre-fix diagnostics, with no
cancellations/skips, not final validation or additional unique coverage.

The new pure boundary diagnostic passed 3/24 before runtime changes; new consent
counts and eligibility expectations account for the failures. After implementation,
the initial affected focused cohort passed 282/282, then final focused validation
with four additional broad-policy gate cases passed 286/286.

Nine JavaScript files were frozen before complete gates: three runtime modules
and six test/fixture files. Working/index hashes remain exact after documentation
maintenance. Private candidate patches, hashes, manifests, red logs and final logs
are in ignored `.tmp/operator-track-consent-2026-10-12/`.

| Final gate | Result | Duration / scope |
| --- | --- | --- |
| Focused consent and consumers | 286/286, zero failures/cancellations/skips | 38 verified literal files; TAP 1.229 seconds |
| Complete `validate:fast` | 9,912/9,912 plus both builds | 4,976 server + 4,384 client + 552 script; wrapper 138.049 seconds |
| Affected PostgreSQL | 71/71, zero failures/cancellations/skips | 11 verified files, 6 suites plus standalone tests; TAP 178.087 seconds, wrapper 178.180 seconds |
| Dependency audit | Zero reported vulnerabilities | Dependency inventory, not whole-system security certification |
| Skills | Three structural validators pass; all four installed standards files match source hashes | Concrete reference maintenance, no new blind trial |

Native cohort: track consent, monitoring opt-out, publication authority,
reconciliation worker lifetime/recovery, save revision, track-identity validation,
Wanted reconciliation, read-only artist projection, compact summary inputs and
metadata refresh lifetime. Nine new cases prove negative and forged denial,
current-edition/group-scoped desired intent and independent manual/broad policy
through real saves and publication. The opt-out cohort retains existing-request
preservation. Wanted reads use owned transaction clients. Pool max 2, checkout
10 seconds, scenario 90 seconds, serial isolated files and teardown are unchanged.
The acknowledged media image was
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`;
network-disabled ffmpeg/ffprobe checks returned 8.0.1. No exhaustive native,
benchmark speedup, Docker deployment or full W3C/WCAG/security certification is
claimed. Broader gates were run once on the stable code candidate.

## Recommendation stack, costs and next item

Use normalized scoped save → target-specific positive consent → shared
eligibility → transaction-owned current source/target checks → atomic request/
event → actual worker completion and drainage. Benefits: uncertain or negative
intent cannot manufacture an exception, and three consumers agree. Costs: summary
adapters must supply the new derived count; a concrete old-edition binding cannot
silently authorize a different edition and needs deliberate retargeting/review.
Null group scope remains an existing compatibility contract, not a standard rule.

Next: verify declared resolved track identity against the current release catalog
and carry the selected track scope through request/discovery, candidate selection
and import verification. Current save validation checks identity syntax and
release/group ownership; this predicate checks saved polarity/remap/binding, not
actual catalog membership. Reconciliation materializes `requestKind: 'release'`
and its evidence records release IDs, explicit/state flags and snapshot identity/
revision rather than a selected-track requirement. Source search found no
`operatorArtistReconciliation` consumption in acquisition/library code; that is
static scope evidence, not an end-to-end unwanted-track reproduction. Begin the
next round by proving the valid saved identity and actual effective consumer
behavior. Preserve recipient-owned shared quality/link rules and current
verification gates; do not promote a group summary into sibling consent.

Source-reader coordination and catalog lock partitioning remain later work.
Historical unrelated PostgreSQL reset causes remain unconfirmed. The
[PR applicability outcome](OPEN_PR_APPLICABILITY_TRACK_CONSENT_2026_10_OUTCOME.md)
records unchanged previously replayed open revisions, with no eligible new random
replay. Publication stays on main, with no new branch, release, tag or PR merge.
