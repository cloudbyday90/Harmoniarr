# Browser Validation CI Compatibility — Design

**Status:** Implemented; remote confirmation pending
**Date:** 2026-08-29

## Finding

The first successful dependency-install attempt in the new Browser Validation
workflow exposed three browser-suite failures that had not appeared locally:

- At a 390px viewport, the Current automation disclosure's horizontal summary
  overflowed by 15px.
- Two scenarios reached a visible UI state locally but exhausted a 10-second
  Playwright default action timeout on the two-worker Linux runner.

The browser runtime was intended to use Harmoniarr's integration request
timeout (15 seconds by default), but the integration runtime did not pass its
validated configuration through the scenario context. The browser layer
therefore silently used its 10-second fallback.

## Decision

1. Preserve the two-worker limit and the 20-minute CI cap. This failure is
   neither evidence of a cleanup leak nor authorization to raise concurrency.
2. Make the disclosure summary stack its status beneath the explanatory
   heading at the mobile breakpoint. Its heading has a zero flex minimum so
   text can reflow rather than widening the panel.
3. Pass the existing validated integration configuration into each scenario
   context, then use that configuration for Playwright's default action
   timeout.
4. Keep a bounded 10-second fallback for direct runtime use without a
   configuration object. Do not disable timeouts, insert fixed sleeps, or add
   retry loops.
5. Cover timeout resolution with a small ESM unit test, run the three failed
   files at two-worker concurrency, and rerun the full browser suite before
   requesting a fresh CI sample.

## Options considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Reduce browser concurrency to one | May hide timing pressure | Loses the agreed capacity signal and does not fix the defects | Reject |
| Disable Playwright action timeouts | Avoids short failures | Can leave broken CI hanging until the job cap | Reject |
| Add fixed delays to affected tests | Superficially simple | Creates slower, flakier tests without a state signal | Reject |
| Increase only individual test waits | Limits blast radius | Duplicates a configuration value that the runtime already owns | Reject |
| Restore the configured bounded timeout and fix mobile reflow | Retains deterministic locator waits and makes the UI usable | Requires a small context and CSS correction | **Adopt** |

## W3C and test-model alignment

WCAG 2.2 Success Criterion 1.4.10 requires content to reflow without loss of
information or functionality at the equivalent of a 320 CSS pixel width. The
390px browser assertion is a practical regression guard above that baseline;
the corrected flex layout makes the disclosure summary readable without
horizontal overflow.

Playwright documents `page.setDefaultTimeout()` as the configurable bounded
maximum for locator actions and explicitly discourages time-based waits in
tests. Harmoniarr continues to wait for semantic visible controls and retains
its 90-second per-scenario ceiling rather than adding sleeps or unbounded
retries.

## Recommendation stack

1. Keep two browser workers and inspect a successful ten-run evidence sample
   before considering a capacity experiment.
2. Test responsive disclosures at a narrow viewport with overflow assertions.
3. Propagate one validated integration configuration through all browser
   scenarios so UI action limits cannot drift from test-runtime policy.
4. Keep bounded, state-based Playwright locator waits; never use sleeps as a
   test-readiness mechanism.

## Official sources checked 2026-08-29

- [Playwright Page API: default timeouts](https://playwright.dev/docs/api/class-page)
- [Playwright BrowserContext API: default timeout precedence](https://playwright.dev/docs/api/class-browsercontext)
- [W3C WCAG 2.2, Success Criterion 1.4.10 Reflow](https://www.w3.org/TR/WCAG22/)
