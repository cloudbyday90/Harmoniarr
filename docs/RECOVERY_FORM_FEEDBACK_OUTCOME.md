# Recovery form feedback outcome

Completed October 21, 2026 on main. Recovery now reuses the shared semantic
feedback component and password-confirmation policy while its existing ESM
composable owns the POST and failure refresh. A rejected code's error remains
visible while the server's attempt/availability state refreshes in place. One
pending owner rejects duplicate submissions. Older reads cannot replace newer
state, completion or a destroyed owner. Visibility-listener registration is
idempotent and polling stops during submission/completion.

Known local mismatch links confirmation to its current polite hint and invalid
state. Submit focuses correction after DOM flush only while focus remains owned.
Failure restores an enabled invoker; holds/terminal refusals move owned focus to
the persistent named feedback region when the invoker is disabled or removed.
Success has a separate completion-heading target. A later user focus move wins.
Feedback uses the existing themed panel and offscreen-empty live containers.
No server verification, password policy, schema or recovery authority changed.

## Reproduction and executed native evidence

The private real-app baseline recorded confirmation unfocused with no invalid/
description association after mismatch. A real wrong code consumed one attempt,
then the view's status reload erased its error and left zero alerts. Records and
masked screenshots are in `.tmp/recovery-form-feedback-2026-10-21/`.

Final non-Markdown source: 3,237 files, SHA-256
`38105cb0b5264a1d5e7c8bf02ca33a778e2563661cbf74225f0f91ca16b9a331`.

| Check | Result and qualified boundary |
| --- | --- |
| Focused client tests | 23 passed: recovery state/API, original Error/null, single pending POST through refresh, stale reads, destroy/visibility cleanup, shared correction and focus ownership. |
| Native browser/route cohort | Nine passed across recovery UI, existing auth entry UI and existing recovery route integration tests, all with fresh owned PostgreSQL/app fixtures. |
| Recovery browser scenarios | Mismatch sends no POST or attempt; one real invalid code remains visible through a held refresh; duplicate admission stays closed; actual recovery revokes the prior session, issues no cookie, refuses replay and permits explicit new login. |
| Native refusal scenarios | A newly acquired restore hold and newly expired run refuse a formerly enabled form without consuming invalid attempts or changing credentials. Five actual invalid submissions exhaust/invalidate the run, retain the final error after form removal and preserve the prior admin session. |
| Theme/viewport checks | Six light/dark captures at widths 1280/800/390, height 900; no horizontal overflow and visible error. Desktop light and mobile dark were visually inspected. Recovery-code/password inputs were masked in every capture. |
| Standards AI skill | Extended the conditional auth-feedback reference with operator-armed recovery ownership, fixture safety and evidence rules; quick validation passed. |
| Final `validate:fast` | 10,777 passed: 5,616 server, 4,464 client and 697 script tests; static policy, lint, hygiene and both builds passed. The 225 existing Vue warnings remain visible. |

The final browser and fast-build client manifests match on the frozen source.
Four lightweight ownership tests join routine client feedback; the native
browser/route cohort stays outside fast feedback. No skips/cancellations or
unchanged exhaustive PostgreSQL/engine-zoom matrix reruns were used. One complete
stable fast gate followed final review; the superseded preliminary run is not
final-source qualification. No whole-suite speed or complete I/O quiescence claim
is made.

The successful native cohort is separate from the earlier pre-terminal-focus
cohort. A preliminary fast run was superseded when final review added the missing
focus target for removed/disabled controls; its log remains separate from final
qualification. Existing deadlines, worker policy and assertions were not relaxed.

## Recommendations and limits

The [design](RECOVERY_FORM_FEEDBACK_DESIGN.md) records the request/focus boundary.
The [research](RECOVERY_FORM_FEEDBACK_RESEARCH_2026_10.md) maps MCP-discovered W3C,
OWASP and Vue guidance to decisions, pros/cons and the stack: native controls,
shared feedback/confirmation, one recovery-specific state owner, existing server
verification, focused race tests and real browser/PostgreSQL evidence. This client
admission fence does not replace server checks or certify transport quiescence.

No dependency/application version, branch, release or tag was created. MCP
searches found zero open PRs, so no applicable random PR, rebase or stale-PR
closure was available. The separate [Docker outcome](LOCAL_DOCKER_RECOVERY_FORM_FEEDBACK_OUTCOME.md)
records the requested preserved no-cache rebuild.

Actual screen-reader speech, physical safe-area/keyboard checks and platform-wide
WCAG conformance remain unqualified. The prepared manual acceptance is still
deferred. This work does not qualify concurrent server recovery completions or
other untested authority races.

Next recommended fix: make the recovery countdown reactive with an owned timer
and cleanup. A separate controlled clock probe advanced 91 seconds past a
90-second expiry while the cached display still returned 90. Native server expiry
refusal passed independently. Preserve that server authority, avoid live-region
announcements every second, and prove timer disposal and wake/revalidation when
implementing the display fix.
