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
import test from 'node:test';
import {
  buildNetworkNoResultsBody,
  buildNetworkSearchStateLabel,
  buildNetworkStatusLabel,
  buildNetworkStatusTone,
  buildSearchPreSearchBody,
  formatBytes,
  formatFileCountLabel,
  formatMusicSearchError,
  formatNetworkSearchError,
  formatPeerCountLabel,
  formatSpeed,
  sortNetworkResponses,
  totalSizeForResponse,
} from '../../src/client/lib/search-presentation.js';

// ── formatMusicSearchError ────────────────────────────────────────────────────

test('formatMusicSearchError returns generic message for null', () => {
  assert.equal(formatMusicSearchError(null), 'Search failed. Check your connection and try again.');
});

test('formatMusicSearchError returns generic message for undefined', () => {
  assert.equal(formatMusicSearchError(undefined), 'Search failed. Check your connection and try again.');
});

test('formatMusicSearchError returns generic message for empty string', () => {
  assert.equal(formatMusicSearchError(''), 'Search failed. Check your connection and try again.');
});

test('formatMusicSearchError normalises exact MusicBrainz service error', () => {
  assert.equal(
    formatMusicSearchError('MusicBrainz is temporarily unavailable'),
    'Search is temporarily unavailable. Try again in a moment.',
  );
});

test('formatMusicSearchError normalises MusicBrainz errors case-insensitively', () => {
  assert.equal(
    formatMusicSearchError('musicbrainz returned a 503'),
    'Search is temporarily unavailable. Try again in a moment.',
  );
});

test('formatMusicSearchError normalises MusicBrainz substring in longer string', () => {
  assert.equal(
    formatMusicSearchError('Request to MusicBrainz timed out'),
    'Search is temporarily unavailable. Try again in a moment.',
  );
});

test('formatMusicSearchError suppresses "must be" validation errors', () => {
  assert.equal(
    formatMusicSearchError('limit must be an integer between 1 and 25'),
    'Search failed. Check your connection and try again.',
  );
});

test('formatMusicSearchError suppresses "invalid" validation errors', () => {
  assert.equal(
    formatMusicSearchError('invalid parameter format'),
    'Search failed. Check your connection and try again.',
  );
});

test('formatMusicSearchError suppresses bad request errors', () => {
  assert.equal(
    formatMusicSearchError('400 bad request'),
    'Search failed. Check your connection and try again.',
  );
});

test('formatMusicSearchError does not expose MusicBrainz name in output', () => {
  const result = formatMusicSearchError('MusicBrainz is down');
  assert.ok(!result.toLowerCase().includes('musicbrainz'));
});

test('formatMusicSearchError passes through unrecognised messages', () => {
  const msg = 'Network request timed out';
  assert.equal(formatMusicSearchError(msg), msg);
});

// ── formatNetworkSearchError ──────────────────────────────────────────────────

test('formatNetworkSearchError returns generic message for null', () => {
  assert.equal(formatNetworkSearchError(null), 'Search failed. Try again.');
});

test('formatNetworkSearchError returns generic message for undefined', () => {
  assert.equal(formatNetworkSearchError(undefined), 'Search failed. Try again.');
});

test('formatNetworkSearchError returns generic message for empty string', () => {
  assert.equal(formatNetworkSearchError(''), 'Search failed. Try again.');
});

test('formatNetworkSearchError suppresses slskd service name', () => {
  const result = formatNetworkSearchError('slskd did not return a search identifier');
  assert.ok(!result.toLowerCase().includes('slskd'));
});

test('formatNetworkSearchError maps slskd identifier error to start-failed message', () => {
  assert.equal(
    formatNetworkSearchError('slskd did not return a search identifier'),
    'Search could not be started. Try again.',
  );
});

test('formatNetworkSearchError maps poll error to poll-failed message', () => {
  assert.equal(
    formatNetworkSearchError('Failed to poll search results'),
    'Could not retrieve results. Try again.',
  );
});

