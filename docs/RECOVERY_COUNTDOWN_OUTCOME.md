# Recovery countdown outcome

Validated October 21, 2026 on main, Node 24.22.0/npm 12.0.2. The controlled
baseline retained 90 seconds after advancing wall time 91 seconds. Recovery now
uses an owned reactive deadline countdown, refreshes on visible wake and checks
expiry before admission and immediately before POST dispatch after the DOM flush.

## Implemented result

The new ESM `useExpiryCountdown` owns one timeout and finite remaining seconds.
The existing recovery composable supplies accepted deadlines and lifecycle
admission. Hidden display work pauses; completion/destroy stop it; accepted new
deadlines can restart it. Missing/malformed expiry refuses client submission.
The named timer remains quiet between seconds, and expiry updates the existing
polite feedback region without moving focus. Server recovery controls remain
unchanged and authoritative.

The existing standards AI skill now routes time-sensitive work to
[expiry ownership](../.agents/skills/harmoniarr-web-standards/references/expiry-countdowns.md).
It combines framework lifecycle, WHATWG timing/visibility, WAI-ARIA announcements,
OWASP-informed server boundaries and efficient controlled-time qualification.
Its validator passes. No duplicate standards skill or timer package was added.

## Validation

Reviewed the final source before the complete gates. The five changed code/test
files belong to source fingerprint **3240 files**:

```text
44c2d40d9cf3894f105a1938cbc82526d6ea738e7333627cc095837b102964e4
```

| Gate | Observed result |
| --- | --- |
| Focused recovery/countdown/password-confirmation/focus checks | 25 passed |
| Selected built-browser and native recovery-route cohort | 7 passed, 0 skipped |
| `npm run validate:fast` | 10,783 passed: 5,616 server, 4,470 client, 697 scripts |
| Static/lint/ESM/schema policy and both builds | Passed through fast gate |
| Existing Vue warnings | 225, unchanged; not suppressed |
| Standards skill validator | Passed |
| Client artifact comparison | Same 155 files for native proof and final fast build |

All reported gates had zero failures/cancellations/skips. The new six unit cases
use controlled time rather than real recovery-window waits. The owning native
cohort completed in about 27.85 seconds; that is a local observation, not a speed
budget or whole-suite improvement claim.

The focused checks prove unchanged deadlines tick without status polling, late
callbacks calculate from current time, the exact boundary disables admission,
suspended/DOM-flush-crossing submissions send no POST, and a held/failed wake
read cannot revive expired admission. They also cover replacement/invalid
deadlines, completion, timer destruction and late status fencing.

The built Chromium case uses actual armed recovery status and fresh PostgreSQL,
with controlled browser time and explicitly synthetic visibility inputs. It
observed 1:30 → 1:29, a real unchanged-expiry poll → 1:20 → 1:19, then immediate
expiry before a held wake response. No recovery POST occurred, the native run
remained armed with zero invalid attempts, later focus stayed owned, and
navigation stopped recovery reads. Timer content stayed outside status/alert
ancestors; expiry used the same mounted feedback region. Masked light desktop
and dark mobile captures were inspected; width-overflow assertions passed.

The selected existing native cases additionally retain actual server hold and
expiry refusals, five-attempt invalidation, successful completion/session
revocation, no automatic login/cookie, replay refusal and explicit later login.
These are independent native server checks, not consequences inferred from the
browser clock. Selected cohort:

```powershell
node --test --test-concurrency=1 test/browser/recovery-countdown.test.js test/browser/recovery-form-feedback.test.js test/integration/admin-recovery-routes.test.js
```

## Scope and next recommendation

Connected GitHub MCP queries at the start and end found zero open PRs. There was
no applicable PR to implement, rebase, close or merge. No branch, release, tag,
version, dependency or schema change was created. The
[preserved Docker rebuild](LOCAL_DOCKER_RECOVERY_COUNTDOWN_OUTCOME.md) records
packaged-runtime/readiness evidence separately.

Physical OS/tab suspension, actual screen-reader speech and physical mobile
acceptance remain unperformed. Automated role/text/focus evidence does not
establish those outcomes or full WCAG conformance. The unchanged exhaustive
PostgreSQL and three-engine/tab-zoom matrices were not repeated for this slice.
Timer cleanup proof does not claim arbitrary I/O quiescence.

Next, qualify **concurrent and partially failed admin-recovery completion** in a
disposable native fixture. The current service performs account mutation,
interactive-session revocation and run consumption through separately awaited
operations. Prove one authoritative completion and rollback/recovery behavior
under overlap/failure before selecting a transaction/locking refactor. This is a
code-review-driven qualification recommendation, not a reproduced exploit claim.

The recommended stack and alternatives are in the
[design](RECOVERY_COUNTDOWN_DESIGN.md); primary-source consultation is recorded
in [official research](RECOVERY_COUNTDOWN_RESEARCH_2026_10.md).
