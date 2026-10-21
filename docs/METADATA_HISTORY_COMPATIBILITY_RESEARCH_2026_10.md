# Metadata compatibility: official sources and choices

Consulted October 21, 2026. URLs were discovered through MCP search and opened
before applying the guidance. Installed Playwright is 1.64.1; record actual
executed browser versions with the outcome instead of treating website prose
or a browser registry as launch evidence.

| Official source and status | Application |
| --- | --- |
| [W3C Reflow understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), informative WCAG 2.2 guidance | Use 320 CSS pixels as a reflow target. Qualify the short 320x256 case as well as narrow/tall mobile geometry; keep actual browser zoom separate. |
| [W3C technique C43](https://www.w3.org/WAI/WCAG22/Techniques/css/C43), informative sufficient technique | Pair scrollable room with scroll padding to clear fixed content. Use the shell's real scroll owner rather than teaching each control the navigation height. |
| [CSS Scroll Snap](https://drafts.csswg.org/css-scroll-snap/), CSSWG editor's draft | Scroll padding changes the optimal viewing region for focus and scroll-into-view without changing layout; it applies without snapping. Native engine proof remains necessary. |
| [Playwright browsers](https://playwright.dev/docs/browsers), framework documentation | Use its matched bundled engines. WebKit engine coverage does not certify released Safari, its platform integration, or iOS. |
| [Playwright BrowserType](https://playwright.dev/docs/api/class-browsertype), public API documentation | Select the engine explicitly and retain isolated browser/context ownership. Custom browser arguments need bounded qualification. |
| [Playwright accessibility testing](https://playwright.dev/docs/next/accessibility-testing), development documentation | Automated checks cover only part of accessibility; manual assessment and inclusive testing remain separate. Do not infer speech announcements from accessible roles. |
| [Playwright extension support](https://playwright.dev/docs/next/chrome-extensions), development documentation | Actual Chromium zoom can use a fixture extension in a fresh persistent context with the bundled chromium channel. This is test tooling, never a user's profile or a product extension. |
| [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs?hl=en), vendor API documentation | Set and read actual tab zoom. Keep control scoped to the owned tab/profile and verify the effective viewport. |
| [Playwright maintainer clarification](https://github.com/microsoft/playwright/issues/33828), issue discussion | A DOM Control-plus/minus event does not establish browser-shell zoom. This supports avoiding a misleading test shortcut, not a new application requirement. |

The optional lane is a project recommendation from these contracts. Existing
server authorization/CSRF and safe history GET semantics keep their owners;
engine or focus capabilities do not grant domain write authority.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Run all browser tests on all engines by default | Broad interaction coverage | Multiplies ordinary runtime and browser installation cost | Defer |
| Explicit bounded compatibility lane plus unchanged default Chromium selection | Repeatable native engines, focused cost, no global engine switch | Covers this journey rather than every route | Recommend |
| Shared mobile scroll-container clearance | Covers native field focus and explicit history reveal with one chrome owner | Affects mobile scroll positioning across views; needs consumer checks | Recommend after native field diagnostic |
| Device scale/CSS zoom as a substitute for real tab zoom | Easy to automate | Different behavior; cannot establish actual browser zoom | Reject as zoom proof |
| Owned native tab zoom plus separate reflow matrix | Actual zoom API and geometry evidence | Chromium-specific control; fresh profile/extension cleanup needed | Qualify separately |
| ARIA assertions as a substitute for screen-reader testing | Cheap structural checks | Does not establish spoken output or user usability | Reject as assistive-technology proof |

Recommended stack: W3C observable reflow/focus outcomes; matched Playwright engine
capabilities; native session/GET fixtures; small ESM session lifetime owner;
separate actual-zoom evidence and manual AT/device checks; one stable fast gate
and preserved-state Docker verification. Keep the compatibility lane explicit
until executed evidence supports expanding its routine scope.
