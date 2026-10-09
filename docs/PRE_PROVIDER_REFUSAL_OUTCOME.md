# Explicit pre-provider refusal outcome

Implemented on main, October 9, 2026. The separate
[design](PRE_PROVIDER_REFUSAL_DESIGN.md) records alternatives, pros/cons and final
stack. The separate [research](PRE_PROVIDER_REFUSAL_RESEARCH_2026_10.md) records
fresh official MCP discovery, source status and application inference. No release,
branch, tag, provider upgrade or PR merge is part of this change.

## Result and ownership

Only future stamped jobs use the private preparation protocol. Narrow ESM policy,
service and store modules bind each epoch to run/candidate, generation, captured
lease/source/manifest and time. The worker begins before planning, no-files,
scoped preparation and version/config reads. It preserves original attempt/resume
behavior first; old absence never creates a certificate.

An exact preparing epoch can seal a bounded refusal with required audit, or cross
irreversibly into possible dispatch. The native adapter calls the trusted boundary
after its final configuration assertion and before POST. The owner repeats current
run/source/attempt/lease checks under locks, uses its transaction client for local
configuration reads, and rechecks expiry after the await. Crossing and audit commit
together. A later local error, partial/lost response, 409 or commit-ack uncertainty
cannot become negative proof. A fallback adapter crosses conservatively.

Refusal can stop only its own correlated receipt-free staged attempt. The legacy
not-dispatched writer cannot alter any tracked epoch. Same-lease replay cannot
reset refusal; a new lease can start a generation only after an explicit unstaged
refusal, invalidating the old certificate before preparation. Preparing work from
another lease, crossed epochs and staged refusals remain blocked. These limits
preserve the original unknown instead of manufacturing a receipt or clearing it.

Ordinary writes compare complete epoch content, not just its UUID. Initializers,
replacement, lifecycle/retry and both retention paths preserve or fence the
record. Global/common guards and bounded worklists protect preparing/malformed
epochs even without a provider attempt; valid refusal and verified normal receipts
remain distinct. Canonical wanted reads retain truthful unresolved context.

The existing guarded origin-resolution command consumes only a current valid
refusal, idle claim/lease and no conflicting provider evidence, plus its normal
whole-batch, administrator/session/CSRF, source, consent/quality and digest checks.
No new UI command or schema migration was needed. The existing native confirmation,
same-key retry, dual refresh and focus behavior remains in use.

Public projection removes the protocol marker and private epoch. Real repository
items also carry a raw snapshot alias; that alias is now removed alongside the
sanitized planningSnapshot. Internal evidence remains available to workers.

## Executed evidence

Final `npm run validate` exits successfully: 9,160 tests pass, zero failures,
cancelled, skipped or todo tests, all required policy/lint checks and both builds.

| Complete validation suite | Passed |
| --- | ---: |
| Server | 4,002 |
| Client | 4,375 |
| Scripts | 513 |
| PostgreSQL integration | 270 |

The complete command used `HARMONIARR_INTEGRATION_MEDIA_IMAGE=harmoniarr-quality-fallback:local`.
The inspected local fixture is
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`
with ffprobe 8.0.1. This is local test tooling, not a newly built or published
application image. The full run does not include the separate browser command.

The final focused serial PostgreSQL block passes
58 tests, zero failures/skips, including nine future-protocol scenarios and the
affected existing origin, receipt, recovery, adoption, wanted-reader and retention
consumers. Owning backend tests pass 93 and changed-path lint passes. Executed
focused policy/native dispatch tests pass 37, and
the combined policy/native/privacy command passes 43, zero failures/skips.
Existing adjacent module/projection/dispatch/batch consumers pass 33. Focused
totals overlap the complete run and each other. Client checks pass 34; the first executed browser command passes
31 across origin resolution, adoption and canonical actions. Six updated light/
dark captures at 390, 800 and 1280 CSS pixels are inspected separately.

Native fetch controls test both inspected 0.25.1 and 0.26.0 adapters: awaited
configuration/callback order, callback rejection with no POST, configuration
refusal before callback, and lost response after the boundary without a new
receipt or another POST. These callback tests are not persisted transaction proof;
actual worker/epoch ownership, races, rollback, retry and retention use PostgreSQL.
Provider contracts are inherited from the earlier immutable ledgers and checked
by the supported-version policy; no new capability or deployment upgrade is claimed.

Fresh `npm run validate:security` passes image/topology policy and all-severity
npm audit with zero reported vulnerabilities. Node 24.18.1/npm 12.0.2 were checked.
Controlled provider and DOM checks do not establish live Soulseek behavior,
external exactly-once, measured-media import or assistive-technology speech.

## Original failures and corrections

- Initial policy/native tests passed 35 of 36: an unstaged certificate remained
  valid after execution.requestedFiles drifted. Strict equality with the immutable
  epoch manifest fixes it; the expanded original command passes 37.
- The first actual PostgreSQL suite passed seven of eight and caught the raw
  snapshot alias exposing private epoch data. Removing the alias, preserving the
  canonical sanitized field, and adding the real alias fixture fixes it. The
  affected native leased/refused-to-resolution scenario and required-audit worker
  control pass together; no privacy assertion was weakened.
- The first wider PostgreSQL block passed 49 of 50: a tracked final-policy refusal
  sealed correctly but skipped existing scoped recovery retirement. The worker
  now retires only after successful sealing, its own staged attempt and a failed
  final guard. Crossed, unknown and audit-failed paths cannot retire. The isolated
  original scenario passes with held/retired/zero-POST assertions intact.

Actual first/corrected logs are retained under ignored
`.tmp/pre-provider-refusal-2026-10/`. No source inference is presented as a live
provider or transaction reproduction; browser fixtures validate the source-owned
certificate shape while PostgreSQL owns durable issuance claims.

## PR applicability and skill

Fresh GitHub MCP collection pages, full immutable heads/bases and file scopes
found no eligible unreplayed patch. The three observed open patches keep their
already locally implemented scope; no random draw, duplicate replay or merge was
applicable. Separate [PR design](OPEN_PR_APPLICABILITY_PRE_PROVIDER_REFUSAL_2026_10_DESIGN.md)
and [outcome](OPEN_PR_APPLICABILITY_PRE_PROVIDER_REFUSAL_2026_10_OUTCOME.md) preserve
discovered URLs, times, comparisons and hashed raw evidence.

The [practical standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now maps final-send ownership, irreversible crossing, complete epoch comparisons,
retry leases and raw snapshot aliases to their consumers and adverse evidence.
Source and installed structural checks pass; all four files match by SHA-256 after sync;
no new blind behavioral trial or standards certification is claimed.

## Limits and next recommendation

No historical leased job is certified from a missing checkpoint, provider absence
or timeout. A crossed epoch remains possible dispatch even after a zero-POST
local failure or lost commit acknowledgement. Existing confirmed/rejected causal
receipts resolve their normal ownership path; they are not negative certificates.
Preparing epochs from a different lease and staged refusals remain conservative.
Newer/current scope, source, policy and provider binding still govern restoration.

Next: explicit closure of abandoned preparing epochs under fresh lease and
cancellation fences. Current begin deliberately blocks a replacement owner. A
new command must prove the exact future protocol state, fence the expired worker,
and preserve every original possible dispatch. Test a delayed old callback after
closure: it must send no POST, while may_have_dispatched remains unresolved.
Do not generalize timeout or absent history into permission to close legacy work.
