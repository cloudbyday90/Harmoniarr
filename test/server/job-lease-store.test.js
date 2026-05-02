import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildJobLeaseKey,
  createJobLeaseStore,
  normalizeJobLease,
} from '../../src/server/job-lease-store.js';

test('buildJobLeaseKey joins the job type and run id once', () => {
  assert.equal(buildJobLeaseKey({ jobType: 'library_scan', runId: 'run-1' }), 'library_scan:run-1');
});

test('normalizeJobLease marks an unreleased expired lease as expired', () => {
  const lease = normalizeJobLease({
    acquired_at: new Date('2026-05-01T00:00:00.000Z'),
    created_at: new Date('2026-05-01T00:00:00.000Z'),
    expires_at: new Date('2026-05-01T00:15:00.000Z'),
    heartbeat_at: new Date('2026-05-01T00:05:00.000Z'),
    id: 'lease-1',
    job_type: 'artwork_cleanup',
    lease_key: 'artwork_cleanup:run-9',
    owner_instance_id: 'pid:44',
    released_at: null,
    status: 'active',
  }, {
    now: new Date('2026-05-01T00:20:00.000Z'),
  });

  assert.equal(lease.state, 'expired');
  assert.equal(lease.status, 'active');
});

test('job lease store renews a lease by updating heartbeat and expiry timestamps', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      acquired_at: new Date('2026-05-01T00:00:00.000Z'),
      created_at: new Date('2026-05-01T00:00:00.000Z'),
      expires_at: new Date('2026-05-01T00:31:00.000Z'),
      heartbeat_at: new Date('2026-05-01T00:01:00.000Z'),
      id: 'lease-2',
      job_type: 'library_scan',
      lease_key: 'library_scan:run-2',
      owner_instance_id: 'instance-a',
      released_at: null,
      status: 'active',
    }],
  }));
  const jobLeaseStore = createJobLeaseStore({
    getPoolFn: () => ({ query }),
    leaseDurationMs: 60_000,
    nowFn: () => new Date('2026-05-01T00:01:01.000Z'),
  });

  const lease = await jobLeaseStore.renewLease({
    leaseKey: 'library_scan:run-2',
    status: 'active',
  });

  assert.deepEqual(query.mock.calls[0].arguments[1], ['library_scan:run-2', 60_000, 'active']);
  assert.equal(lease.state, 'active');
  assert.equal(lease.leaseKey, 'library_scan:run-2');
});

test('job lease store lists a batch of leases by key', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      acquired_at: new Date('2026-05-01T00:00:00.000Z'),
      created_at: new Date('2026-05-01T00:00:00.000Z'),
      expires_at: new Date('2026-05-01T00:30:00.000Z'),
      heartbeat_at: new Date('2026-05-01T00:02:00.000Z'),
      id: 'lease-3',
      job_type: 'library_scan',
      lease_key: 'library_scan:run-3',
      owner_instance_id: 'instance-b',
      released_at: null,
      status: 'active',
    }],
  }));
  const jobLeaseStore = createJobLeaseStore({
    getPoolFn: () => ({ query }),
    nowFn: () => new Date('2026-05-01T00:02:30.000Z'),
  });

  const leases = await jobLeaseStore.listLeases({
    leaseKeys: ['library_scan:run-3'],
  });

  assert.deepEqual(query.mock.calls[0].arguments[1], [['library_scan:run-3']]);
  assert.equal(leases[0].ownerInstanceId, 'instance-b');
  assert.equal(leases[0].state, 'active');
});