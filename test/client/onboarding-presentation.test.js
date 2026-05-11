/*
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMetaLabel,
  formatMetaValue,
  getStepStatusClass,
  getStepStatusLabel,
} from '../../src/client/lib/onboarding-presentation.js';

// ── formatMetaLabel ───────────────────────────────────────────────────────────

describe('formatMetaLabel', () => {
  it('capitalises the first character', () => {
    assert.equal(formatMetaLabel('name'), 'Name');
  });

  it('inserts a space before each uppercase letter following a lowercase letter', () => {
    assert.equal(formatMetaLabel('checkedAt'), 'Checked At');
  });

  it('handles multiple camelCase transitions', () => {
    assert.equal(formatMetaLabel('lastCheckedAt'), 'Last Checked At');
  });

  it('handles PascalCase input', () => {
    assert.equal(formatMetaLabel('ConfigPath'), 'Config Path');
  });

  it('returns a single word unchanged except for capitalisation', () => {
    assert.equal(formatMetaLabel('status'), 'Status');
  });

  it('returns an empty string for an empty input', () => {
    assert.equal(formatMetaLabel(''), '');
  });

  it('returns an empty string for a falsy input', () => {
    assert.equal(formatMetaLabel(null), '');
    assert.equal(formatMetaLabel(undefined), '');
  });
});

// ── formatMetaValue ───────────────────────────────────────────────────────────

describe('formatMetaValue', () => {
  it('returns "Yes" for true', () => {
    assert.equal(formatMetaValue(true), 'Yes');
  });

  it('returns "No" for false', () => {
    assert.equal(formatMetaValue(false), 'No');
  });

  it('returns "Unavailable" for null', () => {
    assert.equal(formatMetaValue(null), 'Unavailable');
  });

  it('returns "Unavailable" for undefined', () => {
    assert.equal(formatMetaValue(undefined), 'Unavailable');
  });

  it('returns "Unavailable" for an empty string', () => {
    assert.equal(formatMetaValue(''), 'Unavailable');
  });

  it('returns a non-empty string as-is', () => {
    assert.equal(formatMetaValue('some text'), 'some text');
  });

  it('converts a number to string', () => {
    assert.equal(formatMetaValue(42), '42');
  });

  it('formats a valid ISO 8601 datetime string as a locale string', () => {
    const iso = '2026-05-11T15:41:42.139Z';
    const result = formatMetaValue(iso);
    // Must not be the raw ISO string
    assert.notEqual(result, iso);
    // Must be a non-empty string
    assert.ok(result.length > 0);
  });

  it('formats a Z-offset ISO datetime differently from the raw string', () => {
    const iso = '2026-01-01T00:00:00.000Z';
    const result = formatMetaValue(iso);
    assert.notEqual(result, iso);
  });

  it('formats a +offset ISO datetime as a locale string', () => {
    const iso = '2026-05-11T10:30:00+05:00';
    const result = formatMetaValue(iso);
    assert.notEqual(result, iso);
    assert.ok(result.length > 0);
  });

  it('two distinct ISO timestamps produce different formatted strings', () => {
    const a = formatMetaValue('2026-01-01T00:00:00.000Z');
    const b = formatMetaValue('2026-06-15T12:30:00.000Z');
    assert.notEqual(a, b);
  });

  it('does not treat a plain date string (no T) as an ISO datetime', () => {
    // "2026-05-11" lacks the T and time portion — treated as plain string
    const result = formatMetaValue('2026-05-11');
    assert.equal(result, '2026-05-11');
  });

  it('does not format a string that only starts with a year', () => {
    assert.equal(formatMetaValue('2026'), '2026');
  });
});

// ── getStepStatusLabel ────────────────────────────────────────────────────────

describe('getStepStatusLabel', () => {
  it('returns "Complete" for "complete"', () => {
    assert.equal(getStepStatusLabel('complete'), 'Complete');
  });

  it('returns "Info" for "info"', () => {
    assert.equal(getStepStatusLabel('info'), 'Info');
  });

  it('returns "Needs attention" for an unrecognised status', () => {
    assert.equal(getStepStatusLabel('unknown'), 'Needs attention');
  });

  it('returns "Needs attention" for undefined', () => {
    assert.equal(getStepStatusLabel(undefined), 'Needs attention');
  });

  it('returns "Needs attention" for null', () => {
    assert.equal(getStepStatusLabel(null), 'Needs attention');
  });

  it('returns "Needs attention" for an empty string', () => {
    assert.equal(getStepStatusLabel(''), 'Needs attention');
  });
});

// ── getStepStatusClass ────────────────────────────────────────────────────────

describe('getStepStatusClass', () => {
  it('returns "review-status-selected" for "complete"', () => {
    assert.equal(getStepStatusClass('complete'), 'review-status-selected');
  });

  it('returns "review-status-pending" for "info"', () => {
    assert.equal(getStepStatusClass('info'), 'review-status-pending');
  });

  it('returns "review-status-held" for an unrecognised status', () => {
    assert.equal(getStepStatusClass('error'), 'review-status-held');
  });

  it('returns "review-status-held" for undefined', () => {
    assert.equal(getStepStatusClass(undefined), 'review-status-held');
  });

  it('returns "review-status-held" for null', () => {
    assert.equal(getStepStatusClass(null), 'review-status-held');
  });
});
