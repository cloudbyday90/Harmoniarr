import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissingMusicDecisionPageService } from '../../src/server/missing-music/missing-music-decision-page-service.js';

function createFixture(t, { size = 301, matches = [] } = {}) {
  const rows = Array.from({ length: size }, (_, index) => ({ id: `release-${index}`, createdAtKey: '2026-09-11T00:00:00.000001Z' }));
  const listWantedReleaseIdentityPage = t.mock.fn(async ({ after, limit }) => {
    const start = after ? rows.findIndex((row) => row.id === after.id) + 1 : 0;
    return { rows: rows.slice(start, start + limit), hasMore: rows.length > start + limit };
  });
  const listWantedReleasesWithMetadata = t.mock.fn(async ({ wantedReleaseIds }) => [...wantedReleaseIds].reverse().map((id) => ({
    id, appUserId: 'actor', state: matches.includes(id) ? 'action' : 'other',
  })));
  return {
    rows, listWantedReleaseIdentityPage, listWantedReleasesWithMetadata,
    service: createMissingMusicDecisionPageService({ listWantedReleaseIdentityPage, listWantedReleasesWithMetadata }),
  };
}
const options = { appUserIds: ['actor'], search: null, state: 'all', limit: 50, after: null, projectDecision: (release) => ({ decisionId: release.id, state: release.state }) };

test('all-state pagination enriches only the requested page and restores source order', async (t) => {
  const fixture = createFixture(t);
  const first = await fixture.service.readDecisionPage(options);
  assert.equal(first.decisions.length, 50);
  assert.equal(first.scannedCount, 50);
  assert.equal(first.hasMore, true);
  assert.equal(first.nextAnchor.id, 'release-49');
  assert.equal(fixture.listWantedReleasesWithMetadata.mock.calls[0].arguments[0].wantedReleaseIds.length, 50);
  const next = await fixture.service.readDecisionPage({ ...options, after: first.nextAnchor });
  assert.equal(next.decisions[0].decisionId, 'release-50');
});

test('sparse state filters stop after 200 enriched sources and can continue past an empty range', async (t) => {
  const fixture = createFixture(t, { matches: ['release-250'] });
  const first = await fixture.service.readDecisionPage({ ...options, state: 'action' });
  assert.deepEqual(first.decisions, []);
  assert.equal(first.scanLimitReached, true);
  assert.equal(first.scannedCount, 200);
  assert.equal(first.nextAnchor.id, 'release-199');
  assert.equal(fixture.listWantedReleasesWithMetadata.mock.callCount(), 4);
  const next = await fixture.service.readDecisionPage({ ...options, state: 'action', after: first.nextAnchor });
  assert.deepEqual(next.decisions.map((decision) => decision.decisionId), ['release-250']);
  assert.equal(next.hasMore, false);
  assert.equal(next.nextAnchor, null);
});

test('filling a page partway through enrichment does not skip later matching decisions', async (t) => {
  const fixture = createFixture(t, { matches: ['release-0', 'release-1', 'release-2'] });
  const first = await fixture.service.readDecisionPage({ ...options, state: 'action', limit: 1 });
  assert.equal(first.scannedCount, 50);
  assert.equal(first.nextAnchor.id, 'release-0');
  const second = await fixture.service.readDecisionPage({ ...options, state: 'action', limit: 1, after: first.nextAnchor });
  assert.equal(second.decisions[0].decisionId, 'release-1');
});

test('rows deleted or moved outside the authorized scope during enrichment are not returned', async (t) => {
  const fixture = createFixture(t, { size: 2 });
  fixture.listWantedReleasesWithMetadata.mock.mockImplementation(async () => [{ id: 'release-0', appUserId: 'other', state: 'action' }]);
  const result = await fixture.service.readDecisionPage(options);
  assert.deepEqual(result.decisions, []);
  assert.equal(result.hasMore, false);
});
