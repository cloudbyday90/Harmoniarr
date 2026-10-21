# Recovery form feedback and request ownership

## Reproduced problem

A disposable real-app baseline submitted a password mismatch without focusing
or describing confirmation. A real invalid recovery code consumed one attempt;
the following loadStatus call removed its error and left no alert. The code also
allows duplicate submit handler admission and late status reads to compete with
completion. Server recovery authority is separate and remains unchanged.

## Decision and owners

Reuse AuthFormFeedback and usePasswordConfirmation for persistent status/alert
containers and linked local correction. Keep the recovery-specific request owner
in useRecoveryStatus: it must retain the POST error while refreshing remaining
attempts and lock/availability state. A general login submission wrapper would
add a second pending owner and lose this refresh contract.

One submission spans the POST and its failure refresh. Close duplicate/destroyed/
completed or currently unavailable/blocked admission before clearing feedback.
Flush a cleared alert before dispatch; do not automatically retry the POST.
Fence status reads against newer reads, submission, completion and destruction.
Stop polling during submission/completion and dispose the existing visibility
listener. These client checks do not authorize recovery; native server expiry,
attempt threshold, code verification, maintenance holds and session revocation
remain required.

Place feedback outside conditional loading/form branches so a refusal remains
available when recovery becomes unavailable. Use the existing themed surface
for readable feedback; empty live owners remain offscreen instead of adding blank
cards. Do not announce the changing seconds
as a live stream. Known local mismatch identifies confirmation; generic server
errors identify no specific credential. Keep native labels/types/autocomplete
and escaped text. Restore the enabled invoker after failure; move owned focus
to the persistent named feedback region if a hold or terminal refusal disables
or removes that invoker. Completion has its own heading target. Retain a user's
later focus move in either case.

## Validation and scope

Use focused controlled races and Error/null tests, then native built UI with
fresh PostgreSQL and an armed disposable recovery run. Prove local mismatch
causes no POST/attempt, invalid code remains visible after refresh, one pending
POST, actual successful recovery/revoked session and server lock/expiry/attempt
refusals. Use existing route integration tests as affected server consumers.
Record theme/viewport checks and actual limits. Manual speech/device acceptance
remains deferred. Keep countdown reactivity as a separately evidenced follow-up.

See [research](RECOVERY_FORM_FEEDBACK_RESEARCH_2026_10.md) and
[outcome](RECOVERY_FORM_FEEDBACK_OUTCOME.md). Finish one stable fast gate and the
requested preserved-state no-cache Docker walkthrough before publication on main.
