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

function fixture({ schemaMode = 'empty', borrowed = false, start = async () => {}, prepare = async () => {},
  closeTemplate = async () => {}, stop = async () => {}, evidence = () => {} } = {}) {
  const calls = []; const config = resolveIntegrationTestRuntimeConfig(); const controller = new AbortController();
  const container = Object.fromEntries(Object.entries({ getDatabase: 'controlled', getHost: '127.0.0.1',
    getPassword: 'controlled', getPort: 54321, getUsername: 'controlled', getId: 'a'.repeat(64) })
    .map(([name, value]) => [name, () => { calls.push(name); return value; }]));
  container.stop = options => { calls.push('stop'); assert.equal(options.timeout, config.containerStopTimeoutMs); return stop(); };
  return { calls, controller, options: { config, schemaMode, env: borrowed ? { PGPASSWORD: 'controlled' } : {}, signal: controller.signal,
    createPostgresContainer: () => ({ start: async () => {
      assert.equal(borrowed, false); calls.push('start'); await start(); return container;
    } }),
    failureEvidenceFactory: () => { calls.push('evidence'); evidence(controller); return { createCapture: () => async () => {} }; },
    createPreparedPostgresTemplateFn: async ({ signal }) => {
      assert.equal(signal, controller.signal); calls.push('prepare'); await prepare();
      return { cleanup: () => { calls.push('template_close'); return closeTemplate(); }, runIsolatedDatabase: run => run({}) };
    },
    withTemporaryPostgresDatabaseFn: ({ run }) => run({}),
  } };
}

for (const reason of [new Error('controlled-abort'), null]) {
  const label = reason === null ? 'null' : 'Error';
  for (const schemaMode of ['empty', 'migration_template']) {
    for (const borrowed of [false, true]) {
      test(`${schemaMode} ${borrowed ? 'borrowed' : 'owned'} pre-abort preserves ${label} without acquisition`, async () => {
        const f = fixture({ schemaMode, borrowed }); f.controller.abort(reason);
        await assert.rejects(createPostgresIntegrationRuntime(f.options), error => error === reason);
        assert.deepEqual(f.calls, []);
      });
    }

    test(`${schemaMode} in-flight start cancellation drains acknowledgement and held stop before ${label}`, async () => {
      const entered = Promise.withResolvers(); const startHold = Promise.withResolvers();
      const stopping = Promise.withResolvers(); const stopHold = Promise.withResolvers();
      const f = fixture({ schemaMode, start: async () => { entered.resolve(); await startHold.promise; },
        stop: async () => { stopping.resolve(); await stopHold.promise; throw new Error('secondary-stop'); } });
      let settled = false;
      const pending = withPostgresIntegrationRuntime({ ...f.options, run: () => assert.fail('Cancelled startup invoked scenario') });
      const observed = pending.then(() => { settled = true; }, () => { settled = true; });
      try {
        await waitForFixtureReady({ ready: entered.promise, operation: pending }); f.controller.abort(reason);
        await Promise.resolve(); assert.equal(settled, false); assert.deepEqual(f.calls, ['start']);
        startHold.resolve(); await waitForFixtureReady({ ready: stopping.promise, operation: pending });
        assert.equal(settled, false); assert.deepEqual(f.calls, ['start', 'stop']);
        stopHold.resolve(); await assert.rejects(pending, error => error === reason);
        assert.deepEqual(f.calls, ['start', 'stop']);
      } finally { startHold.resolve(); stopHold.resolve(); await observed; }
    });
  }

  for (const borrowed of [false, true]) {
    test(`returned ${borrowed ? 'borrowed' : 'owned'} template cancellation awaits canonical release before ${label}`, async () => {
      const entered = Promise.withResolvers(); const prepareHold = Promise.withResolvers();
      const closing = Promise.withResolvers(); const closeHold = Promise.withResolvers();
      const f = fixture({ borrowed, schemaMode: 'migration_template', prepare: async () => { entered.resolve(); await prepareHold.promise; },
        closeTemplate: async () => { closing.resolve(); await closeHold.promise; throw new Error('secondary-template-close'); },
        stop: () => { throw new Error('secondary-synchronous-stop'); } });
      let runtime; let settled = false;
      const pending = createPostgresIntegrationRuntime(f.options);
      const observed = pending.then(value => { runtime = value; settled = true; }, () => { settled = true; });
      try {
        await waitForFixtureReady({ ready: entered.promise, operation: pending }); f.controller.abort(reason);
        await Promise.resolve(); assert.equal(settled, false); assert.equal(f.calls.includes('stop'), false);
        prepareHold.resolve(); await waitForFixtureReady({ ready: closing.promise, operation: pending });
        assert.equal(settled, false); assert.equal(f.calls.includes('stop'), false);
        closeHold.resolve(); await assert.rejects(pending, error => error === reason);
        assert.equal(f.calls.filter(call => call === 'template_close').length, 1);
        assert.equal(f.calls.filter(call => call === 'stop').length, borrowed ? 0 : 1);
      } finally { prepareHold.resolve(); closeHold.resolve(); await observed; await runtime?.cleanup().catch(() => {}); }
    });

    test(`empty ${borrowed ? 'borrowed' : 'owned'} runtime publication catches evidence-time ${label} cancellation`, async () => {
      const f = fixture({ borrowed, evidence: controller => controller.abort(reason) }); let runtime;
      try {
        const pending = createPostgresIntegrationRuntime(f.options); pending.then(value => { runtime = value; }, () => {});
        await assert.rejects(pending, error => error === reason);
        assert.equal(f.calls.filter(call => call === 'stop').length, borrowed ? 0 : 1);
        assert.equal(f.calls.includes('prepare'), false);
      } finally { await runtime?.cleanup(); }
    });
  }
}

