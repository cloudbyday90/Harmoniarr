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
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const COMPOSE_PATH = new URL('../../compose.slskd-example.yaml', import.meta.url);

test('managed slskd Compose overlay keeps the API private and persists generated configuration', async () => {
  const source = await readFile(COMPOSE_PATH, 'utf8');

  assert.match(source, /slskd-config:/u);
  assert.match(source, /condition: service_completed_successfully/u);
  assert.match(source, /SLSKD_API_KEY_FILE: \/run\/secrets\/slskd_api_key/u);
  assert.match(source, /HARMONIARR_SLSKD_APPDATA[^\n]*:\/app/u);
  assert.match(source, /HARMONIARR_DOWNLOADS[^\n]*:\/data\/downloads/u);
  assert.match(source, /harmoniarr-provider:[\s\S]*?internal: true/u);
  assert.match(source, /expose:\n\s+- "5030"/u);
  assert.doesNotMatch(source, /SLSKD_WEB_PORT/u);
  assert.match(source, /target: 50300/u);
  assert.match(source, /image: slskd\/slskd:0\.26\.0/u);
});

test('managed slskd Compose overlay grants secrets only to the services that need them', async () => {
  const source = await readFile(COMPOSE_PATH, 'utf8');
  const configServiceStart = source.indexOf('\n  slskd-config:');
  const providerServiceStart = source.indexOf('\n  slskd:\n');
  const providerServiceEnd = source.indexOf('\nnetworks:');
  const configService = source.slice(configServiceStart, providerServiceStart);
  const providerService = source.slice(providerServiceStart, providerServiceEnd);

  assert.match(configService, /slskd_soulseek_password/u);
  assert.match(configService, /slskd_web_password/u);
  assert.match(configService, /network_mode: none/u);
  assert.match(providerService, /SLSKD_CONFIG: \/app\/slskd\.yml/u);
  assert.doesNotMatch(providerService, /secrets:/u);
});
