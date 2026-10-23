import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { closePool, getPool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { runDeploymentMemoryWorkload } from '../../testing/server/deployment-memory-workload.js';

const { gib, profile } = await requireDeploymentMemoryProfile();

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
