/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSecurityConfigurationPosture } from '../../src/client/lib/settings-security-presentation.js';

test('security posture describes local HTTP as a configuration boundary, not a failure', () => {
  const posture = buildSecurityConfigurationPosture({
    security: { csrfProtectionMode: 'disabled' },
    system: { baseUrl: '' },
  });

  assert.equal(posture.statusLabel, 'Local access configuration');
  assert.equal(posture.tone, 'info');
  assert.match(posture.message, /private to your network/i);
  assert.doesNotMatch(posture.message, /healthy|securely exposed/i);
});

test('security posture identifies incomplete remote HTTPS configuration', () => {
  const posture = buildSecurityConfigurationPosture({
    security: { csrfProtectionMode: 'required', enforceHttps: false, secureCookies: false },
    system: { baseUrl: 'https://harmoniarr.example' },
  });

  assert.equal(posture.statusLabel, 'Remote access needs attention');
  assert.equal(posture.tone, 'warning');
});

test('security posture reports saved HTTPS configuration without claiming proxy health', () => {
  const posture = buildSecurityConfigurationPosture({
    security: {
      csrfProtectionMode: 'required',
      enforceHttps: true,
      secureCookies: true,
      strictTransportSecurity: true,
    },
    system: { baseUrl: 'https://harmoniarr.example' },
  });

  assert.equal(posture.statusLabel, 'HTTPS configuration ready');
  assert.equal(posture.tone, 'success');
  assert.match(posture.message, /Confirm reverse-proxy and certificate health separately/i);
  assert.equal(posture.checks.at(-1).statusLabel, 'Enabled');
});
