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
  buildDownloadMappingSourceLabel,
  buildDownloadsPathHint,
  buildPathTranslationSetupPrompt,
  buildPathTranslationsDescription,
  buildPathTranslationsEmptyState,
  formatCommaSeparatedList,
  formatMappingLabel,
  formatPathStatusLabel,
  formatPathStatusTone,
  formatPathValidationNote,
  formatUserRootLabel,
} from '../../src/client/lib/settings-media-storage-presentation.js';

// ---------------------------------------------------------------------------
// formatPathStatusTone
// ---------------------------------------------------------------------------
describe('formatPathStatusTone', () => {
  it('returns success for healthy', () => {
    assert.equal(formatPathStatusTone('healthy'), 'success');
  });

  it('returns danger for unavailable', () => {
    assert.equal(formatPathStatusTone('unavailable'), 'danger');
  });

  it('returns warning for unknown status', () => {
    assert.equal(formatPathStatusTone('degraded'), 'warning');
  });

  it('returns warning for null', () => {
    assert.equal(formatPathStatusTone(null), 'warning');
  });

  it('returns warning for undefined', () => {
    assert.equal(formatPathStatusTone(undefined), 'warning');
  });

  it('never returns danger for anything other than unavailable', () => {
    const values = ['healthy', 'degraded', null, undefined, '', 'error', 'unknown'];
    for (const v of values) {
      assert.notEqual(formatPathStatusTone(v), 'danger', `expected non-danger for ${String(v)}`);
    }
  });
});

// ---------------------------------------------------------------------------
// formatPathStatusLabel
// ---------------------------------------------------------------------------
describe('formatPathStatusLabel', () => {
  it('returns Healthy for healthy', () => {
    assert.equal(formatPathStatusLabel('healthy'), 'Healthy');
  });

  it('returns Unavailable for unavailable', () => {
    assert.equal(formatPathStatusLabel('unavailable'), 'Unavailable');
  });

  it('returns Needs attention for unknown status', () => {
    assert.equal(formatPathStatusLabel('degraded'), 'Needs attention');
  });

  it('returns Needs attention for null', () => {
    assert.equal(formatPathStatusLabel(null), 'Needs attention');
  });

  it('returns Needs attention for undefined', () => {
    assert.equal(formatPathStatusLabel(undefined), 'Needs attention');
  });

  it('does not return a raw enum value', () => {
    const inputs = ['healthy', 'unavailable', 'degraded', null, undefined, 'warning'];
    for (const v of inputs) {
      const result = formatPathStatusLabel(v);
      assert.notEqual(result, v, `should not return raw value ${String(v)}`);
    }
  });
});

// ---------------------------------------------------------------------------
// formatCommaSeparatedList
// ---------------------------------------------------------------------------
describe('formatCommaSeparatedList', () => {
  it('joins array elements with a comma and space', () => {
    assert.equal(formatCommaSeparatedList(['a', 'b', 'c']), 'a, b, c');
  });

  it('returns single element without trailing comma', () => {
    assert.equal(formatCommaSeparatedList(['coverArtArchive']), 'coverArtArchive');
  });

  it('returns empty string for empty array', () => {
    assert.equal(formatCommaSeparatedList([]), '');
  });

  it('returns empty string for null', () => {
    assert.equal(formatCommaSeparatedList(null), '');
  });

  it('returns empty string for undefined', () => {
    assert.equal(formatCommaSeparatedList(undefined), '');
  });

  it('returns empty string for a plain string (not an array)', () => {
    assert.equal(formatCommaSeparatedList('a,b'), '');
  });

  it('handles arrays with numeric values', () => {
    assert.equal(formatCommaSeparatedList([256, 512]), '256, 512');
  });
});

// ---------------------------------------------------------------------------
// formatMappingLabel
// ---------------------------------------------------------------------------
describe('formatMappingLabel', () => {
  it('returns Mapping 1 for index 0', () => {
    assert.equal(formatMappingLabel(0), 'Mapping 1');
  });

  it('returns Mapping 2 for index 1', () => {
    assert.equal(formatMappingLabel(1), 'Mapping 2');
  });

  it('returns Mapping 10 for index 9', () => {
    assert.equal(formatMappingLabel(9), 'Mapping 10');
  });

  it('starts with the word Mapping', () => {
    assert.match(formatMappingLabel(0), /^Mapping /);
  });

  it('is 1-based (not 0-based)', () => {
    const label = formatMappingLabel(0);
    assert.doesNotMatch(label, /Mapping 0/);
  });
});

// ---------------------------------------------------------------------------
// formatUserRootLabel
// ---------------------------------------------------------------------------
describe('formatUserRootLabel', () => {
  it('returns Per-user folder 1 for index 0', () => {
    assert.equal(formatUserRootLabel(0), 'Per-user folder 1');
  });

  it('returns Per-user folder 2 for index 1', () => {
    assert.equal(formatUserRootLabel(1), 'Per-user folder 2');
  });

  it('uses folder not root in the label', () => {
    assert.match(formatUserRootLabel(0), /folder/i);
    assert.doesNotMatch(formatUserRootLabel(0), /root/i);
  });

  it('is 1-based (not 0-based)', () => {
    assert.doesNotMatch(formatUserRootLabel(0), /folder 0/i);
  });

  it('starts with Per-user', () => {
    assert.match(formatUserRootLabel(0), /^Per-user/);
  });
});

