/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ref } from 'vue';
import { useLibraryReleases } from '../../src/client/composables/useLibraryReleases.js';

function makeRelease(overrides = {}) {
  return {
    id: 'reconciliation-uuid-1',
    artistName: 'Radiohead',
    artistSortName: 'Radiohead',
    duplicateTrackCount: 0,
    expectedTrackCount: 12,
    lastReconciledAt: '2026-04-30T10:00:00.000Z',
    matchedFileCount: 12,
    matchedTrackCount: 12,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'rg-1',
    metadataReleaseId: 'release-1',
    missingTrackCount: 0,
    musicbrainzReleaseGroupId: 'rg-mbid-1',
    musicbrainzReleaseId: 'rel-mbid-1',
    reconciliationStatus: 'complete',
    releaseDate: '1997-05-21',
    releaseDisambiguation: null,
    releaseGroupTitle: 'OK Computer',
    releaseGroupType: 'Album',
    releaseStatus: 'Official',
    releaseTitle: 'OK Computer',
    ...overrides,
  };
}

let origDocument;

function stubDocument() {
  const listeners = new Map();
  origDocument = globalThis.document;

  globalThis.document = {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(fn);
        if (idx >= 0) arr.splice(idx, 1);
      }
    },
    get visibilityState() {
      return this._vis ?? 'visible';
    },
    _vis: 'visible',
  };

  return listeners;
}

function restoreDocument() {
  globalThis.document = origDocument;
}

