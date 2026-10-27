/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { startSessionLookup } from './session-lookup-owner-service.js';
import { hasBootstrapUsers } from './auth-lookup-store.js';
import { findPasswordLoginUser } from './password-login-store.js';

export function startAuthLookup(work, options) {
  return startSessionLookup(work, { ...options, errorCode: 'auth_lookup_unavailable' });
}

export function readBootstrapRequired(options) {
  return startAuthLookup(async client => !await hasBootstrapUsers(client), options).result;
}

export function readPasswordLoginUser(identifier, options) {
  return startAuthLookup(client => findPasswordLoginUser(client, identifier), options).result;
}