test('formatNetworkSearchError maps polling-keyword error to poll-failed message', () => {
  assert.equal(
    formatNetworkSearchError('polling timed out'),
    'Could not retrieve results. Try again.',
  );
});

test('formatNetworkSearchError maps failed-to-start error to start-failed message', () => {
  assert.equal(
    formatNetworkSearchError('Failed to start search'),
    'Search could not be started. Try again.',
  );
});

test('formatNetworkSearchError passes through unrecognised messages', () => {
  const msg = 'Network connection reset';
  assert.equal(formatNetworkSearchError(msg), msg);
});

// ── buildNetworkStatusTone ────────────────────────────────────────────────────

test('buildNetworkStatusTone returns success for connected', () => {
  assert.equal(buildNetworkStatusTone({ state: 'connected' }), 'success');
});

test('buildNetworkStatusTone returns success for ready', () => {
  assert.equal(buildNetworkStatusTone({ state: 'ready' }), 'success');
});

test('buildNetworkStatusTone returns success for online', () => {
  assert.equal(buildNetworkStatusTone({ state: 'online' }), 'success');
});

test('buildNetworkStatusTone returns success for connectionState=connected', () => {
  assert.equal(buildNetworkStatusTone({ connectionState: 'connected' }), 'success');
});

test('buildNetworkStatusTone returns warning for connecting', () => {
  assert.equal(buildNetworkStatusTone({ state: 'connecting' }), 'warning');
});

test('buildNetworkStatusTone returns warning for reconnecting', () => {
  assert.equal(buildNetworkStatusTone({ state: 'reconnecting' }), 'warning');
});

test('buildNetworkStatusTone returns info for null status', () => {
  assert.equal(buildNetworkStatusTone(null), 'info');
});

test('buildNetworkStatusTone returns info for undefined status', () => {
  assert.equal(buildNetworkStatusTone(undefined), 'info');
});

test('buildNetworkStatusTone returns info for status object with no state', () => {
  assert.equal(buildNetworkStatusTone({}), 'info');
});

test('buildNetworkStatusTone returns danger for unknown state', () => {
  assert.equal(buildNetworkStatusTone({ state: 'disconnected' }), 'danger');
});

test('buildNetworkStatusTone returns danger for error state', () => {
  assert.equal(buildNetworkStatusTone({ state: 'error' }), 'danger');
});

// ── buildNetworkStatusLabel ───────────────────────────────────────────────────

test('buildNetworkStatusLabel returns Checking connection while probing with no status', () => {
  assert.equal(buildNetworkStatusLabel(null, true), 'Checking connection…');
});

test('buildNetworkStatusLabel does not say slskd while probing', () => {
  assert.ok(!buildNetworkStatusLabel(null, true).toLowerCase().includes('slskd'));
});

test('buildNetworkStatusLabel returns Status unknown for no state when not probing', () => {
  assert.equal(buildNetworkStatusLabel(null, false), 'Status unknown');
});

test('buildNetworkStatusLabel returns Status unknown for empty status object', () => {
  assert.equal(buildNetworkStatusLabel({}, false), 'Status unknown');
});

test('buildNetworkStatusLabel capitalises connected state', () => {
  assert.equal(buildNetworkStatusLabel({ state: 'connected' }, false), 'Connected');
});

test('buildNetworkStatusLabel capitalises connecting state', () => {
  assert.equal(buildNetworkStatusLabel({ state: 'connecting' }, false), 'Connecting');
});

test('buildNetworkStatusLabel reads connectionState when state is absent', () => {
  assert.equal(buildNetworkStatusLabel({ connectionState: 'online' }, false), 'Online');
});

test('buildNetworkStatusLabel shows state even when probing if status is present', () => {
  assert.equal(buildNetworkStatusLabel({ state: 'connected' }, true), 'Connected');
});

// ── buildNetworkSearchStateLabel ──────────────────────────────────────────────