// ---------------------------------------------------------------------------
// formatPathValidationNote
// ---------------------------------------------------------------------------
describe('formatPathValidationNote', () => {
  it('returns null for null', () => {
    assert.equal(formatPathValidationNote(null), null);
  });

  it('returns null for undefined', () => {
    assert.equal(formatPathValidationNote(undefined), null);
  });

  it('returns null for empty string', () => {
    assert.equal(formatPathValidationNote(''), null);
  });

  it('normalises the known missing-mappings backend message', () => {
    const raw = 'No explicit slskd download mappings are configured yet; preview resolution still falls back to the downloads root assumption.';
    const result = formatPathValidationNote(raw);
    assert.ok(result, 'should return a non-empty string');
    assert.doesNotMatch(result, /slskd/i);
    assert.doesNotMatch(result, /preview resolution/i);
    assert.doesNotMatch(result, /downloads root assumption/i);
  });

  it('normalised missing-mappings message is user-friendly', () => {
    const raw = 'No explicit slskd download mappings are configured yet; preview resolution still falls back to the downloads root assumption.';
    const result = formatPathValidationNote(raw);
    assert.ok(result.length > 10, 'should be a full sentence');
  });

  it('replaces slskd in other notes', () => {
    const raw = 'The slskd path /downloads could not be resolved.';
    const result = formatPathValidationNote(raw);
    assert.doesNotMatch(result, /\bslskd\b/i);
    assert.match(result, /download client/i);
  });

  it('passes through notes with no internal terms unchanged', () => {
    const raw = 'Path /data/music is accessible and writable.';
    assert.equal(formatPathValidationNote(raw), raw);
  });

  it('is case-insensitive when replacing slskd', () => {
    const raw = 'The SLSKD path is configured correctly.';
    const result = formatPathValidationNote(raw);
    assert.doesNotMatch(result, /SLSKD/);
  });
});

// ---------------------------------------------------------------------------
// buildDownloadsPathHint
// ---------------------------------------------------------------------------
describe('buildDownloadsPathHint', () => {
  it('returns a non-empty string', () => {
    assert.ok(buildDownloadsPathHint().length > 0);
  });

  it('does not mention slskd', () => {
    assert.doesNotMatch(buildDownloadsPathHint(), /slskd/i);
  });

  it('mentions download client in plain language', () => {
    assert.match(buildDownloadsPathHint(), /download client/i);
  });

  it('mentions Harmoniarr', () => {
    assert.match(buildDownloadsPathHint(), /Harmoniarr/);
  });
});

// ---------------------------------------------------------------------------
// buildPathTranslationsDescription
// ---------------------------------------------------------------------------
describe('buildPathTranslationsDescription', () => {
  it('returns a non-empty string', () => {
    assert.ok(buildPathTranslationsDescription().length > 0);
  });

  it('does not mention slskd', () => {
    assert.doesNotMatch(buildPathTranslationsDescription(), /slskd/i);
  });

  it('does not use container-centric framing', () => {
    assert.doesNotMatch(buildPathTranslationsDescription(), /container/i);
  });

  it('explains the purpose in plain language', () => {
    assert.match(buildPathTranslationsDescription(), /download client/i);
  });
});

// ---------------------------------------------------------------------------
// buildPathTranslationsEmptyState
// ---------------------------------------------------------------------------
describe('buildPathTranslationsEmptyState', () => {
  it('returns a non-empty string', () => {
    assert.ok(buildPathTranslationsEmptyState().length > 0);
  });

  it('does not mention slskd', () => {
    assert.doesNotMatch(buildPathTranslationsEmptyState(), /slskd/i);
  });

  it('mentions download client', () => {
    assert.match(buildPathTranslationsEmptyState(), /download client/i);
  });
});

// ---------------------------------------------------------------------------
// buildPathTranslationSetupPrompt
// ---------------------------------------------------------------------------
describe('buildPathTranslationSetupPrompt', () => {
  it('prompts for a translation while an external provider is enabled without mappings', () => {
    const prompt = buildPathTranslationSetupPrompt({
      downloadMappingCount: 0,
      providerMode: 'external',
    });

    assert.deepEqual(prompt, {
      actionLabel: 'Add path translation',
      description: 'Make the completed-download folder available to Harmoniarr, then enter the download client path and the Harmoniarr path for that same folder.',
      title: 'Finish automatic download setup',
    });
  });

  it('keeps the prompt available for managed providers without mappings', () => {
    assert.ok(buildPathTranslationSetupPrompt({
      downloadMappingCount: 0,
      providerMode: 'managed',
    }));
  });

  it('does not prompt once a mapping exists', () => {
    assert.equal(buildPathTranslationSetupPrompt({
      downloadMappingCount: 1,
      providerMode: 'external',
    }), null);
  });

  it('does not prompt while downloads are disabled', () => {
    assert.equal(buildPathTranslationSetupPrompt({
      downloadMappingCount: 0,
      providerMode: 'disabled',
    }), null);
  });

  it('uses only user-facing language', () => {
    const prompt = buildPathTranslationSetupPrompt();
    assert.doesNotMatch(`${prompt.title} ${prompt.description}`, /slskd|candidate|container/i);
  });
});

// ---------------------------------------------------------------------------
// buildDownloadMappingSourceLabel
// ---------------------------------------------------------------------------
describe('buildDownloadMappingSourceLabel', () => {
  it('returns a non-empty string', () => {
    assert.ok(buildDownloadMappingSourceLabel().length > 0);
  });

  it('does not mention slskd', () => {
    assert.doesNotMatch(buildDownloadMappingSourceLabel(), /slskd/i);
  });

  it('uses plain language for the field label', () => {
    assert.match(buildDownloadMappingSourceLabel(), /download client/i);
  });
});
