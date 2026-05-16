---
description: Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.
metadata:
    github-path: skills/webapp-testing
    github-ref: refs/heads/main
    github-repo: https://github.com/github/awesome-copilot
    github-tree-sha: 2a897b3b3dd467a76ef44e985e2c87c35299ce9f
name: webapp-testing
---
# Web Application Testing

This skill enables comprehensive testing and debugging of local web applications using Playwright automation.

You should use the Playwright MCP Server to undertake the work if possible. If the MCP Server is unavailable, you can run the code in a local Node.js environment with Playwright installed.

## Harmoniarr Project Context

### Test Framework

Harmoniarr uses the **Node.js built-in test runner** (`node:test`), not Jest or Vitest. Tests use `describe()`, `it()`, and `assert` from `node:test` / `node:assert`.

### Test Commands

```bash
npm test                    # Lint + test hygiene + all node tests
npm run test:server         # Server unit tests (test/server/)
npm run test:client         # Client unit tests (test/client/)
npm run test:integration    # Integration tests (test/integration/)
npm run test:scripts        # Script tests (test/scripts/)
npm run test:browser        # Browser/Playwright tests (test/browser/)
npm run test:node           # server + client + scripts + integration
npm run lint                # Lint all (server, client, shared, test, scripts)
npm run validate            # Full validation (copyright + migrations + lint + build)
```

### Test File Locations

```
test/
  server/       Server unit tests
  client/       Client unit tests
  integration/  Integration tests (DB, API)
  browser/      Playwright browser tests
  scripts/      Script/utility tests
```

### Running the App Locally

The app runs in Docker. For local development testing:

```bash
npm run build          # Build client + server
npm run start          # Start production server on port 3000
```

For Docker-based testing, use `compose.yaml` or `compose.walkthrough.yaml`.

### Key Testing Notes

- Browser tests require `npx playwright install chromium` before first run
- Browser tests run with `--test-concurrency=1` (sequential)
- The app uses Express 5, Vue 3, and PostgreSQL
- Auth is cookie-based with CSRF protection (configurable via `HARMONIARR_CSRF_PROTECTION`)
- Playwright is a devDependency (version 1.59.x)
- Client and server code are ESM-first; keep explicit `.js` import specifiers in test fixtures and support code
- When testing media-request or import-review flows, prefer existing shared helpers such as `src/client/lib/media-request-api.js`, `src/client/composables/useImportCandidateRunSummary.js`, and `src/client/composables/useOperationHistory.js`

## When to Use This Skill

Use this skill when you need to:

- Test frontend functionality in a real browser
- Verify UI behavior and interactions
- Debug web application issues
- Capture screenshots for documentation or debugging
- Inspect browser console logs
- Validate form submissions and user flows
- Check responsive design across viewports

## Prerequisites

- Node.js installed on the system
- A locally running web application (or accessible URL)
- Playwright will be installed automatically if not present

## Core Capabilities

### 1. Browser Automation

- Navigate to URLs
- Click buttons and links
- Fill form fields
- Select dropdowns
- Handle dialogs and alerts

### 2. Verification

- Assert element presence
- Verify text content
- Check element visibility
- Validate URLs
- Test responsive behavior

### 3. Debugging

- Capture screenshots
- View console logs
- Inspect network requests
- Debug failed tests

## Usage Examples

### Example 1: Basic Navigation Test

```javascript
// Navigate to a page and verify title
await page.goto("http://localhost:3000");
const title = await page.title();
console.log("Page title:", title);
```

### Example 2: Form Interaction

```javascript
// Fill out and submit a form
await page.fill("#username", "testuser");
await page.fill("#password", "password123");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard");
```

### Example 3: Screenshot Capture

```javascript
// Capture a screenshot for debugging
await page.screenshot({ path: "debug.png", fullPage: true });
```

## Guidelines

1. **Always verify the app is running** - Check that the local server is accessible before running tests
2. **Use explicit waits** - Wait for elements or navigation to complete before interacting
3. **Capture screenshots on failure** - Take screenshots to help debug issues
4. **Clean up resources** - Always close the browser when done
5. **Handle timeouts gracefully** - Set reasonable timeouts for slow operations
6. **Test incrementally** - Start with simple interactions before complex flows
7. **Use selectors wisely** - Prefer data-testid or role-based selectors over CSS classes
8. **Prefer web-first Playwright APIs** - Use locators and retrying assertions instead of manual polling or brittle timeout chains

## Common Patterns

### Pattern: Wait for Element

```javascript
await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
```

### Pattern: Check if Element Exists

```javascript
const exists = await page.getByRole('button', { name: 'Submit' }).isVisible();
```

### Pattern: Get Console Logs

```javascript
page.on("console", (msg) => console.log("Browser log:", msg.text()));
```

### Pattern: Handle Errors

```javascript
try {
  await page.getByRole('button', { name: 'Submit' }).click();
} catch (error) {
  await page.screenshot({ path: "error.png" });
  throw error;
}
```

## Limitations

- Requires Node.js environment
- Cannot test native mobile apps (use React Native Testing Library instead)
- May have issues with complex authentication flows
- Some modern frameworks may require specific configuration

## Helper Functions

Some helper functions are available in [`test-helper.js`](./assets/test-helper.js) to simplify common tasks like waiting for elements, capturing screenshots, and handling errors. You can import and use these functions in your tests to improve readability and maintainability.
