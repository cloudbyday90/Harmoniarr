# Library test schema template outcome

October 10, 2026, America/New_York. Baseline main: `d1b8dee`.
The separate [design](LIBRARY_TEST_SCHEMA_TEMPLATES_DESIGN.md) and
[research](LIBRARY_TEST_SCHEMA_TEMPLATES_RESEARCH_2026_10.md) own proposal/source
status. Instrumentation and explicit selected-mode assessment are completed below;
promoted default/complete validation evidence follows separately.

## Measured preparation and selected trial

The same public four-file order/reporters/server profile with release/tag empty
passes **34/34**, zero failures/cancellations/skips, **105.70s command wall** /
104.37s launcher duration. All **90 registered databases are released**.

| Scenario phase | Release: 24 variants | Tag: 22 variants | Catalogue: 13 variants |
| --- | ---: | ---: | ---: |
| Empty schema preparation | 28.62s | 23.15s | 13.43s |
| Fixture seeding | 1.51s | 0.24s | 0.18s |
| Scenario work/drain | 5.01s | 3.67s inclusive of seeding | 2.44s |

The two selected domains spend **51.77s** in repeated schema preparation. Wanted
already has one source preparation plus 30 idempotent checks; catalogue is measured
but remains empty. Tag's work span includes its seed child span, so adding those
durations would double-count; these sums are not gate wall time.

Explicit release/tag template selection passes the same **34/34**, zero failures/
cancellations/skips, **70.40s command wall** / 69.00s launcher duration. All
**92 databases register and release**; the two extra databases are private sources,
not shared mutable scenarios. Zero normal reaping. Local wall reduction is 35.30s /
about **33.4%**, without a CI or whole-gate causal claim.

| Selected template cost | Release | Tag |
| --- | ---: | ---: |
| One source preparation | 1.29s | 1.12s |
| Actual idempotent case checks | 0.53s / 24 | 0.49s / 22 |
| Clone lineage/sealed-source verification | 0.62s / 24 | 0.61s / 22 |

Selected schema preparation/checking totals **3.43s**, with a further **1.23s**
clone verification. Database creation includes that nested verification span;
copying/registration/cleanup add costs and must not be counted twice. Host/cache
variance remains: for example unchanged catalogue schema time is 14.97s in the
trial. Direct preparation evidence supports the selected mode, while total wall
differences cannot all be attributed to it.

## Design outcome and acceptance

Two narrow ESM modules own explicit-pool schema timing and strict per-domain mode
policy; the existing template engine/lineage/store/parent ownership remain reused.
Nine focused controls pass with scoped lint and source review: no global-pool
fallback, awaited query settlement, original Error/null preservation, optional
bounded diagnostics and independent mode flags/defaults.

New actual PostgreSQL/native-media template acceptance passes **2/2**, zero failures/
cancellations/skips, 11.07s native duration. One source prepares once across a
failed clone and a later clone. It verifies genuine tag persistence, a tested
clone-local fault trigger/rollback, released leases, distinct DB/root/file/run IDs,
absence of old rows/trigger/lease in the later clone and native WAV success. A
privately captured source reopened for connections refuses clone admission before
schema/workspace/seeding/callback with no empty fallback. Existing generic source
fingerprint/session/collision/replacement/sibling controls remain separate.

The original release 8 cases/24 variants and tag 8 cases/22 variants, seeds, lock
diagnostics, parser/fault assertions and deadlines are unchanged. Their runtime
factories now select migration_template as their own default; explicit overrides
`HARMONIARR_INTEGRATION_RELEASE_SCHEMA_MODE=empty` and
`HARMONIARR_INTEGRATION_TAG_SCHEMA_MODE=empty` preserve comparison paths. Unsupported
values fail before resource startup. Global runtime/catalogue and dedicated
migration/bootstrap/recovery/lifecycle-adverse defaults stay unchanged.

## Promoted default and tradeoffs

