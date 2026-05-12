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
  formatTokenExpiry,
  getAppleMusicStatusClass,
  getAppleMusicStatusLabel,
  getOAuthProviderStatus,
  getOAuthProviderStatusClass,
  getProviderLabel,
} from '../../src/client/lib/provider-status-presentation.js';

// ---------------------------------------------------------------------------
// getProviderLabel
// ---------------------------------------------------------------------------

describe('getProviderLabel', () => {
  it('returns "Apple Music" for "apple_music"', () => {
    assert.equal(getProviderLabel('apple_music'), 'Apple Music');
  });

  it('returns "Spotify" for "spotify"', () => {
    assert.equal(getProviderLabel('spotify'), 'Spotify');
  });

  it('returns "YouTube" for "youtube"', () => {
    assert.equal(getProviderLabel('youtube'), 'YouTube');
  });

  it('passes through an unknown provider key', () => {
    assert.equal(getProviderLabel('tidal'), 'tidal');
  });

  it('returns empty string for null', () => {
    assert.equal(getProviderLabel(null), '');
  });

  it('returns empty string for undefined', () => {
    assert.equal(getProviderLabel(undefined), '');
  });
});

// ---------------------------------------------------------------------------
// getOAuthProviderStatus
// ---------------------------------------------------------------------------

describe('getOAuthProviderStatus', () => {
  it('returns "Unavailable" for null provider', () => {
    assert.equal(getOAuthProviderStatus(null), 'Unavailable');
  });

  it('returns "Unavailable" for undefined provider', () => {
    assert.equal(getOAuthProviderStatus(undefined), 'Unavailable');
  });

  it('returns "Linked" when provider.linked is true', () => {
    assert.equal(getOAuthProviderStatus({ linked: true }), 'Linked');
  });

  it('returns "Not linked" when provider.linked is false', () => {
    assert.equal(getOAuthProviderStatus({ linked: false }), 'Not linked');
  });

  it('returns "Not linked" when provider.linked is absent', () => {
    assert.equal(getOAuthProviderStatus({}), 'Not linked');
  });
});

// ---------------------------------------------------------------------------
// getOAuthProviderStatusClass
// ---------------------------------------------------------------------------

describe('getOAuthProviderStatusClass', () => {
  it('returns failed class for null provider', () => {
    assert.equal(getOAuthProviderStatusClass(null), 'review-status-failed');
  });

  it('returns failed class for undefined provider', () => {
    assert.equal(getOAuthProviderStatusClass(undefined), 'review-status-failed');
  });

  it('returns selected class when linked', () => {
    assert.equal(getOAuthProviderStatusClass({ linked: true }), 'review-status-selected');
  });

  it('returns held class when not linked', () => {
    assert.equal(getOAuthProviderStatusClass({ linked: false }), 'review-status-held');
  });
});

// ---------------------------------------------------------------------------
// getAppleMusicStatusLabel
// ---------------------------------------------------------------------------

describe('getAppleMusicStatusLabel', () => {
  it('returns "Unavailable" for null provider', () => {
    assert.equal(getAppleMusicStatusLabel(null), 'Unavailable');
  });

  it('returns "Unavailable" for undefined provider', () => {
    assert.equal(getAppleMusicStatusLabel(undefined), 'Unavailable');
  });

  it('returns "Configured" when provider.configured is true', () => {
    assert.equal(getAppleMusicStatusLabel({ configured: true }), 'Configured');
  });

  it('returns "Not configured" when provider.configured is false', () => {
    assert.equal(getAppleMusicStatusLabel({ configured: false }), 'Not configured');
  });

  it('returns "Not configured" when provider.configured is absent', () => {
    assert.equal(getAppleMusicStatusLabel({}), 'Not configured');
  });
});

// ---------------------------------------------------------------------------
// getAppleMusicStatusClass
// ---------------------------------------------------------------------------

describe('getAppleMusicStatusClass', () => {
  it('returns failed class for null provider', () => {
    assert.equal(getAppleMusicStatusClass(null), 'review-status-failed');
  });

  it('returns failed class for undefined provider', () => {
    assert.equal(getAppleMusicStatusClass(undefined), 'review-status-failed');
  });

  it('returns selected class when configured', () => {
    assert.equal(getAppleMusicStatusClass({ configured: true }), 'review-status-selected');
  });

  it('returns held class when not configured', () => {
    assert.equal(getAppleMusicStatusClass({ configured: false }), 'review-status-held');
  });
});

// ---------------------------------------------------------------------------
// formatTokenExpiry
// ---------------------------------------------------------------------------

describe('formatTokenExpiry', () => {
  it('returns null for null provider', () => {
    assert.equal(formatTokenExpiry(null), null);
  });

  it('returns null for undefined provider', () => {
    assert.equal(formatTokenExpiry(undefined), null);
  });

  it('returns null when provider is not linked', () => {
    assert.equal(formatTokenExpiry({ linked: false, tokenExpiresAt: '2026-01-01T00:00:00Z' }), null);
  });

  it('returns null when linked but tokenExpiresAt is absent', () => {
    assert.equal(formatTokenExpiry({ linked: true }), null);
  });

  it('returns null when linked but tokenExpiresAt is null', () => {
    assert.equal(formatTokenExpiry({ linked: true, tokenExpiresAt: null }), null);
  });

  it('returns a non-empty string for a linked provider with a valid expiry', () => {
    const result = formatTokenExpiry({ linked: true, tokenExpiresAt: '2026-12-31T23:59:59Z' });
    assert.ok(typeof result === 'string' && result.length > 0);
  });
});
