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
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  configureManagedSlskd,
  readManagedSlskdSecrets,
  renderManagedSlskdConfig,
  writeManagedSlskdConfig,
} from '../../docker/managed-slskd-config.js';

function createSecrets() {
  return {
    slskd_api_key: 'managed-api-key-12345',
    slskd_jwt_key: 'managed-jwt-key-12345',
    slskd_soulseek_password: 'soulseek-password',
    slskd_soulseek_username: 'soulseek-user',
    slskd_web_password: 'web-password',
    slskd_web_username: 'harmoniarr',
  };
}

function buildConfigArgs(secrets = createSecrets()) {
  return {
    apiKey: secrets.slskd_api_key,
    jwtKey: secrets.slskd_jwt_key,
    soulseekPassword: secrets.slskd_soulseek_password,
    soulseekUsername: secrets.slskd_soulseek_username,
    webPassword: secrets.slskd_web_password,
    webUsername: secrets.slskd_web_username,
  };
}

test('renderManagedSlskdConfig produces a headless, immutable, path-aligned config', () => {
  const config = renderManagedSlskdConfig(buildConfigArgs());

  assert.match(config, /^headless: true$/mu);
  assert.match(config, /^remote_configuration: false$/mu);
  assert.match(config, /^remote_file_management: false$/mu);
  assert.match(config, /^\s{2}ip_address: "0\.0\.0\.0"$/mu);
  assert.match(config, /^\s{2}downloads: "\/data\/downloads"$/mu);
  assert.match(config, /^\s{2}incomplete: "\/data\/incomplete"$/mu);
  assert.match(config, /^\s{8}role: readwrite$/mu);
  assert.match(config, /^\s{2}listen_port: 50300$/mu);
});

test('renderManagedSlskdConfig rejects unsafe key and path inputs', () => {
  const args = buildConfigArgs();

  assert.throws(
    () => renderManagedSlskdConfig({ ...args, apiKey: 'too-short' }),
    /slskd_api_key must contain between 16 and 255 characters/,
  );
  assert.throws(
    () => renderManagedSlskdConfig({ ...args, jwtKey: 'too-short' }),
    /slskd_jwt_key must contain at least 16 characters/,
  );
  assert.throws(
    () => renderManagedSlskdConfig({ ...args, downloadsDirectory: 'downloads' }),
    /HARMONIARR_SLSKD_DOWNLOADS_DIRECTORY must be an absolute path/,
  );
  assert.throws(
    () => renderManagedSlskdConfig({ ...args, soulseekUsername: 'name\nother' }),
    /slskd_soulseek_username must not contain control characters/,
  );
});

test('configureManagedSlskd reads file secrets and atomically writes the generated config', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-managed-slskd-'));
  const secretDirectory = join(directory, 'secrets');
  const configPath = join(directory, 'app', 'slskd.yml');
  const secrets = createSecrets();
  await mkdir(secretDirectory, { recursive: true });
  await Promise.all(Object.entries(secrets).map(([name, value]) => {
    return writeFile(join(secretDirectory, name), `${value}\n`, 'utf8');
  }));
  t.after(() => rm(directory, { force: true, recursive: true }));

  const result = await configureManagedSlskd({
    env: {
      HARMONIARR_SLSKD_CONFIG_PATH: configPath,
      HARMONIARR_SLSKD_SECRET_DIRECTORY: secretDirectory,
    },
  });

  assert.equal(result.configPath, configPath);
  const content = await readFile(configPath, 'utf8');
  assert.match(content, /soulseek-user/);
  assert.match(content, /managed-api-key-12345/);
  assert.deepEqual(await readManagedSlskdSecrets({ secretDirectory }), secrets);
});

test('writeManagedSlskdConfig requires an absolute config path', async () => {
  await assert.rejects(
    () => writeManagedSlskdConfig({ configPath: 'slskd.yml', content: 'headless: true\n' }),
    /HARMONIARR_SLSKD_CONFIG_PATH must be an absolute path/,
  );
});
