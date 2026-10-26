/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { backupContainerCreateArgs, assertBackupContainerRuntime } from './backup-container-lifecycle.js';
import { assertBackupPgCrashMounts } from './backup-pg-crash-container.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

/** Own fresh labelled volumes only; exercise actual preparation before production CMD. */
export async function runMigrationPreparationContainerQualification({ image, evidenceDir, onProgress = () => {} }) {
  assert.match(image, /^sha256:[a-f0-9]{64}$/u);
  const root = resolve(evidenceDir); await mkdir(root, { recursive: true });
  const execute = promisify(execFile);
  const docker = async args => (await execute('docker', args, { windowsHide: true, timeout: 90_000, maxBuffer: 2 * 1024 ** 2 })).stdout;
  const inspect = async id => JSON.parse(await docker(['inspect', id]))[0];
  const results = [];
  for (const scenario of ['checksum', 'key', 'unknown', 'failed', 'missing', 'pending', 'retry']) {
    const profileId = randomUUID(), volumeName = 'harmoniarr-preparation-' + profileId;
    const directory = resolve(root, scenario); await mkdir(directory);
    const ids = new Set(); let volumeCreated = false;
    const ownedVolume = async () => {
      const volume = JSON.parse(await docker(['volume', 'inspect', volumeName]))[0];
      assert.equal(volume.Name, volumeName); assert.equal(volume.Driver, 'local');
      assert.equal(volume.Labels['harmoniarr.backup-pg-crash'], profileId);
    };
    await writeFile(resolve(directory, 'ownership.json'), JSON.stringify({ profileId, volumeName, image }), { flag: 'wx' });
    await withWorkerTaskCleanup(async () => {
      assert.equal((await docker(['volume', 'ls', '--filter', 'name=' + volumeName, '--format', '{{.Name}}'])).trim(), '');
      await docker(['volume', 'create', '--label', 'harmoniarr.backup-pg-crash=' + profileId, volumeName]); volumeCreated = true;
      await ownedVolume();
      const args = backupContainerCreateArgs({ image, volumeName, profileId, evidenceDir: directory });
      const seed = (await docker([...args, 'node', '/app/testing/server/migration-preparation-container-fixture.js', scenario])).trim(); ids.add(seed);
      assertBackupPgCrashMounts(await inspect(seed), volumeName, profileId, image);
      const seeded = await docker(['start', '--attach', seed]);
      await writeFile(resolve(directory, 'seed.log'), seeded, { flag: 'wx' });
      assert.equal((await inspect(seed)).State.ExitCode, 0);
      const prefix = 'MIGRATION_PREPARATION_FIXTURE ';
      const receipt = JSON.parse(seeded.split(/\r?\n/u).find(line => line.startsWith(prefix)).slice(prefix.length));
      assert.equal(receipt.scenario, scenario); assert.match(receipt.ledgerSha256, /^[a-f0-9]{64}$/u);
      const retryArgs = ['node', '/app/server-dist/migrate.js', '--retry-failed'];
      const runtime = (await docker(scenario === 'retry' ? [...args, ...retryArgs] : args)).trim(); ids.add(runtime);
      if (scenario === 'retry') {
        const retryRuntime = await inspect(runtime);
        assertBackupPgCrashMounts(retryRuntime, volumeName, profileId, image);
        assert.deepEqual(retryRuntime.Config.Cmd, retryArgs);
        assert.deepEqual(retryRuntime.Config.Entrypoint, ['/usr/local/bin/harmoniarr-entrypoint']);
      } else assertBackupContainerRuntime(await inspect(runtime), volumeName, profileId, image);
      await docker(['start', runtime]);
      const deadline = Date.now() + 45_000; let state;
      for (;;) {
        state = await inspect(runtime);
        if (scenario === 'pending' ? state.State.Health?.Status === 'healthy' : !state.State.Running) break;
        assert.ok(state.State.Running || scenario !== 'pending', 'pending upgrade must start');
        assert.ok(Date.now() < deadline, 'entrypoint outcome must settle');
        await new Promise(finish => { setTimeout(finish, 250); });
      }
      const log = await execute('docker', ['logs', runtime], { windowsHide: true, maxBuffer: 2 * 1024 ** 2 });
      const output = log.stdout + log.stderr;
      await writeFile(resolve(directory, 'entrypoint.log'), output, { flag: 'wx' });
      if (scenario === 'pending') {
        assert.match(output, /applied 1 migration\(s\); verified 115 applied, 0 pending/u);
        const response = await docker(['exec', runtime, 'node', '--input-type=module', '-e', "const r=await fetch('http://127.0.0.1:3000/healthz');if(r.status!==200)process.exitCode=1;"]);
        assert.equal(response, '');
      } else if (scenario === 'retry') {
        assert.equal(state.State.ExitCode, 0);
        assert.match(output, /explicit failed-migration retry owns guarded preparation/u);
        assert.match(output, /applied 1 migration\(s\)/u);
        assert.doesNotMatch(output, /preparing database state|applied 0 migration/u);
        const normal = (await docker(args)).trim(); ids.add(normal);
        assertBackupContainerRuntime(await inspect(normal), volumeName, profileId, image);
        await docker(['start', normal]);
        const readyBy = Date.now() + 45_000;
        for (;;) {
          const observed = await inspect(normal);
          assert.equal(observed.State.Running, true);
          if (observed.State.Health?.Status === 'healthy') break;
          assert.ok(Date.now() < readyBy, 'reviewed retry must support normal startup');
          await new Promise(finish => { setTimeout(finish, 250); });
        }
      } else {
        assert.equal(state.State.ExitCode, 1); assert.equal(state.State.OOMKilled, false);
        assert.match(output, /Migration preparation refused:/u);
        assert.doesNotMatch(output, /Fixture refuses|starting application command|listening on|private-preparation|private_unknown|20990101_000001/u);
      }
      results.push({ scenario, sameOwnedVolume: true, productionEntrypoint: true,
        outcome: scenario === 'pending' ? 'upgraded-healthy' : scenario === 'retry' ? 'explicit-retry-then-healthy' : 'refused-before-ddl-and-app' });
      onProgress(results.at(-1));
    }, async () => {
      const retired = await Promise.allSettled([...ids].map(async id => {
        assertBackupPgCrashMounts(await inspect(id), volumeName, profileId, image);
        await withWorkerTaskCleanup(async () => {
          const logs = await execute('docker', ['logs', id], { windowsHide: true, maxBuffer: 2 * 1024 ** 2 });
          await writeFile(resolve(directory, id + '.log'), logs.stdout + logs.stderr, { flag: 'wx' });
        }, async () => {
          await docker(['rm', '--force', '--volumes', id]);
          assert.equal((await docker(['ps', '-aq', '--no-trunc', '--filter', 'id=' + id])).trim(), '');
        });
      }));
      for (const row of retired) if (row.status === 'rejected') throw row.reason;
      if (volumeCreated) {
        await ownedVolume(); await docker(['volume', 'rm', volumeName]);
        assert.equal((await docker(['volume', 'ls', '--filter', 'name=' + volumeName, '--format', '{{.Name}}'])).trim(), '');
      }
      await writeFile(resolve(directory, 'retirement.json'), JSON.stringify({ containersRemoved: true, volumeRemoved: volumeCreated, absenceVerified: true }), { flag: 'wx' });
    });
  }
  const result = { image, results, containers: 15, volumes: 7, retired: true };
  await writeFile(resolve(root, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
  return result;
}
