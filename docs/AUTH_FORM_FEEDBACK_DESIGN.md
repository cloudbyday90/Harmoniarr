# Authentication form feedback

## Problem and scope

Login errors and bootstrap/account-claim password mismatches are rendered as
plain paragraphs. Confirmation has no invalid-state/description relationship;
submit leaves focus on the button. Correcting the password can leave a stale
global mismatch error beside a matching hint. Login's local/Plex handlers also
have independent pending admission.

Qualify and fix the three entry forms using real browser DOM, keyboard and HTTP
evidence. Actual screen-reader/device acceptance remains deferred. No auth API,
session, CSRF, password policy, claim-code authority or database changes belong
to this slice.

## Owners

Use a small `useAuthSubmission` composable to own one pending action, its polite
progress text and server error. Duplicate/local-versus-Plex admission returns
without clearing or replacing current feedback. It does not retry uncertain
POSTs. Existing API/session services still own requests and navigation.

Use `AuthFormFeedback` for persistent status/alert containers, outside any busy
ancestor. Interpolate error text; do not render HTML. Generic auth failures do
not identify an allegedly wrong credential or move focus after an asynchronous
response. Keep native required/type validation and password autocomplete/paste.

Use `usePasswordConfirmation` around the existing match policy. Local mismatch
marks confirmation touched, updates aria-invalid and its linked hint, and focuses
confirmation after Vue flush only if focus still belongs to that invocation.
Only the local hint describes mismatch; correcting either field updates it and
removes invalid state without stale generic mismatch text. No server request is
sent for a local mismatch. Do not make per-keystroke hints assertive alerts.

## Validation and outcome

Record the pre-change browser failure, then test state/admission/failure/focus
ownership at composable boundaries. Native browser cases exercise all three
built views, real bootstrap/login/claim refusal, held responses, preserved user
focus, no duplicate/Plex dispatch, keyboard correction and successful bootstrap/
login. Check representative themes/viewports and inspect screenshots. Browser
DOM/live-region evidence is not proof of spoken output or WCAG conformance.

Finish the stable fast gate once and the requested preserved no-cache Docker
walkthrough. Separate [research](AUTH_FORM_FEEDBACK_RESEARCH_2026_10.md) and
[outcome](AUTH_FORM_FEEDBACK_OUTCOME.md) record tradeoffs and actual results.
