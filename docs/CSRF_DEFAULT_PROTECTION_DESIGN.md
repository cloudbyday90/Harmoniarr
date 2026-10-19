# Default CSRF protection design

Date: 2026-10-19. Follow the [runtime outcome](RUNTIME_DEPENDENCY_QUALIFICATION_OUTCOME.md)
by reconciling default browser-write protection with [security policy](SECURITY_POLICY.md).
Keep existing session-bound token generation, validation and narrow public auth
exceptions. Work on main; no release, dependency migration or new auth system.

## Boundary and compatibility

The shared resolver currently maps absent, blank and non-string inputs to disabled.
Settings defaults and submitted patches use it. Settings loading overlays saved
JSON onto defaults, and the request policy gives a non-null saved value precedence
over environment. Settings mutation and logout invoke the existing CSRF guard
before durable work. This proves a missing default guard, not a demonstrated
arbitrary foreign-site browser exploit: Strict cookies and JSON body checks
already constrain browser requests.

Change the existing small ESM policy service rather than introduce another
middleware/singleton. Resolve missing/null/blank configuration to required;
accept normalized required/disabled strings; reject other types and invalid
strings. An explicitly supplied policy environment must not fall through to
ambient process environment when its CSRF entry is absent.

| Configuration | Result |
| --- | --- |
| No saved value and no environment value | required |
| Older database without a CSRF row | inherits required on the new process |
| Saved required/disabled | saved value wins environment |
| Saved null | environment, then required |
| Blank saved/environment string | required |
| Boolean, number, array or object | invalid configuration; never an implicit opt-out |

Preserve explicit saved disabled values because the database cannot establish
whether an earlier setting was intentional. Do not rewrite those rows or seed
disabled for older installations. No SQL migration is needed for missing rows.
Document operator review of old opt-outs. Keep the walkthrough's existing explicit
local opt-out visible. Keep bootstrap/login/public claim and refresh exceptions;
logged-in logout and ordinary settings writes remain protected.

## Evidence plan

Run a native pre-fix request without a CSRF header and a valid control, then
prove default refusal without saving required first. Verify missing, wrong and
another session's token leave PostgreSQL rows unchanged. A valid token persists
the intended write. Seed older settings before app creation to test missing-row
and explicit-opt-out startup; verify opt-out/re-enable persistence and auth
bootstrap/login/refresh compatibility. Reuse current fixtures and actual cleanup.

Use focused policy/validator/caller tests, selected native files, the fast static/
unit/build gate and an actual browser settings save. Keep source/lock and built
assets bound to evidence; do not rerun the complete media/database inventory.
Security proof output uses the security plugin's managed temporary collection and
a disposable copy of main; implementation and committed documents stay in the
primary checkout. Retain failures and import necessary evidence persistently.
The independent security review checks the candidate once before final gates.

Random PR 50 is evaluated separately in the disposable copy. Install its exact
package pair, reproduce the reported router composition and wrapping control,
then restore original bytes if it still fails. Do not merge the PR or keep an
unqualified dependency simply because it was selected randomly.
