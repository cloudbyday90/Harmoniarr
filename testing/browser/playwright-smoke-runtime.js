/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createIntegrationAppRuntime } from '../integration/app-runtime.js';

const defaultClientDistDir = resolve(import.meta.dirname, '../../dist/client');

async function ensureBuiltClientDistDir(clientDistDir) {
  try {
    await access(resolve(clientDistDir, 'index.html'));
  } catch {
    throw new Error(`Built client assets not found at ${clientDistDir}. Run npm run build:client before browser smoke tests.`);
  }
}

export function isSkippableBrowserRuntimeError(error) {
  const message = String(error?.message ?? '');

  return message.includes('Could not find a working container runtime strategy')
    || message.includes('Built client assets not found')
    || message.includes('Executable doesn\'t exist')
    || message.includes('browserType.launch')
    || message.includes('Host system is missing dependencies');
}

export function toBrowserRuntimeUnavailableReason(error) {
  const message = String(error?.message ?? '');

  if (message.includes('Built client assets not found')) {
    return error.message;
  }

  if (message.includes('Executable doesn\'t exist') || message.includes('browserType.launch')) {
    return `${message}. Run npx playwright install chromium to provision the browser runtime.`;
  }

  if (message.includes('Host system is missing dependencies')) {
    return `${message}. Install the required Chromium host dependencies before running browser smoke tests.`;
  }

  return `${message}. Configure external PostgreSQL env vars or start a supported container runtime for integration tests.`;
}

export async function createBrowserSmokeRuntime({
  clientDistDir = defaultClientDistDir,
  config,
} = {}) {
  await ensureBuiltClientDistDir(clientDistDir);

  const integrationRuntime = await createIntegrationAppRuntime({
    clientDistDir,
    config,
  });

  return {
    async cleanup() {
      await integrationRuntime.cleanup();
    },
    async runScenario(run, {
      scenarioName = 'browser_smoke',
    } = {}) {
      return integrationRuntime.runScenario(async (context) => {
        const browser = await chromium.launch({
          headless: true,
        });
        const browserContext = await browser.newContext();
        const page = await browserContext.newPage();
        page.setDefaultTimeout(context.config?.httpRequestTimeoutMs ?? 10000);

        try {
          return await run({
            ...context,
            browser,
            browserContext,
            page,
          });
        } finally {
          await browserContext.close().catch(() => {});
          await browser.close().catch(() => {});
        }
      }, {
        scenarioName,
      });
    },
  };
}