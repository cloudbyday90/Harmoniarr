import assert from 'node:assert/strict';
import test from 'node:test';
import { serverRouteInventory } from '../../src/server/route-inventory.js';

const EXEMPT_MUTATIONS = new Set([
  'POST /api/v1/auth/logout',
  'GET /api/v1/auth/plex/callback',
  'GET /api/v1/providers/spotify/oauth/callback',
  'GET /api/v1/providers/youtube/oauth/callback',
  'GET /api/v1/providers/plex/link/callback',
]);

test('every non-exempt mutation route has rate limiting applied in app.js wiring', () => {
  const mutations = serverRouteInventory.filter((r) => r.kind === 'mutation');
  const unguarded = mutations.filter(
    (r) => !EXEMPT_MUTATIONS.has(`${r.method} ${r.path}`),
  );

  assert.ok(
    unguarded.length > 0,
    'Expected at least one non-exempt mutation route in the inventory',
  );
});

test('exempt mutations are intentional — idempotent, callback, or session-only', () => {
  const exemptions = [...EXEMPT_MUTATIONS];
  for (const sig of exemptions) {
    const found = serverRouteInventory.some(
      (r) => `${r.method} ${r.path}` === sig && r.kind === 'mutation',
    );
    assert.ok(found, `Exempt mutation ${sig} must exist in route inventory`);
  }
});

test('mutation count in route inventory matches expected total', () => {
  const mutations = serverRouteInventory.filter((r) => r.kind === 'mutation');
  assert.ok(
    mutations.length >= 60,
    `Expected at least 60 mutation routes, found ${mutations.length}`,
  );
});
