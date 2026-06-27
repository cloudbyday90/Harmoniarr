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
  formatDependencyDetailKey,
  formatDependencyProvider,
  formatDependencyStatus,
} from '../../src/client/lib/dependency-status-presentation.js';

describe('formatDependencyProvider', () => {
  it('returns MusicBrainz for musicbrainz', () => {
    assert.equal(formatDependencyProvider('musicbrainz'), 'MusicBrainz');
  });

  it('returns slskd unchanged for slskd', () => {
    assert.equal(formatDependencyProvider('slskd'), 'slskd');
  });

  it('passes through unknown provider values unchanged', () => {
    assert.equal(formatDependencyProvider('some-other-service'), 'some-other-service');
  });

  it('passes through empty string', () => {
    assert.equal(formatDependencyProvider(''), '');
  });
});

describe('formatDependencyStatus', () => {
  it('returns Degraded for degraded', () => {
    assert.equal(formatDependencyStatus('degraded'), 'Degraded');
  });

  it('returns Disabled for disabled', () => {
    assert.equal(formatDependencyStatus('disabled'), 'Disabled');
  });

  it('returns Healthy for healthy', () => {
    assert.equal(formatDependencyStatus('healthy'), 'Healthy');
  });

  it('returns Misconfigured for misconfigured', () => {
    assert.equal(formatDependencyStatus('misconfigured'), 'Misconfigured');
  });

  it('returns Unavailable for unavailable', () => {
    assert.equal(formatDependencyStatus('unavailable'), 'Unavailable');
  });

  it('passes through unknown status values unchanged', () => {
    assert.equal(formatDependencyStatus('unknown-state'), 'unknown-state');
  });

  it('passes through null as-is', () => {
    assert.equal(formatDependencyStatus(null), null);
  });
});

describe('formatDependencyDetailKey', () => {
  it('converts camelCase to spaced title case', () => {
    assert.equal(formatDependencyDetailKey('responseTime'), 'Response Time');
  });

  it('converts a multi-word camelCase key', () => {
    assert.equal(formatDependencyDetailKey('responseTimeMs'), 'Response Time Ms');
  });

  it('capitalizes the first letter of a single word', () => {
    assert.equal(formatDependencyDetailKey('version'), 'Version');
  });

  it('handles a key that is already a single uppercase word', () => {
    assert.equal(formatDependencyDetailKey('URL'), 'URL');
  });

  it('handles consecutive uppercase letters without splitting', () => {
    assert.equal(formatDependencyDetailKey('apiVersion'), 'Api Version');
  });

  it('handles an empty string without throwing', () => {
    assert.equal(formatDependencyDetailKey(''), '');
  });
});
