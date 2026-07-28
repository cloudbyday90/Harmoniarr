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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSoulseekConnectionHealthSummary,
  buildSlskdConnectionSubtitle,
  formatDependencyProviderLabel,
  formatDependencyStatusLabel,
  formatOAuthStatusLabel,
  formatProviderSecretStatusLabel,
  formatSlskdApiKeyStatusLabel,
  formatSlskdProviderModeLabel,
  getDependencyStatusClass,
  getSupportingProviderHealth,
} from '../../src/client/lib/settings-connections-presentation.js';

// ── buildSlskdConnectionSubtitle ──────────────────────────────────────────────

describe('buildSlskdConnectionSubtitle', () => {
  it('returns a non-empty string', () => {
    assert.ok(buildSlskdConnectionSubtitle().length > 0);
  });

  it('does not mention slskd', () => {
    assert.ok(!buildSlskdConnectionSubtitle().toLowerCase().includes('slskd'));
  });

  it('does not mention daemon', () => {
    assert.ok(!buildSlskdConnectionSubtitle().toLowerCase().includes('daemon'));
  });

  it('is stable across calls', () => {
    assert.equal(buildSlskdConnectionSubtitle(), buildSlskdConnectionSubtitle());
  });
});

// ── formatSlskdApiKeyStatusLabel ──────────────────────────────────────────────

describe('formatSlskdApiKeyStatusLabel', () => {
  it('returns "No API key configured" for null', () => {
    assert.equal(formatSlskdApiKeyStatusLabel(null), 'No API key configured');
  });

  it('returns "No API key configured" for undefined', () => {
    assert.equal(formatSlskdApiKeyStatusLabel(undefined), 'No API key configured');
  });

  it('returns "No API key configured" when apiKeyConfigured is false', () => {
    assert.equal(formatSlskdApiKeyStatusLabel({ apiKeyConfigured: false }), 'No API key configured');
  });

  it('returns "No API key configured" when apiKeyConfigured is absent', () => {
    assert.equal(formatSlskdApiKeyStatusLabel({}), 'No API key configured');
  });

  it('returns "Stored in Harmoniarr" when stored', () => {
    assert.equal(
      formatSlskdApiKeyStatusLabel({ apiKeyConfigured: true, apiKeySource: 'stored' }),
      'Stored in Harmoniarr',
    );
  });

  it('returns "Environment-provided key" when source is environment', () => {
    assert.equal(
      formatSlskdApiKeyStatusLabel({ apiKeyConfigured: true, apiKeySource: 'environment' }),
      'Environment-provided key',
    );
  });

  it('returns "Managed deployment key" when the managed Compose secret is active', () => {
    assert.equal(
      formatSlskdApiKeyStatusLabel({ apiKeyConfigured: true, apiKeySource: 'managed_file' }),
      'Managed deployment key',
    );
  });

  it('returns "Environment-provided key" for any non-stored source', () => {
    assert.equal(
      formatSlskdApiKeyStatusLabel({ apiKeyConfigured: true, apiKeySource: 'vault' }),
      'Environment-provided key',
    );
  });

  it('does not expose "slskd" in any output', () => {
    const labels = [
      formatSlskdApiKeyStatusLabel(null),
      formatSlskdApiKeyStatusLabel({ apiKeyConfigured: true, apiKeySource: 'stored' }),
      formatSlskdApiKeyStatusLabel({ apiKeyConfigured: true, apiKeySource: 'environment' }),
    ];
    for (const label of labels) {
      assert.ok(!label.toLowerCase().includes('slskd'), `slskd exposed in: ${label}`);
    }
  });
});

describe('formatSlskdProviderModeLabel', () => {
  it('labels each supported provider mode for a home user', () => {
    assert.equal(formatSlskdProviderModeLabel({ providerMode: 'managed' }), 'Managed');
    assert.equal(formatSlskdProviderModeLabel({ providerMode: 'external' }), 'External');
    assert.equal(formatSlskdProviderModeLabel({ providerMode: 'disabled' }), 'Downloads off');
  });

  it('uses External when no saved mode is available', () => {
    assert.equal(formatSlskdProviderModeLabel(null), 'External');
  });
});

// ── formatProviderSecretStatusLabel ──────────────────────────────────────────

