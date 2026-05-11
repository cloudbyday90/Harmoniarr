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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSessionTimestamp,
  formatUserAgent,
  getActivityEventStatusLabel,
  getActivityEventTone,
  isSecurityRelevantEvent,
  isServiceSession,
} from '../../src/client/lib/account-security-presentation.js';

// ---------------------------------------------------------------------------
// isSecurityRelevantEvent
// ---------------------------------------------------------------------------

describe('isSecurityRelevantEvent', () => {
  it('returns true for login_ prefix', () => {
    assert.equal(isSecurityRelevantEvent({ eventType: 'login_succeeded' }), true);
  });

  it('returns true for password_ prefix', () => {
    assert.equal(isSecurityRelevantEvent({ eventType: 'password_changed' }), true);
  });

  it('returns true for session_ prefix', () => {
    assert.equal(isSecurityRelevantEvent({ eventType: 'session_revoked' }), true);
  });

  it('returns true for bootstrap_ prefix', () => {
    assert.equal(isSecurityRelevantEvent({ eventType: 'bootstrap_admin_created' }), true);
  });

  it('returns true for user_ prefix', () => {
    assert.equal(isSecurityRelevantEvent({ eventType: 'user_created' }), true);
  });

  it('returns false for metadata_ prefix', () => {
    assert.equal(isSecurityRelevantEvent({ eventType: 'metadata_musicbrainz_artist_imported' }), false);
  });

  it('returns false for library_ prefix', () => {
    assert.equal(isSecurityRelevantEvent({ eventType: 'library_discovery_completed' }), false);
  });

  it('returns false for import_ prefix', () => {
    assert.equal(isSecurityRelevantEvent({ eventType: 'import_applied' }), false);
  });

  it('returns false for null event', () => {
    assert.equal(isSecurityRelevantEvent(null), false);
  });

  it('returns false for undefined event', () => {
    assert.equal(isSecurityRelevantEvent(undefined), false);
  });

  it('returns false when eventType is missing', () => {
    assert.equal(isSecurityRelevantEvent({}), false);
  });

  it('returns false when eventType is null', () => {
    assert.equal(isSecurityRelevantEvent({ eventType: null }), false);
  });

  it('returns false when eventType is empty string', () => {
    assert.equal(isSecurityRelevantEvent({ eventType: '' }), false);
  });
});

// ---------------------------------------------------------------------------
// getActivityEventTone
// ---------------------------------------------------------------------------

describe('getActivityEventTone', () => {
  it('returns danger for _failed suffix', () => {
    assert.equal(getActivityEventTone('login_failed'), 'danger');
  });

  it('returns danger for _blocked suffix', () => {
    assert.equal(getActivityEventTone('login_blocked'), 'danger');
  });

  it('returns danger for _denied suffix', () => {
    assert.equal(getActivityEventTone('access_denied'), 'danger');
  });

  it('returns success for _succeeded suffix', () => {
    assert.equal(getActivityEventTone('login_succeeded'), 'success');
  });

  it('returns success for _created suffix', () => {
    assert.equal(getActivityEventTone('bootstrap_admin_created'), 'success');
  });

  it('returns success for _revoked suffix', () => {
    assert.equal(getActivityEventTone('session_revoked'), 'success');
  });

  it('returns success for _changed suffix', () => {
    assert.equal(getActivityEventTone('password_changed'), 'success');
  });

  it('returns info for unrecognised suffix', () => {
    assert.equal(getActivityEventTone('user_logout'), 'info');
  });

  it('returns info for null', () => {
    assert.equal(getActivityEventTone(null), 'info');
  });

  it('returns info for undefined', () => {
    assert.equal(getActivityEventTone(undefined), 'info');
  });

  it('returns info for empty string', () => {
    assert.equal(getActivityEventTone(''), 'info');
  });
});

// ---------------------------------------------------------------------------
// getActivityEventStatusLabel
// ---------------------------------------------------------------------------

describe('getActivityEventStatusLabel', () => {
  it('returns Failed for _failed suffix', () => {
    assert.equal(getActivityEventStatusLabel('login_failed'), 'Failed');
  });

  it('returns Blocked for _blocked suffix', () => {
    assert.equal(getActivityEventStatusLabel('login_blocked'), 'Blocked');
  });

  it('returns Denied for _denied suffix', () => {
    assert.equal(getActivityEventStatusLabel('access_denied'), 'Denied');
  });

  it('returns Succeeded for _succeeded suffix', () => {
    assert.equal(getActivityEventStatusLabel('login_succeeded'), 'Succeeded');
  });

  it('returns Created for _created suffix', () => {
    assert.equal(getActivityEventStatusLabel('bootstrap_admin_created'), 'Created');
  });

  it('returns Revoked for _revoked suffix', () => {
    assert.equal(getActivityEventStatusLabel('session_revoked'), 'Revoked');
  });

  it('returns Changed for _changed suffix', () => {
    assert.equal(getActivityEventStatusLabel('password_changed'), 'Changed');
  });

  it('returns Event for unrecognised suffix', () => {
    assert.equal(getActivityEventStatusLabel('user_logout'), 'Event');
  });

  it('returns Event for null', () => {
    assert.equal(getActivityEventStatusLabel(null), 'Event');
  });

  it('returns Event for undefined', () => {
    assert.equal(getActivityEventStatusLabel(undefined), 'Event');
  });

  it('returns Event for empty string', () => {
    assert.equal(getActivityEventStatusLabel(''), 'Event');
  });
});

// ---------------------------------------------------------------------------
// formatSessionTimestamp
// ---------------------------------------------------------------------------