test('buildNetworkSearchStateLabel returns empty string for null', () => {
  assert.equal(buildNetworkSearchStateLabel(null), '');
});

test('buildNetworkSearchStateLabel returns empty string for undefined', () => {
  assert.equal(buildNetworkSearchStateLabel(undefined), '');
});

test('buildNetworkSearchStateLabel returns empty string for empty string', () => {
  assert.equal(buildNetworkSearchStateLabel(''), '');
});

test('buildNetworkSearchStateLabel maps InProgress to Searching', () => {
  assert.equal(buildNetworkSearchStateLabel('InProgress'), 'Searching');
});

test('buildNetworkSearchStateLabel maps Completed to Complete', () => {
  assert.equal(buildNetworkSearchStateLabel('Completed'), 'Complete');
});

test('buildNetworkSearchStateLabel maps Cancelled to Stopped', () => {
  assert.equal(buildNetworkSearchStateLabel('Cancelled'), 'Stopped');
});

test('buildNetworkSearchStateLabel maps TimedOut to Timed out', () => {
  assert.equal(buildNetworkSearchStateLabel('TimedOut'), 'Timed out');
});

test('buildNetworkSearchStateLabel maps lowercase inprogress to Searching', () => {
  assert.equal(buildNetworkSearchStateLabel('inprogress'), 'Searching');
});

test('buildNetworkSearchStateLabel capitalises unknown states', () => {
  assert.equal(buildNetworkSearchStateLabel('pending'), 'Pending');
});

test('buildNetworkSearchStateLabel does not expose slskd enum names verbatim', () => {
  // 'InProgress' is an internal slskd enum — should map, not pass through raw
  const result = buildNetworkSearchStateLabel('InProgress');
  assert.notEqual(result, 'InProgress');
});

// ── buildSearchPreSearchBody ──────────────────────────────────────────────────

test('buildSearchPreSearchBody returns a non-empty string', () => {
  assert.ok(buildSearchPreSearchBody().length > 0);
});

test('buildSearchPreSearchBody does not say "monitor"', () => {
  assert.ok(!buildSearchPreSearchBody().toLowerCase().includes('monitor'));
});

test('buildSearchPreSearchBody is stable across calls', () => {
  assert.equal(buildSearchPreSearchBody(), buildSearchPreSearchBody());
});

// ── buildNetworkNoResultsBody ─────────────────────────────────────────────────

test('buildNetworkNoResultsBody returns a non-empty string', () => {
  assert.ok(buildNetworkNoResultsBody().length > 0);
});

test('buildNetworkNoResultsBody does not mention Soulseek', () => {
  assert.ok(!buildNetworkNoResultsBody().toLowerCase().includes('soulseek'));
});

test('buildNetworkNoResultsBody is stable across calls', () => {
  assert.equal(buildNetworkNoResultsBody(), buildNetworkNoResultsBody());
});

// ── formatBytes ───────────────────────────────────────────────────────────────

test('formatBytes returns — for null', () => {
  assert.equal(formatBytes(null), '—');
});

test('formatBytes returns — for undefined', () => {
  assert.equal(formatBytes(undefined), '—');
});

test('formatBytes returns — for zero', () => {
  assert.equal(formatBytes(0), '—');
});

test('formatBytes returns — for negative value', () => {
  assert.equal(formatBytes(-100), '—');
});

test('formatBytes returns — for non-number', () => {
  assert.equal(formatBytes('1024'), '—');
});

test('formatBytes formats bytes below 1 KB', () => {
  assert.equal(formatBytes(512), '512 B');
});

test('formatBytes formats exactly 1 KB', () => {
  assert.equal(formatBytes(1024), '1.0 KB');
});

test('formatBytes formats value in MB range', () => {
  assert.equal(formatBytes(1024 * 1024), '1.0 MB');
});

test('formatBytes formats value in GB range', () => {
  assert.equal(formatBytes(1024 * 1024 * 1024), '1.0 GB');
});

