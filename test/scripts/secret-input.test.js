/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOptionalSecretInput,
  getRequiredSecretFileInput,
  getRequiredSecretInput,
} from '../../scripts/secret-input.js';

const passwordOptions = Object.freeze({
  envName: 'HARMONIARR_WALKTHROUGH_PASSWORD',
  fileEnvName: 'HARMONIARR_WALKTHROUGH_PASSWORD_FILE',
  fileOptionName: 'password-file',
  optionName: 'password',
});

test('getRequiredSecretInput keeps a direct compatibility input out of file access', async () => {
  let readCount = 0;

  const password = await getRequiredSecretInput({
    ...passwordOptions,
    readFileFn: async () => {
      readCount += 1;
      return 'unused';
    },
    values: { password: 'DirectPass123!' },
  });

  assert.equal(password, 'DirectPass123!');
  assert.equal(readCount, 0);
});

test('getRequiredSecretInput reads and trims a password-only secret file', async () => {
  const password = await getRequiredSecretInput({
    ...passwordOptions,
    readFileFn: async (path, encoding) => {
      assert.equal(path, 'C:/secrets/walkthrough-password');
      assert.equal(encoding, 'utf8');
      return ' FilePass123!\n';
    },
    values: { 'password-file': 'C:/secrets/walkthrough-password' },
  });

  assert.equal(password, 'FilePass123!');
});

test('getRequiredSecretFileInput accepts only a password file and keeps its contents out of errors', async () => {
  const password = await getRequiredSecretFileInput({
    ...passwordOptions,
    readFileFn: async () => ' FilePass123!\n',
    values: { 'password-file': 'C:/secrets/walkthrough-password' },
  });

  assert.equal(password, 'FilePass123!');
  await assert.rejects(
    getRequiredSecretFileInput({
      ...passwordOptions,
      readFileFn: async () => {
        throw new Error('C:/secrets/walkthrough-password: permission denied');
      },
      values: { 'password-file': 'C:/secrets/walkthrough-password' },
    }),
    (error) => (
      error.message === 'HARMONIARR_WALKTHROUGH_PASSWORD_FILE could not be read'
      && !error.message.includes('C:/secrets')
    ),
  );
});

test('getOptionalSecretInput returns null without a configured secret source', async () => {
  let readCount = 0;

  const password = await getOptionalSecretInput({
    ...passwordOptions,
    readFileFn: async () => {
      readCount += 1;
      return 'unused';
    },
  });

  assert.equal(password, null);
  assert.equal(readCount, 0);
});

test('getRequiredSecretInput rejects ambiguous, missing, unreadable, and empty inputs without exposing content', async () => {
  await assert.rejects(
    getRequiredSecretInput({
      ...passwordOptions,
      values: {
        password: 'DirectPass123!',
        'password-file': 'C:/secrets/walkthrough-password',
      },
    }),
    /Configure only one of HARMONIARR_WALKTHROUGH_PASSWORD or HARMONIARR_WALKTHROUGH_PASSWORD_FILE/u,
  );

  await assert.rejects(
    getRequiredSecretInput(passwordOptions),
    /HARMONIARR_WALKTHROUGH_PASSWORD or HARMONIARR_WALKTHROUGH_PASSWORD_FILE is required/u,
  );

  await assert.rejects(
    getRequiredSecretInput({
      ...passwordOptions,
      readFileFn: async () => {
        throw new Error('C:/secrets/walkthrough-password: permission denied');
      },
      values: { 'password-file': 'C:/secrets/walkthrough-password' },
    }),
    (error) => (
      error.message === 'HARMONIARR_WALKTHROUGH_PASSWORD_FILE could not be read'
      && !error.message.includes('C:/secrets')
    ),
  );

  await assert.rejects(
    getRequiredSecretInput({
      ...passwordOptions,
      readFileFn: async () => '  \n',
      values: { 'password-file': 'C:/secrets/walkthrough-password' },
    }),
    /HARMONIARR_WALKTHROUGH_PASSWORD_FILE could not be read/u,
  );
});
