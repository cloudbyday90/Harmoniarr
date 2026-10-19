# Default CSRF protection outcome

Date: 2026-10-19. The [design](CSRF_DEFAULT_PROTECTION_DESIGN.md) and
[official recommendations and tradeoffs](CSRF_DEFAULT_PROTECTION_RESEARCH_2026_10.md)
cover this follow-up to runtime qualification.

## Implemented boundary

The existing deployment-security-service resolver now requires protection for
missing/null/blank configuration and rejects malformed non-string values instead
of turning them into disabled. Explicit normalized required/disabled values
retain their behavior. An explicitly supplied environment cannot accidentally
inherit an ambient process opt-out when its CSRF key is absent.

Settings without a saved CSRF row inherit required protection. Saved non-null
values retain precedence over environment; explicit disabled rows are preserved
because their intent cannot be reconstructed. No schema migration or blanket
rewrite is needed. The existing policy cache starts required when configuration
is absent, including after a first-load failure. Explicit deployment opt-outs and
the existing settings-load cache behavior otherwise remain unchanged.

Existing routes still validate session-bound cookie/header/hash tokens before
protected writes. Bootstrap, login and refresh keep their narrow exceptions;
logged-in logout remains protected. Settings copy recommends required protection
independently of HTTPS options. README documents precedence and upgrade review;
the local walkthrough's explicit loopback opt-out remains visible.

## Executed evidence

- Pre-fix native reproduction: missing-header settings mutation and logout both
  returned 200 where default-required tests expected 403. The other two native
  role/revocation controls passed. This proves the missing guard without claiming
  a foreign-site browser exploit.
- Focused final policy/validator/route/client checks: all 122 passed; focused lint
  passed. Malformed types cannot normalize into an opt-out; saved/environment
  precedence, isolated environments and cached first-load failure are covered.
- Final selected native collection: 11 passed across runtime-http-contract,
  csrf-settings-upgrade and auth-settings-recovery. No failures, skips or
  cancellations. Missing/wrong/stale/cross-session tokens refuse before durable
  settings changes; valid tokens persist writes. Headerless public login/refresh
  still work while logged-in logout refuses missing protection. Seeded legacy
  missing/disabled/required settings are read before app creation, and protected
  re-enablement persists without accepting a headerless mutation.
- npm audit: zero reported vulnerabilities at consultation time.
- Final validate:fast: all 10,518 passed (5,463 server, 4,384 client and 671
  scripts), with zero failures/cancellations/skips. Static policy checks, lint,
  hygiene and both builds passed.
- Final Chromium: the new default-protection settings case and existing requester
  role/request journey both passed. A real browser-context headerless request
  returns 403 with unchanged rows; the rendered UI submits the actual token and
  persists its log-level change while keeping required protection.
- Testing and repository/installed web-standards AI skills pass skill validation;
  all four installed standards mirror files match repository bytes.

Independent read-only boundary and candidate reviews found no concrete defect
in the production candidate. The startup fixture initially assumed its observed
preparation wrapper exposed query; it exposes connect. Correcting it to borrow
and release the existing client resolved all three fixture failures. The initial
unit environment mock also required an existing property; explicit scoped
try/finally restoration corrected that fixture error. Failed collections remain
separate evidence; no retries, timeout increases or warning suppression changed.
The first browser fixture waited for Save settings after editing, while the
actual dirty-state label is Save changes. Correcting the selector and observing
click/response together resolved that fixture failure. Final fast/native gates
were repeated after the correction and line-ending normalization; earlier green
collections are retained under their own source identities.

Final source identity is 3,038 files, SHA-256
7d3421b854c7a5d82dc8eaabbeef41804fa72a2b3cf2c45cd064488621927c3c.
Primary and validation copies match; all seven changed code files match the
tested bytes. The 151 built client assets match before/after browser work.
Staging is checked against the same frozen code. The final fast command took
about 98 seconds; this is descriptive timing under current host load with some
native overlap, not a matched benchmark or CI speedup.

Discovery finds 132 integration files; three selected files ran and the other
129 were not freshly rerun. Two selected browser files are not the complete
browser suite. Existing Vue test and TestsStream listener warnings remain visible.
Security validation runs in a disposable copy of main with managed temporary
output; source changes remain in the primary main checkout. Required logs,
failed probes, hashes, reviews and final gate evidence are retained through the
security plugin's target-bound persistent collection under artifacts/csrf-default.
The [random PR 50 evaluation](OPEN_PR_50_LOCAL_EVALUATION_OUTCOME.md) is independent
and retains the working Router version after a reproduced candidate failure.

## Scope and next recommendation

This closes the absent/default CSRF guard at existing protected routes. It does
not certify every route, arbitrary cross-site exploitability or complete web
security. Strict cookies, JSON restrictions and absence of permissive CORS are
separate controls. Intentional disabled settings remain opt-outs and should be
reviewed by operators on upgrade. No new Origin/Fetch Metadata policy, cookie
format, cryptography, auth exceptions, production image or release is introduced.

Next, fix the repeatedly observed TestsStream end-listener ownership warning
with a focused reproducer and lifecycle checks. Keep listener-limit increases
and warning suppression out of that fix; reduce redundant validation work only
after proving reporter completion and cleanup. Requalify Router independently
when a suitable candidate is available.
