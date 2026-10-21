# Manual accessibility sessions

Use when DOM/engine checks have passed but actual speech, AT reading order,
browser-shell zoom or physical safe-area/keyboard acceptance remains open.

Discover/open current primary sources through MCP. WCAG-EM 2.0 is a July 2026
W3C Group Note, not a new set of normative WCAG criteria. Its recordkeeping
guidance and WAI user-evaluation guidance help define the sample and report
scope. Keep OWASP fixture containment and HTTP safe-method semantics separate
from accessibility behavior. The project's [research](../../../../docs/METADATA_HISTORY_MANUAL_FIXTURE_RESEARCH_2026_10.md)
records source status and tradeoffs; saved URLs alone are not current verification.

First identify who can perform the actual AT/device work. If unavailable,
prepare the reachable states and report that acceptance remains unperformed.
Do not replace missing speech evidence with an ARIA tree, focus assertion,
Playwright WebKit session or an automatic "pass" field.

For Metadata history, use `npm run manual:metadata-history` and follow the
[procedure](../../../../docs/METADATA_HISTORY_MANUAL_ACCESSIBILITY.md). It serves
the actual built UI/session with synthetic read owners, a fresh owned database
and terminal hold/fail controls. Provider-backed GETs and domain commands are
refused before app dispatch. Do not add HTTP test controls, use production events
as fixture preparation or expose the loopback server to another device ad hoc.
Reset/reload between samples; retain the same cursor when retrying a failed read.
The explicit `validate:metadata-history-manual-fixture` command qualifies these
states using native HTTP/PostgreSQL/Chromium; it does not execute manual acceptance.

For session lifetime changes, observe stop input before setup and seal buffered
command admission. A signal is not completion: drain an admitted Docker command
before exact owned cleanup, and keep cleanup failures visible after expected stop.
The [cancellation design](../../../../docs/MANUAL_SESSION_CANCELLATION_DESIGN.md)
records these boundaries and the difference between controlled signal events,
actual CLI close and OS-delivered signals. Keep desktop fixture preparation
separate from a global viewport-fit change that needs actual device evidence.
The explicit Linux [signal lane](../../harmoniarr-testing-validation/references/manual-session-signals.md)
qualifies real input/runner signals with a controlled session dependency; it does
not execute speech/device acceptance or full HTTP/PostgreSQL signal shutdown.

Record the evaluated source/version, OS, browser and AT versions, input mode,
actual zoom/effective viewport, theme and exact steps. For physical safe areas,
record real hardware and an observed nonzero inset; emulated naming or injected
CSS cannot supply that evidence. Store credentials/recordings privately and
publish bounded reviewed observations with pass/fail/unperformed by step.
After a reproduced failure, fix the owning production boundary and add focused
regression evidence, then repeat the affected operator step. Do not generalize a
single pairing or a prepared fixture into platform-wide WCAG conformance.