describe('useLibraryReleases', () => {
  test('has correct initial state', () => {
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => ({ total: 0, releases: [] }),
    });

    assert.equal(c.isLoading.value, true);
    assert.equal(c.isRevalidating.value, false);
    assert.equal(c.errorMessage.value, '');
    assert.deepEqual(c.releases.value, []);
    assert.equal(c.totalCount.value, 0);
    assert.deepEqual(c.completeReleases.value, []);
    assert.deepEqual(c.partialReleases.value, []);
    assert.deepEqual(c.duplicateReleases.value, []);
    c.destroy();
  });

  test('loads releases and exposes them', async () => {
    const releases = [
      makeRelease({ reconciliationStatus: 'complete' }),
      makeRelease({ id: 'uuid-2', releaseTitle: 'Amnesiac', reconciliationStatus: 'partial', matchedTrackCount: 6 }),
    ];
    let fetchCount = 0;
    const fetchLibraryReleases = async () => {
      fetchCount += 1;
      return { total: 2, releases };
    };

    const c = useLibraryReleases({ fetchLibraryReleases });
    await c.loadReleases();

    assert.equal(fetchCount, 1);
    assert.equal(c.isLoading.value, false);
    assert.equal(c.isRevalidating.value, false);
    assert.equal(c.errorMessage.value, '');
    assert.equal(c.totalCount.value, 2);
    assert.equal(c.releases.value.length, 2);
    c.destroy();
  });

  test('passes reconciliationStatus filter to fetch', async () => {
    let captured = null;
    const fetchLibraryReleases = async (params) => {
      captured = params;
      return { total: 0, releases: [] };
    };

    const c = useLibraryReleases({ fetchLibraryReleases });
    await c.loadReleases({ reconciliationStatus: 'complete' });

    assert.equal(captured.reconciliationStatus, 'complete');
    c.destroy();
  });

  test('passes partial reconciliationStatus filter', async () => {
    let captured = null;
    const fetchLibraryReleases = async (params) => {
      captured = params;
      return { total: 0, releases: [] };
    };

    const c = useLibraryReleases({ fetchLibraryReleases });
    await c.loadReleases({ reconciliationStatus: 'partial' });

    assert.equal(captured.reconciliationStatus, 'partial');
    c.destroy();
  });

  test('passes duplicate reconciliationStatus filter', async () => {
    let captured = null;
    const fetchLibraryReleases = async (params) => {
      captured = params;
      return { total: 0, releases: [] };
    };

    const c = useLibraryReleases({ fetchLibraryReleases });
    await c.loadReleases({ reconciliationStatus: 'duplicate' });

    assert.equal(captured.reconciliationStatus, 'duplicate');
    c.destroy();
  });

  test('passes visibility filter through filter state', async () => {
    let captured = null;
    const fetchLibraryReleases = async (params) => {
      captured = params;
      return { total: 0, releases: [] };
    };

    const c = useLibraryReleases({
      fetchLibraryReleases,
      filterState: ref({
        filters: { visibility: 'removed' },
        sort: { field: 'artist', order: 'asc' },
      }),
    });

    c.retry();
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    assert.equal(captured.visibility, 'removed');
    c.destroy();
  });

  test('passes null reconciliationStatus when omitted', async () => {
    let captured = null;
    const fetchLibraryReleases = async (params) => {
      captured = params;
      return { total: 0, releases: [] };
    };

    const c = useLibraryReleases({ fetchLibraryReleases });
    await c.loadReleases();

    assert.equal(captured.reconciliationStatus, null);
    c.destroy();
  });

  test('completeReleases filters to complete status', async () => {
    const releases = [
      makeRelease({ id: '1', reconciliationStatus: 'complete' }),
      makeRelease({ id: '2', reconciliationStatus: 'partial', matchedTrackCount: 4 }),
      makeRelease({ id: '3', reconciliationStatus: 'complete' }),
    ];
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => ({ total: 3, releases }),
    });

    await c.loadReleases();

    assert.equal(c.completeReleases.value.length, 2);
    assert.ok(c.completeReleases.value.every((r) => r.reconciliationStatus === 'complete'));
    c.destroy();
  });

  test('partialReleases filters to partial status', async () => {
    const releases = [
      makeRelease({ id: '1', reconciliationStatus: 'complete' }),
      makeRelease({ id: '2', reconciliationStatus: 'partial', matchedTrackCount: 4 }),
    ];
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => ({ total: 2, releases }),
    });

    await c.loadReleases();

    assert.equal(c.partialReleases.value.length, 1);
    assert.equal(c.partialReleases.value[0].reconciliationStatus, 'partial');
    c.destroy();
  });

  test('duplicateReleases filters to duplicate status', async () => {
    const releases = [
      makeRelease({ id: '1', reconciliationStatus: 'complete' }),
      makeRelease({ id: '2', reconciliationStatus: 'duplicate', duplicateTrackCount: 2 }),
    ];
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => ({ total: 2, releases }),
    });

    await c.loadReleases();

    assert.equal(c.duplicateReleases.value.length, 1);
    assert.equal(c.duplicateReleases.value[0].reconciliationStatus, 'duplicate');
    c.destroy();
  });

  test('includes musicbrainzReleaseId in returned releases', async () => {
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => ({
        total: 1,
        releases: [makeRelease({ musicbrainzReleaseId: 'test-mbid' })],
      }),
    });

    await c.loadReleases();

    assert.equal(c.releases.value[0].musicbrainzReleaseId, 'test-mbid');
    c.destroy();
  });

  test('surfaces fetch errors in errorMessage', async () => {
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => {
        throw new Error('network error fetching library releases');
      },
    });

    await c.loadReleases();

    assert.equal(c.isLoading.value, false);
    assert.equal(c.errorMessage.value, 'network error fetching library releases');
    assert.deepEqual(c.releases.value, []);
    assert.equal(c.totalCount.value, 0);
    c.destroy();
  });

  test('preserves staleData on fetch error (SWR)', async () => {
    let callCount = 0;
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => {
        callCount += 1;
        if (callCount === 1) return { total: 1, releases: [makeRelease()] };
        throw new Error('second call failed');
      },
    });

    await c.loadReleases();
    assert.equal(c.releases.value.length, 1);

    await c.loadReleases();
    assert.equal(c.staleData.value.length, 1, 'staleData should hold last-good data');
    assert.equal(c.errorMessage.value, 'second call failed');
    c.destroy();
  });

  test('clears error on successful reload', async () => {
    let callCount = 0;
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => {
        callCount += 1;
        if (callCount === 1) throw new Error('transient error');
        return { total: 0, releases: [] };
      },
    });

    await c.loadReleases();
    assert.equal(c.errorMessage.value, 'transient error');

    await c.loadReleases();
    assert.equal(c.errorMessage.value, '');
    c.destroy();
  });

  test('handles empty releases array', async () => {
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => ({ total: 0, releases: [] }),
    });

    await c.loadReleases();

    assert.equal(c.totalCount.value, 0);
    assert.deepEqual(c.releases.value, []);
    assert.equal(c.isLoading.value, false);
    assert.equal(c.errorMessage.value, '');
    c.destroy();
  });

  test('handles missing releases field gracefully', async () => {
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => ({ total: 0 }),
    });

    await c.loadReleases();

    assert.deepEqual(c.releases.value, []);
    c.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => ({ total: 0, releases: [] }),
    });

    await c.loadReleases();
    assert.equal(c.isRevalidating.value, false);

    const p = c.revalidate();
    assert.equal(c.isRevalidating.value, true);
    await p;
    assert.equal(c.isRevalidating.value, false);
    c.destroy();
  });

  test('revalidate preserves stale data on error', async () => {
    let callCount = 0;
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => {
        callCount += 1;
        if (callCount === 1) return { total: 1, releases: [makeRelease()] };
        throw new Error('refresh failed');
      },
    });

    await c.loadReleases();
    assert.equal(c.releases.value.length, 1);

    await c.revalidate();
    assert.equal(c.staleData.value.length, 1, 'stale data preserved on revalidation error');
    assert.equal(c.isRevalidating.value, false);
    c.destroy();
  });

  test('revalidate is no-op after destroy', async () => {
    let fetchCount = 0;
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => {
        fetchCount += 1;
        return { total: 0, releases: [] };
      },
    });

    await c.loadReleases();
    assert.equal(fetchCount, 1);
    c.destroy();

    await c.revalidate();
    assert.equal(fetchCount, 1, 'no fetch after destroy');
  });

  test('loadReleases is no-op after destroy', async () => {
    let fetchCount = 0;
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => {
        fetchCount += 1;
        return { total: 0, releases: [] };
      },
    });

    await c.loadReleases();
    assert.equal(fetchCount, 1);
    c.destroy();

    await c.loadReleases();
    assert.equal(fetchCount, 1, 'no fetch after destroy');
  });

  test('retry is no-op after destroy', async () => {
    let fetchCount = 0;
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => {
        fetchCount += 1;
        return { total: 0, releases: [] };
      },
    });

    await c.loadReleases();
    assert.equal(fetchCount, 1);
    c.destroy();

    c.retry();
    await new Promise((r) => { setTimeout(r, 50); });
    assert.equal(fetchCount, 1, 'no fetch after destroy');
  });

  test('destroy aborts in-flight request', async () => {
    let aborted = false;
    const c = useLibraryReleases({
      fetchLibraryReleases: async ({ signal }) => {
        return new Promise((resolve, reject) => {
          const onAbort = () => {
            aborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          };
          if (signal.aborted) {
            onAbort();
            return;
          }
          signal.addEventListener('abort', onAbort, { once: true });
        });
      },
    });

    const p = c.loadReleases();
    c.destroy();
    await p.catch(() => {});
    assert.equal(aborted, true, 'in-flight request was aborted');
  });

  test('destroy stops polling', async () => {
    let fetchCount = 0;
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => {
        fetchCount += 1;
        return { total: 0, releases: [] };
      },
      pollIntervalMs: 50,
    });

    await c.loadReleases();
    assert.equal(fetchCount, 1);
    c.destroy();

    await new Promise((r) => { setTimeout(r, 120); });
    assert.equal(fetchCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    let fetchCount = 0;
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => {
        fetchCount += 1;
        return { total: 0, releases: [] };
      },
      pollIntervalMs: 0,
    });

    await c.loadReleases();
    assert.equal(fetchCount, 1);

    await new Promise((r) => { setTimeout(r, 80); });
    assert.equal(fetchCount, 1, 'no polling when pollIntervalMs=0');
    c.destroy();
  });

  test('attachVisibilityListener triggers revalidate on visibility change', async () => {
    const listeners = stubDocument();
    let fetchCount = 0;
    const c = useLibraryReleases({
      fetchLibraryReleases: async () => {
        fetchCount += 1;
        return { total: 0, releases: [] };
      },
    });

    await c.loadReleases();
    const countBefore = fetchCount;

    c.attachVisibilityListener();
    assert.equal(listeners.get('visibilitychange').length, 1, 'handler registered');

    globalThis.document._vis = 'visible';
    await listeners.get('visibilitychange')[0]();
    assert.equal(fetchCount, countBefore + 1, 'revalidate called on visibility change');

    c.destroy();
    assert.equal(listeners.get('visibilitychange').length, 0, 'listener removed on destroy');
    restoreDocument();
  });

  test('revalidate re-fires with last params', async () => {
    let captured = null;
    const c = useLibraryReleases({
      fetchLibraryReleases: async (params) => {
        captured = params;
        return { total: 0, releases: [] };
      },
    });

    await c.loadReleases({ reconciliationStatus: 'partial' });
    assert.equal(captured.reconciliationStatus, 'partial');

    await c.revalidate();
    assert.equal(captured.reconciliationStatus, 'partial', 'revalidate uses last params');
    c.destroy();
  });

  test('retry maps URL-backed filter state into status, format, sort, and order params', async () => {
    let captured = null;
    const filterState = ref({
      filters: { status: 'partial', format: 'FLAC' },
      sort: { field: 'artist', order: 'asc' },
    });
    const c = useLibraryReleases({
      filterState,
      fetchLibraryReleases: async (params) => {
        captured = params;
        return { total: 0, releases: [] };
      },
    });

    c.retry();
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    assert.equal(captured.reconciliationStatus, 'partial');
    assert.equal(captured.format, 'FLAC');
    assert.equal(captured.sort, 'artist');
    assert.equal(captured.order, 'asc');
    c.destroy();
  });
});
