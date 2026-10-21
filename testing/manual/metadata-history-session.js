/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import express from 'express';
import { createMetadataCommandFixture, metadataCommandIds } from '../browser/metadata-command-fixture.js';
import { historyPage } from '../browser/metadata-history-data.js';
import { browserOnboardingFixture } from '../browser/onboarding-browser-fixture.js';
import { browserSystemOverviewFixture } from '../browser/system-overview-browser-fixture.js';
import { createIntegrationAppRuntime } from '../integration/app-runtime.js';
import { createManualPostgresRuntime } from './manual-postgres-runtime.js';
import { createManualHistoryController } from './metadata-history-controller.js';
import { createManualHistoryHttpGuard } from './metadata-history-http-guard.js';

/** A real app/session in a fresh database; callers own their browser and evidence. */
export async function withManualHistorySession(run) {
  if (typeof run !== 'function') throw new TypeError('Manual history session requires work.');
  const clientDistDir = resolve(import.meta.dirname, '../../dist/client');
  await access(resolve(clientDistDir, 'index.html'));
  const controller = createManualHistoryController();
  const fixture = createMetadataCommandFixture({ history: { ...historyPage(10, true, 'Initial'), pageInfo: { hasMore: true, nextCursor: 'initial-cursor' }, readPage: controller.readPage } });
  const guard = createManualHistoryHttpGuard({ artistId: metadataCommandIds.artist, onboarding: browserOnboardingFixture, overview: browserSystemOverviewFixture });
  let runtime; let result; let failed = false; let failure;
  const remember = error => { if (!failed) { failed = true; failure = error; } };
  try {
    runtime = await createIntegrationAppRuntime({ clientDistDir,
      // Never borrow a configured database or reuse a running test container.
      postgresRuntimeFactory: createManualPostgresRuntime,
      createAppFn(options) {
        const application = fixture.createAppFn(options);
        const app = express(); app.use(guard.middleware); app.use(application.app);
        return { ...application, app };
      },
    });
    result = await runtime.runScenario(async context => {
      assert.equal(context.postgresSource, 'testcontainer_postgres');
      guard.bind(context.baseUrl);
      let value;
      try {
        value = await run({ ...context, controller, artistUrl: `${context.baseUrl}/app/settings/library-browser?artistId=${metadataCommandIds.artist}` });
      } catch (error) { remember(error); }
      // Settle held reads before HTTP shutdown; preserve the body's Error/null.
      try { await controller.close(); } catch (error) { remember(error); }
      try { assert.deepEqual(fixture.calls, [], 'manual history must not dispatch metadata commands'); } catch (error) { remember(error); }
      if (failed) throw failure;
      return value;
    }, { scenarioName: 'manual_metadata_history' });
  } catch (error) { remember(error); }
  try { await controller.close(); } catch (error) { remember(error); }
  try { await runtime?.cleanup(); } catch (error) { remember(error); }
  if (failed) throw failure;
  return result;
}
