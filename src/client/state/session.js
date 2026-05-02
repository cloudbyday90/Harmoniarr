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

import { reactive } from 'vue';
import { readCookie } from '../lib/api.js';
import {
  bootstrapAdmin as bootstrapAdminRequest,
  fetchSession,
  login as loginRequest,
  logout as logoutRequest,
} from '../lib/auth-api.js';

const state = reactive({
  ready: false,
  loading: false,
  bootstrapRequired: false,
  authenticated: false,
  user: null,
  csrfToken: '',
});

function applySessionPayload(payload) {
  state.bootstrapRequired = Boolean(payload.bootstrapRequired);
  state.user = payload.user ?? null;
  state.authenticated = Boolean(payload.user);
  state.csrfToken = payload.csrfToken ?? readCookie('harmoniarr_csrf') ?? '';
  state.ready = true;
}

function clearSession() {
  applySessionPayload({
    bootstrapRequired: state.bootstrapRequired,
    user: null,
    csrfToken: '',
  });
}

async function refreshSession() {
  state.loading = true;
  try {
    const payload = await fetchSession();
    applySessionPayload(payload);
    return payload;
  } finally {
    state.loading = false;
  }
}

async function bootstrapAdmin(form) {
  const payload = await bootstrapAdminRequest(form);
  applySessionPayload(payload);
  return payload;
}

async function login(form) {
  const payload = await loginRequest(form);
  applySessionPayload(payload);
  return payload;
}

async function logout() {
  try {
    await logoutRequest();
  } finally {
    clearSession();
  }
}

export const sessionStore = {
  applySessionPayload,
  state,
  clearSession,
  refreshSession,
  bootstrapAdmin,
  login,
  logout,
};
