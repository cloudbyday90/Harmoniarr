# Recovery countdown research — October 2026

Consulted October 21, 2026. URLs were found through connected MCP web search or
official navigation and opened through that service. Rolling documentation is
evidence consulted on this date, not a claim about every future October update.

| Primary source | Status and applicable guidance | Project decision |
| --- | --- | --- |
| [Vue computed properties](https://vuejs.org/guide/essentials/computed) | Framework documentation: computed caching follows reactive dependencies; `Date.now()` alone is not reactive | Publish remaining seconds through a ref |
| [Vue composables](https://vuejs.org/guide/reusability/composables) | Framework documentation: clean up manually created effects | Explicit countdown destroy composed into the existing view cleanup |
| [WHATWG timers](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html) | Living Standard: callbacks can be delayed by other work; exact scheduling is not guaranteed | Recalculate deadline minus wall time rather than counting callbacks |
| [WHATWG page visibility](https://html.spec.whatwg.org/multipage/interaction.html) | Living Standard, page visibility section; page state and visibility changes are browser inputs | Pause hidden display work; refresh immediately on visible wake |
| [WAI-ARIA 1.2 timer](https://www.w3.org/TR/wai-aria-1.2/) | W3C Recommendation, timer role: content represents elapsed/remaining time and has implicit live=off | Named timer, no per-second polite/assertive announcements |
| [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html?trk=public_post_comment-text) | Informative security guidance: expiring single-use recovery material and protection against guessing | Preserve existing server expiry/attempt/hold/replay controls; no client authority |
| [Playwright clock](https://playwright.dev/docs/clock) | Tool documentation: install clock emulation before timer usage; controlled advancement avoids real countdown waits | Install on the blank test page before navigation, distinguish browser time from native server time |

The deadline-based timeout and fail-closed malformed-date policy are engineering
decisions inferred from these sources and the current recovery contract. They are
not a W3C prescription for a particular Vue implementation. The operator-armed
local-admin flow is distinct from OWASP's email reset examples.

## Recommended practice stack

1. Vue reactivity and lifecycle ownership for correct local state.
2. WHATWG timer/visibility semantics for delayed callbacks and wake behavior.
3. WAI-ARIA quiet numerical updates plus a separate meaningful expiry message.
4. OWASP-informed server enforcement of expiry, budgets and single use.
5. Controlled-time unit checks and one built native consumer, with explicit limits.

This adds no timer dependency and no new network retry. It avoids real multi-minute
waits in tests, while retaining actual HTTP/database recovery refusals in the
selected native cohort. It does not establish whole-suite speed, spoken output,
physical-device behavior or complete WCAG conformance.

See the [design tradeoffs](RECOVERY_COUNTDOWN_DESIGN.md) and
[validated outcome](RECOVERY_COUNTDOWN_OUTCOME.md).
