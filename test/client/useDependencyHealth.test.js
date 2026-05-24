import assert from 'node:assert/strict';
import test from 'node:test';
import { useDependencyHealth } from '../../src/client/composables/useDependencyHealth.js';

test('useDependencyHealth loads dependencies from system overview', async (t) => {
  const fetchSystemOverview = t.mock.fn(async () => ({
    dependencies: [
      { provider: 'slskd', status: 'healthy', details: { observedAt: '2026-05-15T10:00:00.000Z' } },
      { provider: 'musicbrainz', status: 'degraded', message: 'Rate limited', details: { observedAt: '2026-05-15T09:55:00.000Z' } },
    ],
  }));

  const { dependencies, loadDependencyHealth } = useDependencyHealth({ fetchSystemOverview });

  await loadDependencyHealth();

  assert.equal(dependencies.value.length, 2);
  assert.equal(dependencies.value[0].provider, 'slskd');
  assert.equal(dependencies.value[0].status, 'healthy');
  assert.equal(dependencies.value[1].provider, 'musicbrainz');
  assert.equal(dependencies.value[1].message, 'Rate limited');
});

test('useDependencyHealth sets dependencies to empty array when payload has no dependencies', async (t) => {
  const fetchSystemOverview = t.mock.fn(async () => ({ ok: true }));

  const { dependencies, loadDependencyHealth } = useDependencyHealth({ fetchSystemOverview });

  await loadDependencyHealth();

  assert.deepEqual(dependencies.value, []);
});

test('useDependencyHealth sets loadError on fetch failure', async (t) => {
  const fetchSystemOverview = t.mock.fn(async () => {
    throw new Error('Network error');
  });

  const { dependencies, loadDependencyHealth, loadError } = useDependencyHealth({ fetchSystemOverview });

  await loadDependencyHealth();

  assert.equal(loadError.value, 'Network error');
  assert.deepEqual(dependencies.value, []);
});

test('useDependencyHealth sets isLoading around fetch', async (t) => {
  let resolvePromise;
  const fetchSystemOverview = t.mock.fn(async () => {
    await new Promise((resolve) => { resolvePromise = resolve; });
    return { dependencies: [] };
  });

  const { isLoading, loadDependencyHealth } = useDependencyHealth({ fetchSystemOverview });

  const loadPromise = loadDependencyHealth();
  assert.equal(isLoading.value, true);
  resolvePromise();
  await loadPromise;
  assert.equal(isLoading.value, false);
});