describe('formatProviderSecretStatusLabel', () => {
  it('returns "No secret configured" for null provider status', () => {
    assert.equal(
      formatProviderSecretStatusLabel(null, 'clientSecretConfigured', 'clientSecretSource'),
      'No secret configured',
    );
  });

  it('returns "No secret configured" for undefined provider status', () => {
    assert.equal(
      formatProviderSecretStatusLabel(undefined, 'clientSecretConfigured', 'clientSecretSource'),
      'No secret configured',
    );
  });

  it('returns "No secret configured" when secretKey is falsy', () => {
    assert.equal(
      formatProviderSecretStatusLabel(
        { clientSecretConfigured: false },
        'clientSecretConfigured',
        'clientSecretSource',
      ),
      'No secret configured',
    );
  });

  it('returns "Stored in Harmoniarr" when stored via clientSecretSource', () => {
    assert.equal(
      formatProviderSecretStatusLabel(
        { clientSecretConfigured: true, clientSecretSource: 'stored' },
        'clientSecretConfigured',
        'clientSecretSource',
      ),
      'Stored in Harmoniarr',
    );
  });

  it('returns "Environment-provided secret" when source is environment', () => {
    assert.equal(
      formatProviderSecretStatusLabel(
        { clientSecretConfigured: true, clientSecretSource: 'environment' },
        'clientSecretConfigured',
        'clientSecretSource',
      ),
      'Environment-provided secret',
    );
  });

  it('works with apiKey secretKey/sourceKey names (YouTube pattern)', () => {
    assert.equal(
      formatProviderSecretStatusLabel(
        { apiKeyConfigured: true, apiKeySource: 'stored' },
        'apiKeyConfigured',
        'apiKeySource',
      ),
      'Stored in Harmoniarr',
    );
  });

  it('works with privateKey secretKey/sourceKey names (Apple Music pattern)', () => {
    assert.equal(
      formatProviderSecretStatusLabel(
        { privateKeyConfigured: true, privateKeySource: 'environment' },
        'privateKeyConfigured',
        'privateKeySource',
      ),
      'Environment-provided secret',
    );
  });

  it('returns "No secret configured" when secretKey property is absent', () => {
    assert.equal(
      formatProviderSecretStatusLabel(
        { clientSecretSource: 'stored' },
        'clientSecretConfigured',
        'clientSecretSource',
      ),
      'No secret configured',
    );
  });
});

// ── formatOAuthStatusLabel ────────────────────────────────────────────────────

describe('formatOAuthStatusLabel', () => {
  it('returns "Not linked" for null', () => {
    assert.equal(formatOAuthStatusLabel(null), 'Not linked');
  });

  it('returns "Not linked" for undefined', () => {
    assert.equal(formatOAuthStatusLabel(undefined), 'Not linked');
  });

  it('returns "Not linked" when linked is false', () => {
    assert.equal(formatOAuthStatusLabel({ linked: false }), 'Not linked');
  });

  it('returns "Not linked" when linked is absent', () => {
    assert.equal(formatOAuthStatusLabel({}), 'Not linked');
  });

  it('returns "Linked" when linked with no expiry', () => {
    assert.equal(formatOAuthStatusLabel({ linked: true }), 'Linked');
  });

  it('returns "Linked" when linked with null tokenExpiresAt', () => {
    assert.equal(formatOAuthStatusLabel({ linked: true, tokenExpiresAt: null }), 'Linked');
  });

  it('starts with "Linked until" when tokenExpiresAt is present', () => {
    const result = formatOAuthStatusLabel({
      linked: true,
      tokenExpiresAt: '2026-06-01T12:00:00Z',
    });
    assert.ok(result.startsWith('Linked until '), `expected "Linked until ..." but got: ${result}`);
  });

  it('does not return bare token date string — formats it for display', () => {
    const iso = '2026-06-01T12:00:00Z';
    const result = formatOAuthStatusLabel({ linked: true, tokenExpiresAt: iso });
    assert.notEqual(result, iso);
    assert.ok(result.includes('2026'), `expected year 2026 in: ${result}`);
  });
});

// ── formatDependencyProviderLabel ──────────────────────────────────────────

describe('formatDependencyProviderLabel', () => {
  it('returns "Soulseek (slskd)" for slskd', () => {
    assert.equal(formatDependencyProviderLabel('slskd'), 'Soulseek (slskd)');
  });

  it('returns "MusicBrainz" for musicbrainz', () => {
    assert.equal(formatDependencyProviderLabel('musicbrainz'), 'MusicBrainz');
  });

  it('returns "Media tooling" for media_tooling', () => {
    assert.equal(formatDependencyProviderLabel('media_tooling'), 'Media tooling');
  });

  it('returns raw provider for unknown providers', () => {
    assert.equal(formatDependencyProviderLabel('some_new_provider'), 'some_new_provider');
  });
});

