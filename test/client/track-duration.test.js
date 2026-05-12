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
import {
  computeMediaTotalMs,
  formatAlbumRuntime,
  formatFileDuration,
  formatTrackDuration,
} from '../../src/client/lib/track-duration.js';

// ---------------------------------------------------------------------------
// formatTrackDuration
// ---------------------------------------------------------------------------

describe('formatTrackDuration', () => {
  it('returns null for null', () => {
    assert.equal(formatTrackDuration(null), null);
  });

  it('returns null for undefined', () => {
    assert.equal(formatTrackDuration(undefined), null);
  });

  it('returns null for 0', () => {
    assert.equal(formatTrackDuration(0), null);
  });

  it('returns null for negative value', () => {
    assert.equal(formatTrackDuration(-1000), null);
  });

  it('formats one second as 0:01', () => {
    assert.equal(formatTrackDuration(1000), '0:01');
  });

  it('formats 59 seconds as 0:59', () => {
    assert.equal(formatTrackDuration(59000), '0:59');
  });

  it('formats exactly one minute as 1:00', () => {
    assert.equal(formatTrackDuration(60000), '1:00');
  });

  it('formats 1 minute 15 seconds as 1:15', () => {
    assert.equal(formatTrackDuration(75000), '1:15');
  });

  it('pads seconds below 10 with a leading zero', () => {
    assert.equal(formatTrackDuration(63000), '1:03');
  });

  it('formats a typical 3-minute track', () => {
    assert.equal(formatTrackDuration(210000), '3:30');
  });

  it('formats 60 minutes without switching to hours', () => {
    assert.equal(formatTrackDuration(3600000), '60:00');
  });

  it('rounds sub-second remainders using Math.round', () => {
    // 60499 ms rounds to 60 s → 1:00
    assert.equal(formatTrackDuration(60499), '1:00');
    // 60500 ms rounds to 61 s → 1:01
    assert.equal(formatTrackDuration(60500), '1:01');
  });
});

// ---------------------------------------------------------------------------
// formatFileDuration
// ---------------------------------------------------------------------------

describe('formatFileDuration', () => {
  it('returns null for null', () => {
    assert.equal(formatFileDuration(null), null);
  });

  it('returns null for undefined', () => {
    assert.equal(formatFileDuration(undefined), null);
  });

  it('returns null for 0', () => {
    assert.equal(formatFileDuration(0), null);
  });

  it('returns null for negative value', () => {
    assert.equal(formatFileDuration(-30), null);
  });

  it('formats 1 second as 0:01', () => {
    assert.equal(formatFileDuration(1), '0:01');
  });

  it('formats 90 seconds as 1:30', () => {
    assert.equal(formatFileDuration(90), '1:30');
  });

  it('formats exactly 60 seconds as 1:00', () => {
    assert.equal(formatFileDuration(60), '1:00');
  });

  it('pads seconds below 10 with a leading zero', () => {
    assert.equal(formatFileDuration(63), '1:03');
  });

  it('formats a typical 4-minute file', () => {
    assert.equal(formatFileDuration(247), '4:07');
  });
});

// ---------------------------------------------------------------------------
// computeMediaTotalMs
// ---------------------------------------------------------------------------

describe('computeMediaTotalMs', () => {
  it('returns 0 for null', () => {
    assert.equal(computeMediaTotalMs(null), 0);
  });

  it('returns 0 for undefined', () => {
    assert.equal(computeMediaTotalMs(undefined), 0);
  });

  it('returns 0 for empty array', () => {
    assert.equal(computeMediaTotalMs([]), 0);
  });

  it('returns 0 when media has no tracks', () => {
    assert.equal(computeMediaTotalMs([{ tracks: [] }]), 0);
  });

  it('returns 0 when all tracks have no lengthMs', () => {
    const media = [{ tracks: [{ title: 'A' }, { title: 'B' }] }];
    assert.equal(computeMediaTotalMs(media), 0);
  });

  it('sums track lengths from a single medium', () => {
    const media = [
      { tracks: [{ lengthMs: 200000 }, { lengthMs: 180000 }, { lengthMs: 220000 }] },
    ];
    assert.equal(computeMediaTotalMs(media), 600000);
  });

  it('sums track lengths across multiple media', () => {
    const media = [
      { tracks: [{ lengthMs: 300000 }, { lengthMs: 300000 }] },
      { tracks: [{ lengthMs: 300000 }, { lengthMs: 300000 }] },
    ];
    assert.equal(computeMediaTotalMs(media), 1200000);
  });

  it('skips tracks where lengthMs is absent or falsy', () => {
    const media = [
      { tracks: [{ lengthMs: 100000 }, { lengthMs: 0 }, { title: 'No length' }] },
    ];
    assert.equal(computeMediaTotalMs(media), 100000);
  });

  it('skips media entries without a tracks array', () => {
    const media = [{ title: 'Medium without tracks' }, { tracks: [{ lengthMs: 50000 }] }];
    assert.equal(computeMediaTotalMs(media), 50000);
  });
});

// ---------------------------------------------------------------------------
// formatAlbumRuntime
// ---------------------------------------------------------------------------

describe('formatAlbumRuntime', () => {
  it('returns null for null', () => {
    assert.equal(formatAlbumRuntime(null), null);
  });

  it('returns null for undefined', () => {
    assert.equal(formatAlbumRuntime(undefined), null);
  });

  it('returns null for 0', () => {
    assert.equal(formatAlbumRuntime(0), null);
  });

  it('returns null for negative value', () => {
    assert.equal(formatAlbumRuntime(-1000), null);
  });

  it('formats sub-minute totals as 0:ss', () => {
    assert.equal(formatAlbumRuntime(30000), '0:30');
  });

  it('formats exactly one minute as 1:00', () => {
    assert.equal(formatAlbumRuntime(60000), '1:00');
  });

  it('formats a typical album runtime under one hour', () => {
    assert.equal(formatAlbumRuntime(2520000), '42:00');
  });

  it('formats exactly one hour as 1:00:00', () => {
    assert.equal(formatAlbumRuntime(3600000), '1:00:00');
  });

  it('formats a runtime over one hour with h:mm:ss', () => {
    // 1 hour, 5 min, 3 sec
    assert.equal(formatAlbumRuntime(3903000), '1:05:03');
  });

  it('pads minutes and seconds below 10 in h:mm:ss mode', () => {
    // 2 hours, 3 min, 7 sec
    assert.equal(formatAlbumRuntime(7387000), '2:03:07');
  });

  it('rounds sub-second remainders', () => {
    // 59999 ms rounds to 60 s → 1:00
    assert.equal(formatAlbumRuntime(59999), '1:00');
  });
});
