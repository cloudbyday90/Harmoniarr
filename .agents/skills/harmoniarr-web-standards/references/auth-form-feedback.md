# Authentication form feedback

Use for login/bootstrap/account-claim and operator-armed recovery feedback or
submit admission changes.
Discover/open current W3C, framework and OWASP sources through MCP; distinguish
normative WCAG criteria from informative techniques and project policy. The
[research](../../../../docs/AUTH_FORM_FEEDBACK_RESEARCH_2026_10.md) maps this slice.

Trace the built form, client API/session owner, server refusal and navigation.
Keep standard input types, labels, required validation, autocomplete and paste.
Do not infer which credential is wrong from a generic server failure, render
server text as HTML, log credentials or retry an uncertain authentication POST.

Keep status/alert containers mounted before their text changes and outside busy
ancestors. Flush a cleared alert before repeating identical error text. Use one
pending owner for competing local/Plex actions; disabled buttons alone do not
own handler admission. This client guard does not replace server rate limiting,
session/CSRF or claim-code authority.

Known local mismatch can mark confirmation invalid and associate its correcting
hint. Mark touched on submit, then focus after DOM flush only while that submit
still owns focus. A later focus owner or unmounted input wins. Correcting either
password must clear invalid state and stale mismatch feedback. Use a polite
binary match hint rather than assertive per-keystroke feedback. A generic async
server error is global and must not steal focus or mark an arbitrary credential.

Prove native keyboard/DOM/HTTP behavior and accepted payloads for each adopter,
including held responses, same-error retry, no duplicate request and successful
bootstrap/login. Keep controlled Plex failure separate from actual provider
authorization. Report viewport/theme and manual AT/device coverage honestly;
role/description assertions do not establish spoken output or full conformance.

For operator-armed admin recovery, keep the recovery-specific POST/refresh owner.
An invalid code can consume an attempt: refresh availability/budget in place
without clearing its error or ending pending admission early. Fence old status
reads against newer reads, submit, completion and destroy; the fence prevents
state publication, not arbitrary transport completion. Keep feedback mounted
even when the form disappears. Prove actual server hold/expiry/attempt refusals,
session revocation, code replay refusal and explicit subsequent login in a fresh
fixture. Never arm the user's live installation to prepare this proof. Mask codes
and passwords in screenshots and keep captured secrets out of evidence/logs.
Do not announce countdown seconds repeatedly or treat a cached client clock as
server expiry authority. See the recovery [design](../../../../docs/RECOVERY_FORM_FEEDBACK_DESIGN.md)
and [outcome](../../../../docs/RECOVERY_FORM_FEEDBACK_OUTCOME.md) before adoption.