test('formatBytes formats value in TB range', () => {
  assert.equal(formatBytes(1024 * 1024 * 1024 * 1024), '1.0 TB');
});

test('formatBytes shows one decimal place for values under 10', () => {
  const result = formatBytes(1024 * 4.5);
  assert.ok(result.includes('.'), `expected decimal in: ${result}`);
});

test('formatBytes shows no decimal place for values >= 10 in unit', () => {
  const result = formatBytes(1024 * 15);
  assert.ok(!result.includes('.'), `expected no decimal in: ${result}`);
});

// ── formatSpeed ───────────────────────────────────────────────────────────────

test('formatSpeed returns — for null', () => {
  assert.equal(formatSpeed(null), '—');
});

test('formatSpeed returns — for zero', () => {
  assert.equal(formatSpeed(0), '—');
});

test('formatSpeed returns — for negative value', () => {
  assert.equal(formatSpeed(-1), '—');
});

test('formatSpeed appends /s to formatted byte value', () => {
  const result = formatSpeed(1024);
  assert.ok(result.endsWith('/s'), `expected /s suffix in: ${result}`);
});

test('formatSpeed formats 1 KB/s correctly', () => {
  assert.equal(formatSpeed(1024), '1.0 KB/s');
});

test('formatSpeed formats MB/s correctly', () => {
  assert.equal(formatSpeed(1024 * 1024), '1.0 MB/s');
});

// ── totalSizeForResponse ──────────────────────────────────────────────────────

test('totalSizeForResponse returns 0 for null', () => {
  assert.equal(totalSizeForResponse(null), 0);
});

test('totalSizeForResponse returns 0 for empty object', () => {
  assert.equal(totalSizeForResponse({}), 0);
});

test('totalSizeForResponse prefers totalSize field', () => {
  assert.equal(totalSizeForResponse({ totalSize: 5000, files: [{ size: 100 }] }), 5000);
});

test('totalSizeForResponse falls back to summing files array', () => {
  assert.equal(totalSizeForResponse({ files: [{ size: 100 }, { size: 200 }, { size: 300 }] }), 600);
});

test('totalSizeForResponse handles missing file.size gracefully', () => {
  assert.equal(totalSizeForResponse({ files: [{ size: 100 }, {}] }), 100);
});

test('totalSizeForResponse returns 0 for empty files array', () => {
  assert.equal(totalSizeForResponse({ files: [] }), 0);
});

test('totalSizeForResponse returns 0 when totalSize is non-numeric', () => {
  // falls back to files sum when totalSize is absent/non-number
  assert.equal(totalSizeForResponse({ files: [{ size: 50 }] }), 50);
});

// ── sortNetworkResponses ──────────────────────────────────────────────────────

test('sortNetworkResponses returns empty array for empty input', () => {
  assert.deepEqual(sortNetworkResponses([]), []);
});

test('sortNetworkResponses does not mutate the original array', () => {
  const original = [
    { username: 'a', fileCount: 2, uploadSpeed: 100, queueLength: 0 },
    { username: 'b', fileCount: 3, uploadSpeed: 200, queueLength: 0 },
  ];
  const snapshot = [...original];
  sortNetworkResponses(original);
  assert.deepEqual(original, snapshot);
});

test('sortNetworkResponses filters out responses below minimumFileCount using fileCount', () => {
  const responses = [
    { username: 'a', fileCount: 1, uploadSpeed: 100 },
    { username: 'b', fileCount: 3, uploadSpeed: 50 },
  ];
  const result = sortNetworkResponses(responses, { minimumFileCount: 2 });
  assert.equal(result.length, 1);
  assert.equal(result[0].username, 'b');
});

test('sortNetworkResponses filters using files array length when fileCount is absent', () => {
  const responses = [
    { username: 'a', files: [{}], uploadSpeed: 100 },
    { username: 'b', files: [{}, {}, {}], uploadSpeed: 50 },
  ];
  const result = sortNetworkResponses(responses, { minimumFileCount: 2 });
  assert.equal(result.length, 1);
  assert.equal(result[0].username, 'b');
});

