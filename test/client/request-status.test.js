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
  getRequestStatusLabel,
  getRequestStatusVariant,
  normalizeRequestStatus,
} from '../../src/client/lib/request-status.js';

// ---------------------------------------------------------------------------
// normalizeRequestStatus
// ---------------------------------------------------------------------------

test('request-status normalizeRequestStatus lowercases and trims', () => {
  assert.equal(normalizeRequestStatus('  NEEDS_FETCH  '), 'needs_fetch');
  assert.equal(normalizeRequestStatus('Needs_Review'), 'needs_review');
  assert.equal(normalizeRequestStatus('ALREADY_EXISTS'), 'already_exists');
});

test('request-status normalizeRequestStatus returns empty string for non-string', () => {
  assert.equal(normalizeRequestStatus(null), '');
  assert.equal(normalizeRequestStatus(undefined), '');
  assert.equal(normalizeRequestStatus(42), '');
});

// ---------------------------------------------------------------------------
// getRequestStatusLabel — known backend statuses
// ---------------------------------------------------------------------------

test('request-status getRequestStatusLabel maps needs_fetch to Searching', () => {
  assert.equal(getRequestStatusLabel('needs_fetch'), 'Searching');
});

test('request-status getRequestStatusLabel maps needs_review to Under Review', () => {
  assert.equal(getRequestStatusLabel('needs_review'), 'Under Review');
});

test('request-status getRequestStatusLabel maps already_exists to In Library', () => {
  assert.equal(getRequestStatusLabel('already_exists'), 'In Library');
});

// ---------------------------------------------------------------------------
// getRequestStatusLabel — tolerant future/legacy values
// ---------------------------------------------------------------------------

test('request-status getRequestStatusLabel maps pending to Pending', () => {
  assert.equal(getRequestStatusLabel('pending'), 'Pending');
});

test('request-status getRequestStatusLabel maps fulfilled to Fulfilled', () => {
  assert.equal(getRequestStatusLabel('fulfilled'), 'Fulfilled');
});

test('request-status getRequestStatusLabel maps completed to Fulfilled', () => {
  assert.equal(getRequestStatusLabel('completed'), 'Fulfilled');
});

test('request-status getRequestStatusLabel maps failed to Failed', () => {
  assert.equal(getRequestStatusLabel('failed'), 'Failed');
});

test('request-status getRequestStatusLabel maps cancelled to Cancelled', () => {
  assert.equal(getRequestStatusLabel('cancelled'), 'Cancelled');
});

// ---------------------------------------------------------------------------
// getRequestStatusLabel — unknown / missing statuses
// ---------------------------------------------------------------------------

test('request-status getRequestStatusLabel returns Unknown for unrecognised status', () => {
  assert.equal(getRequestStatusLabel('mystery_status'), 'Unknown');
});

test('request-status getRequestStatusLabel returns Unknown for null', () => {
  assert.equal(getRequestStatusLabel(null), 'Unknown');
});

test('request-status getRequestStatusLabel returns Unknown for undefined', () => {
  assert.equal(getRequestStatusLabel(undefined), 'Unknown');
});

test('request-status getRequestStatusLabel returns Unknown for empty string', () => {
  assert.equal(getRequestStatusLabel(''), 'Unknown');
});

test('request-status getRequestStatusLabel handles mixed-case input', () => {
  assert.equal(getRequestStatusLabel('NEEDS_FETCH'), 'Searching');
  assert.equal(getRequestStatusLabel('Already_Exists'), 'In Library');
});

// ---------------------------------------------------------------------------
// getRequestStatusVariant — known backend statuses
// ---------------------------------------------------------------------------

test('request-status getRequestStatusVariant maps needs_fetch to info', () => {
  assert.equal(getRequestStatusVariant('needs_fetch'), 'info');
});

test('request-status getRequestStatusVariant maps needs_review to warning', () => {
  assert.equal(getRequestStatusVariant('needs_review'), 'warning');
});

test('request-status getRequestStatusVariant maps already_exists to success', () => {
  assert.equal(getRequestStatusVariant('already_exists'), 'success');
});

test('request-status getRequestStatusVariant maps failed to danger', () => {
  assert.equal(getRequestStatusVariant('failed'), 'danger');
});

test('request-status getRequestStatusVariant maps cancelled to muted', () => {
  assert.equal(getRequestStatusVariant('cancelled'), 'muted');
});

// ---------------------------------------------------------------------------
// getRequestStatusVariant — unknown / missing
// ---------------------------------------------------------------------------

test('request-status getRequestStatusVariant returns muted for unknown status', () => {
  assert.equal(getRequestStatusVariant('unknown_value'), 'muted');
});

test('request-status getRequestStatusVariant returns muted for null', () => {
  assert.equal(getRequestStatusVariant(null), 'muted');
});

test('request-status getRequestStatusVariant returns muted for undefined', () => {
  assert.equal(getRequestStatusVariant(undefined), 'muted');
});
