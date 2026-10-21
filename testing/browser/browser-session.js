/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { chromium } from 'playwright';

/** Own setup as well as scenario work; never hide a failed browser retirement. */
export async function withBrowserSession({ browserType = chromium } = {}, run) {
  if (typeof browserType?.launch !== 'function' || typeof run !== 'function') {
    throw new TypeError('Browser session requires a browser type and callback');
  }
  let browser; let browserContext; let result; let failed = false; let failure;
  const remember = error => { if (!failed) { failed = true; failure = error; } };
  try {
    browser = await browserType.launch({ headless: true });
    browserContext = await browser.newContext({ serviceWorkers: 'block' });
    result = await run({ browser, browserContext });
  } catch (error) { remember(error); }
  for (const close of [
    () => browserContext?.unrouteAll({ behavior: 'ignoreErrors' }),
    () => browserContext?.close(),
    () => browser?.close(),
  ]) {
    try { await close(); } catch (error) { remember(error); }
  }
  if (failed) throw failure;
  return result;
}