describe('formatSessionTimestamp', () => {
  it('returns default fallback for null', () => {
    assert.equal(formatSessionTimestamp(null), 'Not recorded');
  });

  it('returns default fallback for undefined', () => {
    assert.equal(formatSessionTimestamp(undefined), 'Not recorded');
  });

  it('returns default fallback for empty string', () => {
    assert.equal(formatSessionTimestamp(''), 'Not recorded');
  });

  it('returns default fallback for invalid date string', () => {
    assert.equal(formatSessionTimestamp('not-a-date'), 'Not recorded');
  });

  it('returns custom fallback when provided and value is null', () => {
    assert.equal(formatSessionTimestamp(null, 'Never'), 'Never');
  });

  it('returns a non-fallback string for a valid ISO timestamp', () => {
    const result = formatSessionTimestamp('2026-05-11T15:13:48.117Z');
    assert.notEqual(result, 'Not recorded');
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  it('returns different output for different valid timestamps', () => {
    const a = formatSessionTimestamp('2026-01-01T00:00:00.000Z');
    const b = formatSessionTimestamp('2026-06-15T12:30:00.000Z');
    // Both are valid formatted strings but for different times
    assert.notEqual(a, 'Not recorded');
    assert.notEqual(b, 'Not recorded');
  });
});

// ---------------------------------------------------------------------------
// isServiceSession
// ---------------------------------------------------------------------------

describe('isServiceSession', () => {
  it('returns false for a browser user-agent starting with Mozilla/', () => {
    const session = {
      issuedUserAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0',
    };
    assert.equal(isServiceSession(session), false);
  });

  it('returns true for a non-browser service identifier', () => {
    assert.equal(isServiceSession({ issuedUserAgent: 'harmoniarr-docker-walkthrough-bootstrap/1.0' }), true);
  });

  it('returns true for node/ user agent', () => {
    assert.equal(isServiceSession({ issuedUserAgent: 'node/21.0.0' }), true);
  });

  it('returns false for a null user-agent', () => {
    assert.equal(isServiceSession({ issuedUserAgent: null }), false);
  });

  it('returns false for a missing user-agent property', () => {
    assert.equal(isServiceSession({}), false);
  });

  it('returns false for a null session', () => {
    assert.equal(isServiceSession(null), false);
  });

  it('returns false for undefined', () => {
    assert.equal(isServiceSession(undefined), false);
  });
});

// ---------------------------------------------------------------------------
// formatUserAgent
// ---------------------------------------------------------------------------

describe('formatUserAgent', () => {
  it('returns "Unknown client" for null', () => {
    assert.equal(formatUserAgent(null), 'Unknown client');
  });

  it('returns "Unknown client" for undefined', () => {
    assert.equal(formatUserAgent(undefined), 'Unknown client');
  });

  it('returns "Unknown client" for empty string', () => {
    assert.equal(formatUserAgent(''), 'Unknown client');
  });

  it('returns service name as-is when shorter than 60 chars', () => {
    assert.equal(formatUserAgent('harmoniarr-docker-walkthrough-bootstrap/1.0'), 'harmoniarr-docker-walkthrough-bootstrap/1.0');
  });

  it('truncates a long non-browser identifier at 60 chars with ellipsis', () => {
    const longName = 'a'.repeat(65);
    const result = formatUserAgent(longName);
    assert.equal(result, `${'a'.repeat(57)}\u2026`);
  });

  it('formats a VS Code / Electron user-agent', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.90.0 Chrome/124.0.0.0 Electron/30.0.0 Safari/537.36';
    const result = formatUserAgent(ua);
    assert.match(result, /VS Code/);
    assert.match(result, /Electron/);
  });

  it('formats a plain Electron (non-VS Code) user-agent', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Electron/28.0.0 Safari/537.36';
    const result = formatUserAgent(ua);
    assert.match(result, /Electron app/);
    assert.match(result, /28\.0\.0/);
  });

  it('formats a Microsoft Edge user-agent', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0';
    const result = formatUserAgent(ua);
    assert.match(result, /Microsoft Edge/);
    assert.match(result, /125/);
  });

  it('formats a Chrome user-agent', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
    const result = formatUserAgent(ua);
    assert.match(result, /^Chrome /);
    assert.match(result, /125/);
  });

  it('formats a Firefox user-agent', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0';
    const result = formatUserAgent(ua);
    assert.match(result, /^Firefox /);
    assert.match(result, /126/);
  });

  it('formats a Safari user-agent', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
    const result = formatUserAgent(ua);
    assert.match(result, /^Safari /);
    assert.match(result, /17\.4/);
  });

  it('truncates an unknown long browser UA', () => {
    const longBrowserUA = 'Mozilla/5.0 ' + 'x'.repeat(60);
    const result = formatUserAgent(longBrowserUA);
    assert.equal(result, longBrowserUA.slice(0, 57) + '\u2026');
  });

  it('does not truncate an unknown browser UA under 60 chars', () => {
    const shortBrowserUA = 'Mozilla/5.0 (Unknown Browser)';
    assert.equal(formatUserAgent(shortBrowserUA), shortBrowserUA);
  });

  it('prefers Edge over Chrome when both tokens are present in UA', () => {
    // Real Edge UA contains both Chrome and Edg tokens
    const edgeUA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36 Edg/125.0.2535.79';
    const result = formatUserAgent(edgeUA);
    assert.match(result, /Microsoft Edge/);
    assert.doesNotMatch(result, /^Chrome/);
  });

  it('prefers Electron over Chrome when both tokens are present in UA', () => {
    // Real VS Code UA contains both Chrome and Electron tokens
    const vscodeUA =
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/124.0 Electron/30.0.2 Safari/537.36';
    const result = formatUserAgent(vscodeUA);
    assert.match(result, /Electron/);
    assert.doesNotMatch(result, /^Chrome/);
  });
});
