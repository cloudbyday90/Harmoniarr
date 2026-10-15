/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPostgresIntegrationRuntime, withPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';

function options({ schemaMode = 'empty', stop, cleanup = async () => {} }) {
  return {
    env: {}, schemaMode,
    createPostgresContainer: () => ({ start: async () => ({
      getDatabase: () => 'controlled', getHost: () => '127.0.0.1', getPort: () => 54321,
      getUsername: () => 'controlled', getPassword: () => 'controlled', stop,
    }) }),
    createPreparedPostgresTemplateFn: async () => ({ cleanup, runIsolatedDatabase: run => run({}) }),
    withTemporaryPostgresDatabaseFn: ({ run }) => run({}),
  };
}

for (const schemaMode of ['empty', 'migration_template']) {
  for (const failure of [new Error('controlled-stop'), null]) {
    test(`${schemaMode} cleanup awaits one stop and preserves its ${failure === null ? 'null' : 'Error'} rejection`, async () => {
      const entered = Promise.withResolvers(); const hold = Promise.withResolvers();
      const order = []; let calls = 0; let settled = false;
      const runtime = await createPostgresIntegrationRuntime(options({ schemaMode,
        cleanup: async () => { order.push('template'); },
        stop: async stopOptions => {
          calls += 1; order.push('server'); assert.equal(stopOptions.timeout, runtime.config.containerStopTimeoutMs);
          entered.resolve(); await hold.promise; throw failure;
        },
      }));
      const closing = runtime.cleanup();
      const observed = closing.then(() => { settled = true; }, () => { settled = true; });
      try {
        await entered.promise;
        assert.equal(runtime.cleanup(), closing); assert.equal(settled, false);
        assert.deepEqual(order, schemaMode === 'empty' ? ['server'] : ['template', 'server']);
        hold.resolve(); await assert.rejects(closing, error => error === failure);
        assert.equal(runtime.cleanup(), closing);
        await assert.rejects(runtime.cleanup(), error => error === failure);
        assert.equal(calls, 1);
      } finally { hold.resolve(); await observed; }
    });
  }

  test(`${schemaMode} wrapper rejects a stop failure after a successful scenario`, async () => {
    const failure = new Error('controlled-stop'); let ran = false;
    await assert.rejects(withPostgresIntegrationRuntime({ ...options({ schemaMode, stop: async () => { throw failure; } }),
      run: async () => { ran = true; return 'complete'; },
    }), error => error === failure);
    assert.equal(ran, true);
  });

  for (const primary of [new Error('controlled-scenario'), null]) {
    test(`${schemaMode} wrapper retains scenario ${primary === null ? 'null' : 'Error'} through held failed stop`, async () => {
      const entered = Promise.withResolvers(); const hold = Promise.withResolvers(); let settled = false;
      const pending = withPostgresIntegrationRuntime({ ...options({ schemaMode,
        stop: async () => { entered.resolve(); await hold.promise; throw new Error('secondary-stop'); },
      }), run: async () => { throw primary; } });
      const observed = pending.then(() => { settled = true; }, () => { settled = true; });
      try {
        await entered.promise; assert.equal(settled, false);
        hold.resolve(); await assert.rejects(pending, error => error === primary);
      } finally { hold.resolve(); await observed; }
    });
  }
}

for (const primary of [new Error('controlled-template'), null]) {
  test(`template cleanup ${primary === null ? 'null' : 'Error'} survives a later held server failure`, async () => {
    const entered = Promise.withResolvers(); const hold = Promise.withResolvers(); let settled = false;
    const runtime = await createPostgresIntegrationRuntime(options({ schemaMode: 'migration_template',
      cleanup: async () => { throw primary; },
      stop: async () => { entered.resolve(); await hold.promise; throw new Error('secondary-stop'); },
    }));
    const closing = runtime.cleanup();
    const observed = closing.then(() => { settled = true; }, () => { settled = true; });
    try {
      await entered.promise; assert.equal(settled, false);
      hold.resolve(); await assert.rejects(closing, error => error === primary);
    } finally { hold.resolve(); await observed; }
  });

  test(`failed template startup awaits server stop and preserves original ${primary === null ? 'null' : 'Error'}`, async () => {
    const entered = Promise.withResolvers(); const hold = Promise.withResolvers(); let settled = false; let calls = 0;
    const pending = createPostgresIntegrationRuntime({ ...options({ schemaMode: 'migration_template',
      stop: async () => { calls += 1; entered.resolve(); await hold.promise; throw new Error('secondary-stop'); },
    }), createPreparedPostgresTemplateFn: async () => { throw primary; } });
    const observed = pending.then(() => { settled = true; }, () => { settled = true; });
    try {
      await entered.promise; assert.equal(settled, false);
      hold.resolve(); await assert.rejects(pending, error => error === primary); assert.equal(calls, 1);
    } finally { hold.resolve(); await observed; }
  });
}

test('external PostgreSQL cleanup releases only its template and never starts or stops a server', async () => {
  let releases = 0;
  const runtime = await createPostgresIntegrationRuntime({ env: { PGPASSWORD: 'controlled' }, schemaMode: 'migration_template',
    createPostgresContainer: () => assert.fail('Borrowed server was acquired'),
    createPreparedPostgresTemplateFn: async () => ({ cleanup: async () => { releases += 1; } }),
  });
  const closing = runtime.cleanup(); assert.equal(runtime.cleanup(), closing);
  await closing; await runtime.cleanup(); assert.equal(releases, 1);
});
