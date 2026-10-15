/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPostgresIntegrationRuntime, withPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

function fixture({ schemaMode = 'empty', stage, primary, stop = async () => {} }) {
  const calls = []; const config = resolveIntegrationTestRuntimeConfig();
  const values = { getDatabase: 'controlled', getHost: '127.0.0.1', getPassword: 'controlled',
    getPort: 54321, getUsername: 'controlled', getId: 'a'.repeat(64) };
  const container = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, () => {
    calls.push(name); if (stage === name) throw primary;
    if (name === 'getPort' && stage === 'port_coercion') return { [Symbol.toPrimitive]() { throw primary; } };
    return value;
  }]));
  container.stop = options => { calls.push('stop'); assert.equal(options.timeout, config.containerStopTimeoutMs); return stop(); };
  return { calls, options: {
    config, env: {}, schemaMode, createPostgresContainer: () => ({ start: async () => {
      calls.push('start'); if (stage === 'start') throw primary; return container;
    } }),
    failureEvidenceFactory: () => {
      calls.push('evidence'); if (stage === 'evidence') throw primary;
      return { createCapture: () => async () => {} };
    },
    createPreparedPostgresTemplateFn: async () => {
      calls.push('prepare'); return { cleanup: async () => {}, runIsolatedDatabase: () => assert.fail('Setup failure published a template') };
    },
    withTemporaryPostgresDatabaseFn: () => assert.fail('Setup failure admitted a database'),
  } };
}

const stages = ['getDatabase', 'getHost', 'getPassword', 'getPort', 'getUsername', 'port_coercion', 'getId', 'evidence'];
for (const schemaMode of ['empty', 'migration_template']) {
  for (const stage of stages) {
    for (const primary of [new Error('controlled-setup'), null]) {
      test(`${schemaMode} ${stage} failure awaits one owned stop and preserves ${primary === null ? 'null' : 'Error'}`, async () => {
        const f = fixture({ schemaMode, stage, primary });
        await assert.rejects(createPostgresIntegrationRuntime(f.options), error => error === primary);
        assert.equal(f.calls[0], 'start'); assert.equal(f.calls.at(-1), 'stop');
        assert.equal(f.calls.filter(call => call === 'stop').length, 1); assert.equal(f.calls.includes('prepare'), false);
      });
    }
  }

  test(`${schemaMode} wrapper waits for held failed stop before returning the original metadata failure`, async () => {
    const primary = schemaMode === 'empty' ? new Error('controlled-metadata') : null;
    const entered = Promise.withResolvers(); const hold = Promise.withResolvers(); let settled = false;
    const f = fixture({ schemaMode, stage: 'getHost', primary, stop: async () => {
      entered.resolve(); await hold.promise; throw new Error('secondary-stop');
    } });
    const pending = withPostgresIntegrationRuntime({ ...f.options, run: () => assert.fail('Failed startup invoked scenario') });
    const observed = pending.then(() => { settled = true; }, () => { settled = true; });
    try {
      await waitForFixtureReady({ ready: entered.promise, operation: pending }); assert.equal(settled, false);
      hold.resolve(); await assert.rejects(pending, error => error === primary);
      assert.equal(f.calls.filter(call => call === 'stop').length, 1);
    } finally { hold.resolve(); await observed; }
  });
}

for (const primary of [new Error('controlled-evidence'), null]) {
  test(`synchronous stop observation cannot replace original setup ${primary === null ? 'null' : 'Error'}`, async () => {
    const f = fixture({ stage: 'evidence', primary, stop: () => { throw new Error('secondary-stop'); } });
    await assert.rejects(createPostgresIntegrationRuntime({ ...f.options,
      phaseObserver: { measure: (_phase, run) => run(), child: () => assert.fail('Failed evidence reached database preparation') },
    }), error => error === primary);
    assert.equal(f.calls.filter(call => call === 'stop').length, 1);
  });

  test(`failed start preserves ${primary === null ? 'null' : 'Error'} without stopping an unacknowledged container`, async () => {
    const f = fixture({ stage: 'start', primary });
    await assert.rejects(createPostgresIntegrationRuntime(f.options), error => error === primary);
    assert.deepEqual(f.calls, ['start']);
  });

  test(`borrowed evidence failure retains ${primary === null ? 'null' : 'Error'} without acquiring a server`, async () => {
    const f = fixture({ stage: 'evidence', primary });
    await assert.rejects(createPostgresIntegrationRuntime({ ...f.options, env: { PGPASSWORD: 'controlled' },
      createPostgresContainer: () => assert.fail('Borrowed startup acquired a container'),
    }), error => error === primary);
    assert.deepEqual(f.calls, ['evidence']);
  });
}