for (const primary of [new Error('controlled-setup'), null]) {
  for (const stage of ['start', 'owned_prepare', 'borrowed_prepare']) {
    test(`${stage} actual ${primary === null ? 'null' : 'Error'} failure survives simultaneous abort and stop fallout`, async () => {
      const entered = Promise.withResolvers(); const hold = Promise.withResolvers();
      const fail = async () => { entered.resolve(); await hold.promise; throw primary; };
      const f = fixture({ borrowed: stage === 'borrowed_prepare', schemaMode: 'migration_template',
        ...(stage === 'start' ? { start: fail } : { prepare: fail }), stop: () => { throw new Error('secondary-stop'); } });
      const pending = createPostgresIntegrationRuntime(f.options); const observed = pending.catch(() => {});
      try {
        await waitForFixtureReady({ ready: entered.promise, operation: pending });
        f.controller.abort(primary === null ? new Error('secondary-abort') : null); hold.resolve();
        await assert.rejects(pending, error => error === primary);
        assert.equal(f.calls.filter(call => call === 'stop').length, stage === 'owned_prepare' ? 1 : 0);
        assert.equal(f.calls.includes('template_close'), false);
      } finally { hold.resolve(); await observed; }
    });
  }
}

for (const schemaMode of ['empty', 'migration_template']) {
  for (const borrowed of [false, true]) {
    test(`${schemaMode} published ${borrowed ? 'borrowed' : 'owned'} runtime keeps explicit cleanup after late abort`, async () => {
      const f = fixture({ schemaMode, borrowed }); const runtime = await createPostgresIntegrationRuntime(f.options);
      try {
        f.controller.abort(null);
        assert.equal(f.calls.includes('stop'), false); assert.equal(f.calls.includes('template_close'), false);
        assert.equal(await runtime.runIsolatedDatabase(() => 42), 42);
      } finally { await runtime.cleanup(); }
      assert.equal(f.calls.filter(call => call === 'stop').length, borrowed ? 0 : 1);
      assert.equal(f.calls.filter(call => call === 'template_close').length, schemaMode === 'empty' ? 0 : 1);
    });
  }
}
