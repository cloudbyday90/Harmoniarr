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
import { describe, it } from 'node:test';
import { sortMyRequests } from '../../src/client/lib/my-requests-presentation.js';

// ---------------------------------------------------------------------------
// sortMyRequests
// ---------------------------------------------------------------------------

describe('sortMyRequests', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(sortMyRequests([]), []);
  });

  it('does not mutate the original array', () => {
    const original = [
      { id: 'b', requestedAt: '2026-01-02' },
      { id: 'a', requestedAt: '2026-01-01' },
    ];
    const copy = [...original];
    sortMyRequests(original, { field: 'requested_at', order: 'asc' });
    assert.deepEqual(original, copy);
  });

  it('sorts by requestedAt descending by default', () => {
    const requests = [
      { id: 'a', requestedAt: '2026-01-01' },
      { id: 'b', requestedAt: '2026-01-03' },
      { id: 'c', requestedAt: '2026-01-02' },
    ];
    const result = sortMyRequests(requests);
    assert.deepEqual(result.map((r) => r.id), ['b', 'c', 'a']);
  });

  it('sorts by requestedAt ascending', () => {
    const requests = [
      { id: 'a', requestedAt: '2026-01-03' },
      { id: 'b', requestedAt: '2026-01-01' },
    ];
    const result = sortMyRequests(requests, { field: 'requested_at', order: 'asc' });
    assert.deepEqual(result.map((r) => r.id), ['b', 'a']);
  });

  it('falls back to createdAt when requestedAt is absent', () => {
    const requests = [
      { id: 'a', createdAt: '2026-01-01' },
      { id: 'b', createdAt: '2026-01-03' },
    ];
    const result = sortMyRequests(requests, { field: 'requested_at', order: 'desc' });
    assert.deepEqual(result.map((r) => r.id), ['b', 'a']);
  });

  it('sorts by title ascending using releaseGroupTitle', () => {
    const requests = [
      { id: 'a', releaseGroupTitle: 'Ziggy Stardust' },
      { id: 'b', releaseGroupTitle: 'Abbey Road' },
    ];
    const result = sortMyRequests(requests, { field: 'title', order: 'asc' });
    assert.deepEqual(result.map((r) => r.id), ['b', 'a']);
  });

  it('falls back to title when releaseGroupTitle is absent', () => {
    const requests = [
      { id: 'a', title: 'Ziggy Stardust' },
      { id: 'b', title: 'Abbey Road' },
    ];
    const result = sortMyRequests(requests, { field: 'title', order: 'asc' });
    assert.deepEqual(result.map((r) => r.id), ['b', 'a']);
  });

  it('sorts by title descending', () => {
    const requests = [
      { id: 'a', releaseGroupTitle: 'Abbey Road' },
      { id: 'b', releaseGroupTitle: 'Ziggy Stardust' },
    ];
    const result = sortMyRequests(requests, { field: 'title', order: 'desc' });
    assert.deepEqual(result.map((r) => r.id), ['b', 'a']);
  });

  it('sorts by artist ascending using artistSortName', () => {
    const requests = [
      { id: 'a', artistSortName: 'Zeppelin, Led' },
      { id: 'b', artistSortName: 'Beatles, The' },
    ];
    const result = sortMyRequests(requests, { field: 'artist', order: 'asc' });
    assert.deepEqual(result.map((r) => r.id), ['b', 'a']);
  });

  it('falls back to artistName when artistSortName is absent', () => {
    const requests = [
      { id: 'a', artistName: 'Radiohead' },
      { id: 'b', artistName: 'Daft Punk' },
    ];
    const result = sortMyRequests(requests, { field: 'artist', order: 'asc' });
    assert.deepEqual(result.map((r) => r.id), ['b', 'a']);
  });

  it('sorts by artist descending', () => {
    const requests = [
      { id: 'a', artistSortName: 'Beatles, The' },
      { id: 'b', artistSortName: 'Zeppelin, Led' },
    ];
    const result = sortMyRequests(requests, { field: 'artist', order: 'desc' });
    assert.deepEqual(result.map((r) => r.id), ['b', 'a']);
  });

  it('title sort is case-insensitive', () => {
    const requests = [
      { id: 'a', releaseGroupTitle: 'ziggy' },
      { id: 'b', releaseGroupTitle: 'Abbey' },
    ];
    const result = sortMyRequests(requests, { field: 'title', order: 'asc' });
    assert.deepEqual(result.map((r) => r.id), ['b', 'a']);
  });

  it('artist sort is case-insensitive', () => {
    const requests = [
      { id: 'a', artistName: 'zeppelin' },
      { id: 'b', artistName: 'Beatles' },
    ];
    const result = sortMyRequests(requests, { field: 'artist', order: 'asc' });
    assert.deepEqual(result.map((r) => r.id), ['b', 'a']);
  });

  it('preserves relative order for equal values', () => {
    const requests = [
      { id: 'a', requestedAt: '2026-01-01' },
      { id: 'b', requestedAt: '2026-01-01' },
    ];
    const result = sortMyRequests(requests, { field: 'requested_at', order: 'desc' });
    assert.equal(result.length, 2);
  });
});