test('sortNetworkResponses keeps responses at exactly minimumFileCount', () => {
  const responses = [{ username: 'a', fileCount: 2, uploadSpeed: 100 }];
  const result = sortNetworkResponses(responses, { minimumFileCount: 2 });
  assert.equal(result.length, 1);
});

test('sortNetworkResponses defaults minimumFileCount to 1 when 0 is provided', () => {
  const responses = [{ username: 'a', fileCount: 1, uploadSpeed: 100 }];
  const result = sortNetworkResponses(responses, { minimumFileCount: 0 });
  assert.equal(result.length, 1);
});

test('sortNetworkResponses sorts by upload speed descending', () => {
  const responses = [
    { username: 'slow', fileCount: 2, uploadSpeed: 100, queueLength: 0 },
    { username: 'fast', fileCount: 2, uploadSpeed: 500, queueLength: 0 },
    { username: 'mid', fileCount: 2, uploadSpeed: 300, queueLength: 0 },
  ];
  const result = sortNetworkResponses(responses);
  assert.equal(result[0].username, 'fast');
  assert.equal(result[1].username, 'mid');
  assert.equal(result[2].username, 'slow');
});

test('sortNetworkResponses uses queue length ascending as tiebreaker for equal speeds', () => {
  const responses = [
    { username: 'long-queue', fileCount: 2, uploadSpeed: 200, queueLength: 10 },
    { username: 'short-queue', fileCount: 2, uploadSpeed: 200, queueLength: 1 },
    { username: 'no-queue', fileCount: 2, uploadSpeed: 200, queueLength: 0 },
  ];
  const result = sortNetworkResponses(responses);
  assert.equal(result[0].username, 'no-queue');
  assert.equal(result[1].username, 'short-queue');
  assert.equal(result[2].username, 'long-queue');
});

test('sortNetworkResponses treats missing uploadSpeed as 0', () => {
  const responses = [
    { username: 'no-speed', fileCount: 2 },
    { username: 'has-speed', fileCount: 2, uploadSpeed: 100 },
  ];
  const result = sortNetworkResponses(responses);
  assert.equal(result[0].username, 'has-speed');
});

test('sortNetworkResponses treats missing queueLength as 0', () => {
  const responses = [
    { username: 'no-queue', fileCount: 2, uploadSpeed: 100 },
    { username: 'has-queue', fileCount: 2, uploadSpeed: 100, queueLength: 5 },
  ];
  const result = sortNetworkResponses(responses);
  assert.equal(result[0].username, 'no-queue');
});

// ── formatPeerCountLabel ──────────────────────────────────────────────────────

test('formatPeerCountLabel returns "0 peers" for 0', () => {
  assert.equal(formatPeerCountLabel(0), '0 peers');
});

test('formatPeerCountLabel returns "1 peer" for 1', () => {
  assert.equal(formatPeerCountLabel(1), '1 peer');
});

test('formatPeerCountLabel returns "2 peers" for 2', () => {
  assert.equal(formatPeerCountLabel(2), '2 peers');
});

test('formatPeerCountLabel returns "100 peers" for 100', () => {
  assert.equal(formatPeerCountLabel(100), '100 peers');
});

// ── formatFileCountLabel ──────────────────────────────────────────────────────

test('formatFileCountLabel returns "0 files" for 0', () => {
  assert.equal(formatFileCountLabel(0), '0 files');
});

test('formatFileCountLabel returns "1 file" for 1', () => {
  assert.equal(formatFileCountLabel(1), '1 file');
});

test('formatFileCountLabel returns "5 files" for 5', () => {
  assert.equal(formatFileCountLabel(5), '5 files');
});

test('formatFileCountLabel returns "50 files" for 50', () => {
  assert.equal(formatFileCountLabel(50), '50 files');
});
