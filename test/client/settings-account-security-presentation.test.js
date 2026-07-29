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
import { buildAccountSecurityPosture } from '../../src/client/lib/settings-account-security-presentation.js';

test('account security posture makes a required password update the first action', () => {
  assert.deepEqual(buildAccountSecurityPosture({
    mustChangePassword: true,
    sessions: [{ isCurrent: true }, { isCurrent: false }],
  }), {
    copy: 'Update your password before continuing. Other signed-in devices will be signed out after the change.',
    status: 'Password update required',
    tone: 'danger',
  });
});

test('account security posture reports session loading without declaring the account safe', () => {
  assert.deepEqual(buildAccountSecurityPosture({ isLoadingSessions: true }), {
    copy: 'Checking the signed-in devices for this account.',
    status: 'Checking devices',
    tone: 'info',
  });
});

test('account security posture makes a session read failure actionable', () => {
  assert.deepEqual(buildAccountSecurityPosture({ sessionErrorMessage: 'Network failed' }), {
    copy: 'Signed-in devices could not be checked. Refresh the device list to try again.',
    status: 'Device check unavailable',
    tone: 'warning',
  });
});

test('account security posture does not call an empty session response safe', () => {
  assert.deepEqual(buildAccountSecurityPosture(), {
    copy: 'No signed-in devices were returned. Refresh the device list to check again.',
    status: 'No active devices found',
    tone: 'warning',
  });
});

test('account security posture calls attention to other signed-in devices', () => {
  assert.deepEqual(buildAccountSecurityPosture({
    sessions: [{ isCurrent: true }, { isCurrent: false }, { isCurrent: false }],
  }), {
    copy: 'Review unfamiliar devices and remove access you do not recognize.',
    status: '2 other signed-in devices',
    tone: 'info',
  });
});

test('account security posture does not overstate a single current session', () => {
  assert.deepEqual(buildAccountSecurityPosture({ sessions: [{ isCurrent: true }] }), {
    copy: 'No other signed-in devices are currently shown for this account.',
    status: 'This is the only signed-in device',
    tone: 'success',
  });
});