// ── formatDependencyStatusLabel ────────────────────────────────────────────

describe('formatDependencyStatusLabel', () => {
  it('returns "Healthy" for healthy', () => {
    assert.equal(formatDependencyStatusLabel('healthy'), 'Healthy');
  });

  it('returns "Degraded" for degraded', () => {
    assert.equal(formatDependencyStatusLabel('degraded'), 'Degraded');
  });

  it('returns "Disabled" for disabled', () => {
    assert.equal(formatDependencyStatusLabel('disabled'), 'Disabled');
  });

  it('returns "Unavailable" for unavailable', () => {
    assert.equal(formatDependencyStatusLabel('unavailable'), 'Unavailable');
  });

  it('returns "Misconfigured" for misconfigured', () => {
    assert.equal(formatDependencyStatusLabel('misconfigured'), 'Misconfigured');
  });

  it('returns "Rate limited" for rate_limited', () => {
    assert.equal(formatDependencyStatusLabel('rate_limited'), 'Rate limited');
  });

  it('returns "Unknown" for null', () => {
    assert.equal(formatDependencyStatusLabel(null), 'Unknown');
  });

  it('returns raw status for unknown values', () => {
    assert.equal(formatDependencyStatusLabel('custom'), 'custom');
  });
});

// ── getDependencyStatusClass ───────────────────────────────────────────────

describe('getDependencyStatusClass', () => {
  it('returns selected class for healthy', () => {
    assert.equal(getDependencyStatusClass('healthy'), 'review-status-selected');
  });

  it('returns held class for degraded', () => {
    assert.equal(getDependencyStatusClass('degraded'), 'review-status-held');
  });

  it('returns held class for disabled', () => {
    assert.equal(getDependencyStatusClass('disabled'), 'review-status-held');
  });

  it('returns held class for rate_limited', () => {
    assert.equal(getDependencyStatusClass('rate_limited'), 'review-status-held');
  });

  it('returns failed class for unavailable', () => {
    assert.equal(getDependencyStatusClass('unavailable'), 'review-status-failed');
  });

  it('returns failed class for misconfigured', () => {
    assert.equal(getDependencyStatusClass('misconfigured'), 'review-status-failed');
  });

  it('returns empty string for unknown status', () => {
    assert.equal(getDependencyStatusClass('custom'), '');
  });
});

describe('buildSoulseekConnectionHealthSummary', () => {
  it('summarizes the saved Soulseek status without exposing implementation detail', () => {
    assert.deepEqual(
      buildSoulseekConnectionHealthSummary([{
        details: { observedAt: '2026-07-28T12:00:00.000Z' },
        message: 'Soulseek is connected and ready for downloads.',
        provider: 'slskd',
        status: 'healthy',
      }]),
      {
        message: 'Soulseek is connected and ready for downloads.',
        observedAt: '2026-07-28T12:00:00.000Z',
        status: 'healthy',
        statusClass: 'review-status-selected',
        statusLabel: 'Healthy',
      },
    );
  });

  it('keeps a refresh failure actionable instead of implying a failed provider', () => {
    assert.deepEqual(
      buildSoulseekConnectionHealthSummary([], 'Request failed'),
      {
        message: 'Harmoniarr could not refresh the saved connection status.',
        observedAt: null,
        status: 'unknown',
        statusClass: '',
        statusLabel: 'Unable to check',
      },
    );
  });

  it('makes an unavailable status clear when no health snapshot is present', () => {
    assert.deepEqual(
      buildSoulseekConnectionHealthSummary(),
      {
        message: 'No saved connection status is available yet.',
        observedAt: null,
        status: 'unknown',
        statusClass: '',
        statusLabel: 'Not checked',
      },
    );
  });
});

describe('getSupportingProviderHealth', () => {
  it('keeps supporting diagnostics out of the primary Soulseek status', () => {
    const dependencies = [
      { provider: 'slskd', status: 'healthy' },
      { provider: 'musicbrainz', status: 'healthy' },
      { provider: 'media_tooling', status: 'healthy' },
    ];

    assert.deepEqual(getSupportingProviderHealth(dependencies), dependencies.slice(1));
  });

  it('returns an empty list when no supporting services have been checked', () => {
    assert.deepEqual(getSupportingProviderHealth(), []);
  });
});
