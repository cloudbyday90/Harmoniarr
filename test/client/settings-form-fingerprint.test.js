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
import { buildSettingsFormFingerprint } from '../../src/client/lib/settings-form-fingerprint.js';

function createForm() {
  return {
    providers: {
      spotifyClientId: 'client-id',
      spotifyClientSecret: 'first-secret',
    },
    slskd: {
      apiKey: 'first-api-key',
      baseUrl: 'http://slskd:5030',
    },
  };
}

test('settings form fingerprint masks write-only secret values', () => {
  const firstForm = createForm();
  const secondForm = createForm();
  secondForm.providers.spotifyClientSecret = 'second-secret';
  secondForm.slskd.apiKey = 'second-api-key';

  const firstFingerprint = buildSettingsFormFingerprint(firstForm);
  const secondFingerprint = buildSettingsFormFingerprint(secondForm);

  assert.equal(firstFingerprint, secondFingerprint);
  assert.doesNotMatch(firstFingerprint, /first-secret|second-secret|first-api-key|second-api-key/);
  assert.match(firstFingerprint, /\[configured\]/);
});

test('settings form fingerprint retains meaningful non-secret changes', () => {
  const firstForm = createForm();
  const secondForm = createForm();
  secondForm.slskd.baseUrl = 'http://different-slskd:5030';

  assert.notEqual(
    buildSettingsFormFingerprint(firstForm),
    buildSettingsFormFingerprint(secondForm),
  );
});
