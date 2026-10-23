import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { closePool, getPool } from '../../src/server/database.js';
import { artworkWorkerCgroup } from '../../testing/server/artwork-worker-cgroup.js';
import { runDeploymentMemoryWorkload } from '../../testing/server/deployment-memory-workload.js';

// Refuse live databases and undeclared profiles before acquiring a pool.
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.equal(process.env.PGDATABASE, 'harmoniarr_memory_qualification');
assert.equal(process.env.PGDATA, '/app/data/postgres/18/data');
assert.ok(!process.env.HARMONIARR_APPDATA || process.env.HARMONIARR_APPDATA === '/app/data');
const dataMount = (await readFile('/proc/self/mountinfo', 'utf8')).split('\n').find(line => line.split(' ')[4] === '/app/data');
assert.equal(dataMount?.split(' - ')[1]?.split(' ')[0], 'tmpfs', 'Require disposable app/database storage without a host data mount');
const gib = Number(process.env.HARMONIARR_MEMORY_PROFILE_GIB ?? 3);
assert.ok([2, 3].includes(gib));
const profile = await artworkWorkerCgroup({ memoryBytes: gib * 1024 ** 3, cpus: 2, pids: 256 });

// Public test-only material, shared with the existing app fixture. Never use
// account credentials or a live notification endpoint in this offline lane.
process.env.VAPID_CONTACT = 'mailto:memory-qualification@example.invalid';
process.env.VAPID_PUBLIC_KEY = 'BN9CEVhAa-agHfE816dgSQUoOhYCng4hD86REpzvPg3wzlT8fr9LmvK60sb70uhX-vk0UFixyFak3dhk6SPyKRA';
process.env.VAPID_PRIVATE_KEY = 'tt5cAktvbcZtFB5tTbQr7eOaNWFH_-OvsAWx-yE9E00';

for (const [name, dimension, callerBytes] of [['ordinary', 1024, 64 * 1024 ** 2], ['maximum-pixels', 8192, 256 * 1024 ** 2], ['maximum-bytes', 16, 256 * 1024 ** 2]]) {
  test(`shared-container memory: ${name} artwork, retained parent buffers and PostgreSQL`, async t => {
    t.after(closePool);
    const pool = getPool();
    const backend = (await pool.query("SELECT pg_backend_pid() AS pid, current_setting('server_version_num')::int AS version, pg_size_bytes(current_setting('shared_buffers'))::text AS shared_buffers_bytes, pg_size_bytes(current_setting('work_mem'))::text AS work_mem_bytes, current_setting('hash_mem_multiplier')::float AS hash_multiplier, current_setting('max_connections')::int AS max_connections")).rows[0];
    assert.ok(backend.version >= 180000 && backend.version < 190000);
    assert.equal(await readFile(`/proc/${backend.pid}/cgroup`, 'utf8'), await readFile('/proc/self/cgroup', 'utf8'));
    const before = await profile.snapshot();
    const measurement = await runDeploymentMemoryWorkload({ pool, dimension, callerBytes, maximumBytes: name === 'maximum-bytes' });
    const after = await profile.snapshot(); assert.equal(after.oomKills, before.oomKills);
    assert.equal(measurement.checkpoints.settled.kernel.events.oom, measurement.checkpoints.baseline.kernel.events.oom);
    assert.equal(measurement.checkpoints.settled.kernel.events.max, measurement.checkpoints.baseline.kernel.events.max);
    assert.ok(measurement.sampledCurrentPeakBytes < gib * 1024 ** 3);
    const { pid: _pid, ...settings } = backend;
    const database = { ...settings, appPoolMax: pool.options.max };
    t.diagnostic(JSON.stringify({ scenario: name, memoryGiB: gib, database, ...measurement,
      scope: 'app composition with periodic/media workers stopped; kernel peak includes startup, fixture generation and preceding cases',
      oomKillsUnchanged: true }));
  });
}
