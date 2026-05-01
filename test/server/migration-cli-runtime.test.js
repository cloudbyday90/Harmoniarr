import assert from 'node:assert/strict';
import test from 'node:test';
import { runMigrationCli } from '../../src/server/migration-cli-runtime.js';

test('runMigrationCli reports successful migration task output and cleans up via the shared CLI shell', async () => {
  const stdoutWrites = [];
  const events = [];

  await runMigrationCli({
    prefix: 'harmoniarr-migrate',
    renderSuccessMessage: (applied) => `applied ${applied.length} migration(s)`,
    run: async () => {
      events.push('run');
      return ['20260501_010101_example.sql'];
    },
    stdout: {
      write(message) {
        stdoutWrites.push(message);
      },
    },
  });

  assert.deepEqual(events, ['run']);
  assert.deepEqual(stdoutWrites, [
    '[harmoniarr-migrate] applied 1 migration(s)\n',
  ]);
});

test('runMigrationCli reports task failures with the migration prefix and sets exitCode', async () => {
  const stderrWrites = [];
  const processEmitter = {};

  await runMigrationCli({
    prefix: 'harmoniarr-check-migrations',
    processEmitter,
    renderSuccessMessage: (status) => `${status.applied} applied, ${status.pending.length} pending`,
    run: async () => {
      throw new Error('Pending migrations detected: 20260501_010101_example.sql');
    },
    stderr: {
      write(message) {
        stderrWrites.push(message);
      },
    },
  });

  assert.equal(processEmitter.exitCode, 1);
  assert.deepEqual(stderrWrites, [
    '[harmoniarr-check-migrations] Pending migrations detected: 20260501_010101_example.sql\n',
  ]);
});

test('runMigrationCli validates required migration CLI dependencies', async () => {
  await assert.rejects(
    () => runMigrationCli({
      renderSuccessMessage: () => 'ok',
      run: async () => {},
    }),
    /prefix is required/,
  );

  await assert.rejects(
    () => runMigrationCli({
      prefix: 'harmoniarr-migrate',
      run: async () => {},
    }),
    /renderSuccessMessage is required/,
  );

  await assert.rejects(
    () => runMigrationCli({
      prefix: 'harmoniarr-migrate',
      renderSuccessMessage: () => 'ok',
    }),
    /run is required/,
  );
});