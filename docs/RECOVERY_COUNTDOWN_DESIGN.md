# Recovery countdown design

The recovery form previously cached its countdown because `Date.now()` was the
only changing input inside a Vue computed value. The controlled baseline read
90 seconds, advanced the clock 91 seconds and still read 90. A constant server
expiry returned by polling did not invalidate that computed dependency.

## Ownership and behavior

`useExpiryCountdown` is a small ESM composable with an explicit refresh/destroy
contract. It derives remaining time from the deadline and current wall clock on
every callback; it never decrements a remembered counter. It owns one timeout,
caps normal updates at once per second and schedules the final fractional second
at the deadline. Ceiling display keeps one second visible until actual expiry.
Missing or malformed deadlines produce zero rather than `NaN` admission.

`useRecoveryStatus` refreshes that owner after accepting status, on visibility
changes and before submission. Hidden pages stop the display timer. Visible wake
updates immediately before awaiting server revalidation, including offline or
held reads. Completion and destruction retire ticking. Existing revision fences,
single POST/failure-refresh ownership and poll scheduling remain in that owner.
The view still destroys it on unmount.

Submission refreshes wall time before client admission and again after the DOM
flush, immediately before dispatch. An expired client sends no POST. This is a
usability guard: server expiry, attempts, holds, single-use completion and session
revocation remain authoritative. Clock skew, OS clock changes and background
suspension prevent a browser timer from establishing security authority.

The displayed number has a named `timer` role with implicit live announcements
off. Expiry supplies one binary message through the already-mounted polite
feedback owner. Ticks do not enter that region or move focus. Automatic expiry
disables the form; rearming remains an explicit operator action.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Poll-only computed display | Little code | Constant expiry stays cached; coarse/offline updates | Reject |
| Decrementing interval | Simple apparent countdown | Drifts under delayed callbacks and suspension | Reject |
| Global shared clock singleton | Shares ticks among many consumers | Unnecessary lifetime/coupling for one recovery page | Defer until demonstrated demand |
| Owned deadline-based timeout | Small modular owner, immediate wake, explicit cleanup | Caller must refresh on accepted deadline/lifecycle changes | Adopt |
| Server expiry enforcement | Trusted final admission, attempts and replay protection | Network refusal may arrive after local clock appears valid | Retain independently |

Use the owned clock, recovery-specific command/status owner, quiet timer semantics
and server safeguards together. Validate timer arithmetic/lifetime with virtual
time, then the built form with native HTTP/PostgreSQL. Keep preserved-installation
Docker readiness separate from armed recovery qualification.

See [official research](RECOVERY_COUNTDOWN_RESEARCH_2026_10.md) and
[outcome](RECOVERY_COUNTDOWN_OUTCOME.md). No dependency, server, schema or release
change is required by this design.
