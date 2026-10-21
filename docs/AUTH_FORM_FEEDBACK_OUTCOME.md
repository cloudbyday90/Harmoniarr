# Authentication form feedback outcome

Completed October 21, 2026 on main. Login, bootstrap and account claim now share
a small ESM submission owner and persistent Vue status/alert component. Known
local mismatch links confirmation to its current polite hint and invalid state.
Submit focuses confirmation after Vue flush only while the invocation still
owns focus; corrected/unmounted fields do not receive stale focus. Correcting
either password clears mismatch without a stale global mismatch error.

Login and Plex share pending admission. Credentials are captured before deferred
dispatch; duplicate submissions preserve the first owner's feedback. Existing
API/session services still own authentication and awaited router navigation.
There is no automatic POST retry. Native labels, required/type validation,
autocomplete and paste behavior remain in place. Generic server failures render
as escaped alert text, leave credentials without invented field-specific invalid
state, and preserve a user's later focus move. Empty live owners use the existing
screen-reader-only utility so they add no blank grid spacing.

## Reproduction and qualification

The original real-app baseline recorded a submitted mismatch with confirmation
unfocused and no aria-invalid/aria-describedby. An actual 401 login failure
rendered zero alerts. Those observations and the baseline screenshot remain in
`.tmp/auth-form-feedback-2026-10-21/`.

Final non-Markdown source: 3,235 files, SHA-256
`3519a0ed7d767afbfc9bf93b36dd9aff152cd72fa946486c625b310a5badaa0d`.

| Executed check | Result |
| --- | --- |
| Focused client state/API/navigation tests | 36 passed, including four new tests for competing admission, repeated immediate Error/null failures, local correction and focus ownership. |
| Native built UI, fresh PostgreSQL and real auth HTTP | Three passed: mismatch sends no bootstrap/claim POST; actual bootstrap creates one admin; actual invalid login/claim responses appear in alerts; same-error retry clears/repopulates; successful login navigates; held responses preserve focus and one request owner. |
| Controlled Plex HTTP refusal | Pending status and local/Plex exclusion passed; no live provider authorization was attempted. |
| Theme/viewport evidence | Six light/dark login-error captures at widths 1280/800/390, height 900; no horizontal overflow and visible error. Desktop light and mobile dark screenshots were visually inspected. |
| `validate:fast` | 10,773 passed: 5,616 server, 4,460 client, 697 script tests. Static policy, lint, hygiene and builds passed. The 225 existing Vue warnings remain visible. |
| Standards AI skill | Added conditional auth-feedback guidance and routing; quick validation passed. |

The browser and final-build client manifests match. The complete fast gate ran
once after final source review. No skipped/cancelled tests, relaxed deadlines,
global worker changes or full unchanged PostgreSQL/engine-zoom matrix reruns were
used. Four lightweight client tests join routine feedback; native browser cases
stay outside fast feedback. This is not a whole-suite speed benchmark.

The first browser candidate passed bootstrap but failed on test-harness mistakes:
an idle-only login button locator no longer matched pending text, and the claim
test used the wrong application path. Their failed log/screenshots remain
separate from reviewed/final passing logs. The harness was corrected without
changing timeouts or production assertions.

## Research, limits and next work

The [research](AUTH_FORM_FEEDBACK_RESEARCH_2026_10.md) records MCP-discovered W3C,
Vue and OWASP sources, status, pros/cons and the recommended stack. The
[design](AUTH_FORM_FEEDBACK_DESIGN.md) records ownership and the correction path.
No auth route, schema, session/CSRF, password policy or server rate-limit boundary
changed. This client admission guard does not supply those security guarantees.

Native DOM/keyboard/HTTP evidence does not establish screen-reader speech,
physical keyboard/safe-area acceptance or platform-wide WCAG conformance. Those
manual checks remain deferred. Successful account claim and live Plex
authorization were not qualified by the invalid-claim/controlled-Plex cases.

MCP searches returned zero open PRs, so no random PR, rebase or stale-PR closure
was available. Changes stay on main with no dependency/application version bump,
branch, release or tag. The separate [Docker outcome](LOCAL_DOCKER_AUTH_FORM_FEEDBACK_OUTCOME.md)
records the preserved no-cache walkthrough.

Next code recommendation: evaluate the same older feedback pattern in
`RecoveryView.vue` using a disposable armed recovery run, then adopt the shared
feedback only with native expiry, attempt-budget and safety-hold refusal proof.
Keep those server gates intact. Actual operator/device acceptance of the
[prepared procedure](METADATA_HISTORY_MANUAL_ACCESSIBILITY.md) also remains open.
