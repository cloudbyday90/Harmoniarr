# Expiry countdowns and time-sensitive admission

Use when a countdown or expiry-dependent command can become stale. Trace the
rendered value, timer owner, accepted deadline, visibility lifecycle and actual
server authority before selecting a fix. Consult current primary sources through
MCP; the recovery [research](../../../../docs/RECOVERY_COUNTDOWN_RESEARCH_2026_10.md)
maps Vue, WHATWG, WAI-ARIA, OWASP and controlled browser time for this slice.

Check whether the framework tracks time at all: `Date.now()` in a computed value
does not create a reactive dependency. Recompute from the deadline on each tick;
counting callbacks drifts when timers run late. Choose rounding explicitly and
keep invalid dates finite and conservative for command admission.

Give each timer an owner. Refresh after accepting/replacing a deadline and on
visible wake before awaiting network status. Pause unnecessary hidden display
work; stop after completion and destroy. Refuse post-destroy callbacks and late
status publication. Prefer an existing page/composable lifetime to a global clock
unless measured consumers justify sharing it.

Check current time in the command handler, including after any pre-dispatch
await. A reactive disabled button can still be stale after suspension. This local
guard never replaces server expiry, single use, attempt limits or session policy;
clock skew means client and server can disagree.

Keep numerical ticks out of status/alert announcements. A named `timer` has
implicit live=off; publish meaningful expiry separately in a stable feedback
owner. Do not move focus merely because time passed. Browser role/text assertions
are not proof of screen-reader speech or a physical tab/OS wake.

Use virtual time for unchanged deadlines, delayed callbacks, exact boundaries,
replacement, malformed input, hidden wake, completion and disposal. Prove handler
admission without running the display timer. Then test the built consumer with
native status/authority and owned cleanup. Install browser clock controls before
navigation/timer usage. Label synthetic visibility and browser-clock inputs
separately from native database time and actual server expiry refusals. Do not arm
a preserved installation or log recovery credentials to prepare evidence.

The recovery [design](../../../../docs/RECOVERY_COUNTDOWN_DESIGN.md) and
[outcome](../../../../docs/RECOVERY_COUNTDOWN_OUTCOME.md) record this implementation
and its qualification limits.
