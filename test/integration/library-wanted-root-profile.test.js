/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { exerciseWantedRootProfile } from '../../testing/integration/wanted-root-profile-scenario.js';
import { withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; const activeScenarios = new Set();
async function scenario(context) {
  await Promise.allSettled([...activeScenarios]); context.signal.throwIfAborted();
  const operation = withIntegrationApp({ config,
    withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver }),
    run: ({ workspaceDir }) => withFixtureLifecycle({ signal: context.signal }, scope =>
      exerciseWantedRootProfile({ workspaceDir, signal: scope.signal })),
  });
  activeScenarios.add(operation);
  operation.then(() => activeScenarios.delete(operation), () => activeScenarios.delete(operation)); return operation;
}
suite('Wanted projection root-context correctness and current authority', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...activeScenarios]); await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('paired readers retain equal projections, hash work and current-root publication refusal', { timeout: config.scenarioTimeoutMs }, scenario);
});
