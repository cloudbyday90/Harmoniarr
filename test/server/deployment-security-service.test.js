/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createDeploymentSecurityService, resolveCsrfProtectionMode, resolveDeploymentSecurityPolicy,
} from '../../src/server/deployment-security-service.js';
import { getDefaultSettings, normalizeSettingsPatch } from '../../src/server/validators/settings-validator.js';

test('missing and blank CSRF values require protection and malformed types cannot become an opt-out', () => {
  for (const value of [null, '', ' \t ']) assert.equal(resolveCsrfProtectionMode(value), 'required');
  for (const value of [false, true, 0, 1, [], {}, ['disabled']]) {
    assert.throws(() => resolveCsrfProtectionMode(value), /Invalid HARMONIARR_CSRF_PROTECTION/u);
    assert.throws(() => normalizeSettingsPatch({ security: { csrfProtectionMode: value } }),
      error => error.status === 400 && error.code === 'validation_error');
  }
  assert.equal(resolveCsrfProtectionMode(' Required '), 'required');
  assert.equal(resolveCsrfProtectionMode(' DISABLED '), 'disabled');
  assert.equal(getDefaultSettings().security.csrfProtectionMode, 'required');
});

test('explicit policy environments do not inherit an unrelated ambient CSRF opt-out', () => {
  const previous = process.env.HARMONIARR_CSRF_PROTECTION;
  process.env.HARMONIARR_CSRF_PROTECTION = 'disabled';
  try {
    assert.equal(resolveCsrfProtectionMode(), 'disabled');
    assert.equal(resolveDeploymentSecurityPolicy({ env: {} }).csrfProtectionMode, 'required');
  } finally {
    if (previous === undefined) delete process.env.HARMONIARR_CSRF_PROTECTION;
    else process.env.HARMONIARR_CSRF_PROTECTION = previous;
  }
});

test('saved policy keeps explicit precedence and null falls back to the supplied environment', () => {
  for (const saved of ['required', 'disabled']) {
    const env = { HARMONIARR_CSRF_PROTECTION: saved === 'required' ? 'disabled' : 'required' };
    const settings = { security: { csrfProtectionMode: saved } };
    assert.equal(resolveDeploymentSecurityPolicy({ env, settings }).csrfProtectionMode, saved);
  }
  assert.equal(resolveDeploymentSecurityPolicy({ env: { HARMONIARR_CSRF_PROTECTION: 'disabled' },
    settings: { security: { csrfProtectionMode: null } } }).csrfProtectionMode, 'disabled');
  assert.equal(resolveDeploymentSecurityPolicy({ env: { HARMONIARR_CSRF_PROTECTION: 'disabled' },
    settings: { security: { csrfProtectionMode: ' ' } } }).csrfProtectionMode, 'required');
});

test('first-load failure retains default protection and committed settings can opt out or re-enable', async () => {
  const service = createDeploymentSecurityService({ env: {}, loadSettingsFn: async () => { throw new Error('Unavailable'); } });
  assert.equal(service.getCachedPolicy().csrfProtectionMode, 'required');
  assert.equal((await service.getPolicy()).csrfProtectionMode, 'required');
  assert.equal(service.applySettings({ security: { csrfProtectionMode: 'disabled' } }).csrfProtectionMode, 'disabled');
  assert.equal((await service.getPolicy()).csrfProtectionMode, 'disabled');
  assert.equal(service.applySettings({ security: { csrfProtectionMode: 'required' } }).csrfProtectionMode, 'required');
});
