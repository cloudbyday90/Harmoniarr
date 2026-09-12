# Deterministic polling tests

Design reviewed on September 12, 2026.

Two request-detail and candidate-pipeline tests used short wall-clock sleeps to infer that polling had reached a terminal response. Under parallel validation, the event loop could reach the assertion before the third fetch. Increasing those deadlines would retain the same scheduling assumption.

Use Node's test-context MockTimers for `setTimeout`, advance one 30 ms poll interval at a time, and allow the async fetch and Vue publication to settle between ticks using an unmocked promise-based `setImmediate`. Assert the second response remains active, the third is terminal, and several additional virtual intervals produce no fourth fetch. Register composable destruction immediately after construction; Node restores the test-context timer mocks when the test ends, including assertion failures.

The [official Node 24 test-runner documentation](https://nodejs.org/docs/latest-v24.x/api/test.html) documents timer API selection, synchronous clock advancement, implicit matching clear functions, and automatic restoration for test-context mocks. The [Node 24 timer documentation](https://nodejs.org/docs/latest-v24.x/api/timers.html) explains that actual timer callbacks are not guaranteed to run at the exact requested time and documents promise-based `setImmediate`. These URLs were discovered through web search and official documentation links, then opened for this review.

This approach removes fixed elapsed-time thresholds from the two terminal-poll assertions and retains actual composable scheduling and terminal-state checks. It does not measure real browser timing or network behavior. Production polling, intervals, and other test cases stay unchanged; the now-unused pipeline wait helper is removed.

Validation uses Node 24 and runs both affected test files together, followed by ESLint for those files. The complete repository validation remains a separate release check.

## Outcome

On Node v24.18.1, `node --test test/client/useMediaRequestDetail-swr.test.js test/client/useMediaRequestPipeline-swr.test.js` passed all 19 tests. Both terminal-poll tests reached exactly three fetches, observed the terminal published state, and retained that count after additional virtual advances of 30, 150, and 1,000 ms. `npx eslint test/client/useMediaRequestDetail-swr.test.js test/client/useMediaRequestPipeline-swr.test.js` and `git diff --check` passed. Existing Vue warnings about invoking lifecycle hooks outside component setup remain in these composable unit tests.
