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
  fulfillmentLabel,
  fulfillmentTone,
  releaseYear,
  requestHeadline,
} from '../../src/client/lib/operator-dashboard-presentation.js';

// ── releaseYear ───────────────────────────────────────────────────────────────

test('releaseYear: returns null for null', () => {
  assert.equal(releaseYear(null), null);
});

test('releaseYear: returns null for undefined', () => {
  assert.equal(releaseYear(undefined), null);
});

test('releaseYear: returns null for empty string', () => {
  assert.equal(releaseYear(''), null);
});

test('releaseYear: extracts year from YYYY-MM-DD', () => {
  assert.equal(releaseYear('2023-04-15'), '2023');
});

test('releaseYear: extracts year from YYYY-MM', () => {
  assert.equal(releaseYear('1994-10'), '1994');
});

test('releaseYear: returns YYYY unchanged', () => {
  assert.equal(releaseYear('2001'), '2001');
});

test('releaseYear: only returns first 4 characters', () => {
  assert.equal(releaseYear('20231210T000000Z'), '2023');
});

// ── requestHeadline ───────────────────────────────────────────────────────────

test('requestHeadline: formats release request as "Artist — Release"', () => {
  const req = { requestKind: 'release', artistName: 'Radiohead', releaseTitle: 'OK Computer' };
  assert.equal(requestHeadline(req), 'Radiohead \u2014 OK Computer');
});

test('requestHeadline: formats album request as "Artist — Release"', () => {
  const req = { requestKind: 'album', artistName: 'Daft Punk', releaseTitle: 'Discovery' };
  assert.equal(requestHeadline(req), 'Daft Punk \u2014 Discovery');
});

test('requestHeadline: formats track request as "Artist — Track"', () => {
  const req = { requestKind: 'track', artistName: 'The Beatles', trackTitle: 'Let It Be' };
  assert.equal(requestHeadline(req), 'The Beatles \u2014 Let It Be');
});

test('requestHeadline: track request ignores releaseTitle', () => {
  const req = {
    requestKind: 'track',
    artistName: 'Prince',
    trackTitle: 'Purple Rain',
    releaseTitle: 'Purple Rain (album)',
  };
  assert.equal(requestHeadline(req), 'Prince \u2014 Purple Rain');
});

test('requestHeadline: external_url request returns sourceUrl', () => {
  const req = { requestKind: 'external_url', sourceUrl: 'https://example.com/release' };
  assert.equal(requestHeadline(req), 'https://example.com/release');
});

test('requestHeadline: external_url request returns empty string when sourceUrl absent', () => {
  const req = { requestKind: 'external_url' };
  assert.equal(requestHeadline(req), '');
});

test('requestHeadline: handles missing artistName gracefully', () => {
  const req = { requestKind: 'release', releaseTitle: 'Unknown Artist Album' };
  assert.equal(requestHeadline(req), ' \u2014 Unknown Artist Album');
});

test('requestHeadline: handles missing releaseTitle gracefully', () => {
  const req = { requestKind: 'release', artistName: 'Someone' };
  assert.equal(requestHeadline(req), 'Someone \u2014 ');
});

test('requestHeadline: handles missing trackTitle gracefully', () => {
  const req = { requestKind: 'track', artistName: 'Blur' };
  assert.equal(requestHeadline(req), 'Blur \u2014 ');
});

test('requestHeadline: unknown requestKind falls through to release format', () => {
  const req = { requestKind: 'custom', artistName: 'Artist', releaseTitle: 'Title' };
  assert.equal(requestHeadline(req), 'Artist \u2014 Title');
});

// ── fulfillmentTone ───────────────────────────────────────────────────────────

test('fulfillmentTone: tone "selected" maps to "success"', () => {
  assert.equal(fulfillmentTone({ tone: 'selected' }), 'success');
});

test('fulfillmentTone: tone "failed" maps to "danger"', () => {
  assert.equal(fulfillmentTone({ tone: 'failed' }), 'danger');
});

test('fulfillmentTone: unknown tone maps to "info"', () => {
  assert.equal(fulfillmentTone({ tone: 'pending' }), 'info');
});

test('fulfillmentTone: null fulfillmentStatus maps to "info"', () => {
  assert.equal(fulfillmentTone(null), 'info');
});

test('fulfillmentTone: undefined fulfillmentStatus maps to "info"', () => {
  assert.equal(fulfillmentTone(undefined), 'info');
});

test('fulfillmentTone: empty object (no tone field) maps to "info"', () => {
  assert.equal(fulfillmentTone({}), 'info');
});

// ── fulfillmentLabel ──────────────────────────────────────────────────────────

test('fulfillmentLabel: returns the label from the status object', () => {
  assert.equal(fulfillmentLabel({ label: 'Downloading' }), 'Downloading');
});

test('fulfillmentLabel: returns "Queued" when label is absent', () => {
  assert.equal(fulfillmentLabel({}), 'Queued');
});

test('fulfillmentLabel: returns "Queued" for null', () => {
  assert.equal(fulfillmentLabel(null), 'Queued');
});

test('fulfillmentLabel: returns "Queued" for undefined', () => {
  assert.equal(fulfillmentLabel(undefined), 'Queued');
});

test('fulfillmentLabel: returns the exact label string provided', () => {
  assert.equal(fulfillmentLabel({ label: 'Pending import' }), 'Pending import');
});

test('fulfillmentLabel: treats empty string label as empty string (not fallback)', () => {
  // An explicit empty string from the server should be returned as-is.
  assert.equal(fulfillmentLabel({ label: '' }), '');
});
