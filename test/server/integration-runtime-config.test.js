import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

suite('integration runtime config', () => {
  test('resolves safe integration defaults', () => {
    assert.deepEqual(resolveIntegrationTestRuntimeConfig({}), {
      browserActionTimeoutMs: 30000,
      containerStopTimeoutMs: 10000,
      httpRequestTimeoutMs: 15000,
      keepArtifactsOnFailure: false,
      poolAllowExitOnIdle: true,
      poolConnectionTimeoutMs: 10000,
      poolIdleTimeoutMs: 1000,
      poolMax: 2,
      poolMaxUses: 25,
      postgresImage: 'postgres:18-alpine',
      scenarioTimeoutMs: 90000,
      startupTimeoutMs: 120000,
      suiteSetupTimeoutMs: 150000,
      suiteTeardownTimeoutMs: 30000,
      useContainerReuse: false,
    });
  });

  test('accepts explicit overrides', () => {
    const config = resolveIntegrationTestRuntimeConfig({
      HARMONIARR_INTEGRATION_BROWSER_ACTION_TIMEOUT_MS: '28000',
      HARMONIARR_INTEGRATION_CONTAINER_STOP_TIMEOUT_MS: '12000',
      HARMONIARR_INTEGRATION_HTTP_REQUEST_TIMEOUT_MS: '14000',
      HARMONIARR_INTEGRATION_KEEP_ARTIFACTS_ON_FAILURE: 'true',
      HARMONIARR_INTEGRATION_PG_POOL_ALLOW_EXIT_ON_IDLE: 'false',
      HARMONIARR_INTEGRATION_PG_POOL_CONNECTION_TIMEOUT_MS: '7000',
      HARMONIARR_INTEGRATION_PG_POOL_IDLE_TIMEOUT_MS: '500',
      HARMONIARR_INTEGRATION_PG_POOL_MAX: '4',
      HARMONIARR_INTEGRATION_PG_POOL_MAX_USES: '10',
      HARMONIARR_INTEGRATION_POSTGRES_IMAGE: 'postgres:18',
      HARMONIARR_INTEGRATION_SCENARIO_TIMEOUT_MS: '100000',
      HARMONIARR_INTEGRATION_STARTUP_TIMEOUT_MS: '130000',
      HARMONIARR_INTEGRATION_SUITE_SETUP_TIMEOUT_MS: '160000',
      HARMONIARR_INTEGRATION_SUITE_TEARDOWN_TIMEOUT_MS: '35000',
      HARMONIARR_INTEGRATION_USE_CONTAINER_REUSE: 'true',
    });

    assert.equal(config.browserActionTimeoutMs, 28000);
    assert.equal(config.containerStopTimeoutMs, 12000);
    assert.equal(config.httpRequestTimeoutMs, 14000);
    assert.equal(config.keepArtifactsOnFailure, true);
    assert.equal(config.poolAllowExitOnIdle, false);
    assert.equal(config.poolConnectionTimeoutMs, 7000);
    assert.equal(config.poolIdleTimeoutMs, 500);
    assert.equal(config.poolMax, 4);
    assert.equal(config.poolMaxUses, 10);
    assert.equal(config.postgresImage, 'postgres:18');
    assert.equal(config.scenarioTimeoutMs, 100000);
    assert.equal(config.startupTimeoutMs, 130000);
    assert.equal(config.suiteSetupTimeoutMs, 160000);
    assert.equal(config.suiteTeardownTimeoutMs, 35000);
    assert.equal(config.useContainerReuse, true);
  });

  test('rejects malformed boolean and timeout values', () => {
    assert.throws(
      () => resolveIntegrationTestRuntimeConfig({
        HARMONIARR_INTEGRATION_KEEP_ARTIFACTS_ON_FAILURE: 'sometimes',
      }),
      /HARMONIARR_INTEGRATION_KEEP_ARTIFACTS_ON_FAILURE must be "true" or "false"/,
    );

    assert.throws(
      () => resolveIntegrationTestRuntimeConfig({
        HARMONIARR_INTEGRATION_BROWSER_ACTION_TIMEOUT_MS: '0',
      }),
      /HARMONIARR_INTEGRATION_BROWSER_ACTION_TIMEOUT_MS must be greater than 0/,
    );

    assert.throws(
      () => resolveIntegrationTestRuntimeConfig({
        HARMONIARR_INTEGRATION_SCENARIO_TIMEOUT_MS: '0',
      }),
      /HARMONIARR_INTEGRATION_SCENARIO_TIMEOUT_MS must be greater than 0/,
    );
  });
});