With release/tag override flags unset, the public default passes **34/34**, zero
failures/cancellations/skips, **92.29s command wall** / 90.71s launcher duration.
All **92 databases register and release**, zero reaped. Selected release/tag source
preparation plus case checks totals **4.36s**, with **1.85s** verification; unchanged
catalogue preparation grows to 19.15s. That variation also affects Wanted's checks
and seeds, so the 70.40s explicit trial is not a guaranteed default wall time.
Compared with the 105.70s empty baseline the final default pair is **13.40s / 12.7%**
faster locally. Direct schema cost is the more precise evidence for this selection.

Dedicated untemplated `npm run validate:schema-bootstrap` passes **105/105**
migrations. `npm run validate:security` passes image/topology policy and zero npm
vulnerabilities. These checks complement the running complete gate and do not
constitute general security certification or template adoption elsewhere.

Recommended stack:

1. Explicit per-suite mode ownership and source-bound preparation/checking.
   Benefit: measured removal of repeated migration application; cost: private
   source initialization, input/profile verification and database copying.
2. Existing migration-only sources plus fresh pools/workspaces/seeds/transactions.
   Benefit: original concurrency and parser oracles remain real; cost: continued
   clone, setup and cleanup work instead of a faster shared mutable test database.
3. Separate opaque monotonic schema/seed/work evidence and empty comparison modes.
   Benefit: direct bottleneck/failed-work attribution; cost: instrumentation and
   careful nested-span interpretation rather than inferred wall-time claims.
4. The named serial shared-server development profile and complete final gate.
   Benefit: scoped rapid feedback with broad regression coverage at final freeze;
   cost: complete validation remains long and unknown owners remain excluded.
5. Maintained standards/ownership evidence references, with Node/pg/PostgreSQL and
   OWASP applied to this CLI slice. W3C/WHATWG/IETF remain applicable to app journeys;
   no UI or conformance claim follows from these database tests.

Next: catalogue now has measured repeated schema cost (13 calls / 13.43–19.15s).
Audit its remaining bare worker/gate/workspace lifetime before assessing the same
template mechanism; do not add it from timing alone. Discovery-request recomputation
remains the next product task. Global runtime, dedicated migration/bootstrap/
recovery paths, assertions, deadlines and concurrency stay unchanged.

## Final validation and limits

Stable `npm run validate` passes **9,888 tests**: 4,603 server, 4,377 client,
552 script and **356 integration**, zero failures/cancellations/skips. All
copyright/migration/schema/ESM/image/topology/hygiene checks, complete lint and
both builds pass. Command wall is **23m33.40s**, native serial integration
**20m54.13s**. The build emits its nonfatal Vite plugin-timing diagnostic; existing
ephemeral-VAPID messages describe test-only configuration. No production UI,
schema or release behavior is changed.

The complete command is longer than the preceding 18m19.92s gate despite faster
measured selected schema preparation. This uncontrolled comparison does not
establish a whole-platform slowdown or speedup caused by templates. Broader
wall-time/capacity remains unresolved; report both observations rather than
substituting selected-phase gains for aggregate evidence. Default file scheduling
and concurrency remain unchanged.

Nine code/config files match the pre-gate SHA256 freeze. Maintained standards
source/installed and testing skills pass structural validation; all four standards
files match by SHA256. Entry metadata/invocation policy remains unchanged; no blind
skill trial or browser conformance claim. Changed local MD links resolve. Commit/
push verification follows on main without release, branch, tag, deployment or PR merge.

## Evidence freeze

Nineteen retained log/state/phase/code-manifest hashes are inventoried in
`.tmp/library-test-schema-templates-2026-10/validation-evidence-final.json`, SHA256
`65bfc585c5cd0fdc6f3ef81d48e138b9908647ba1c3087d958de0109a2bb80ce`.
The fresh [PR assessment](OPEN_PR_APPLICABILITY_LIBRARY_TEMPLATES_2026_10_OUTCOME.md)
at 21:39:12 UTC still has no eligible unreplayed patch. Measurement, proposal,
source research, actual acceptance and complete-gate results remain separately
attributed; no branch, release or PR merge is created.
