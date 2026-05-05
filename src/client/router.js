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

import { createRouter, createWebHistory } from 'vue-router';
import AppShell from './components/AppShell.vue';
import AccountSecurityView from './views/AccountSecurityView.vue';
import BootstrapSetupView from './views/BootstrapSetupView.vue';
import ClaimAccountView from './views/ClaimAccountView.vue';
import DashboardView from './views/DashboardView.vue';
import ImportReviewView from './views/ImportReviewView.vue';
import LoginView from './views/LoginView.vue';
import MetadataView from './views/MetadataView.vue';
import RecoveryView from './views/RecoveryView.vue';
import RecoveryWorkspaceView from './views/RecoveryWorkspaceView.vue';
import OperationsView from './views/OperationsView.vue';
import RequestMusicView from './views/RequestMusicView.vue';
import { resolveRouterScroll } from './lib/router-scroll.js';
import SettingsView from './views/SettingsView.vue';
import { sessionStore } from './state/session.js';

const requesterRestrictedRouteNames = new Set(['dashboard', 'jobs', 'metadata', 'recovery-workspace', 'review-queue', 'settings']);

function defaultAuthenticatedRouteName() {
  return sessionStore.state.user?.role === 'requester' ? 'request-music' : 'dashboard';
}

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: resolveRouterScroll,
  routes: [
    { path: '/', redirect: '/app' },
    { path: '/bootstrap', name: 'bootstrap', component: BootstrapSetupView, meta: { anonymousOnly: true } },
    { path: '/claim-account', name: 'claim-account', component: ClaimAccountView, meta: { anonymousOnly: true } },
    { path: '/login', name: 'login', component: LoginView, meta: { anonymousOnly: true } },
    { path: '/recover/bootstrap-admin', name: 'recovery', component: RecoveryView },
    {
      path: '/app',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: 'account-security', name: 'account-security', component: AccountSecurityView },
        { path: '', name: 'dashboard', component: DashboardView },
        { path: 'jobs', name: 'jobs', component: OperationsView },
        { path: 'metadata', name: 'metadata', component: MetadataView },
        { path: 'recovery', name: 'recovery-workspace', component: RecoveryWorkspaceView },
        { path: 'requests', name: 'request-music', component: RequestMusicView },
        { path: 'review-queue', name: 'review-queue', component: ImportReviewView },
        { path: 'settings', name: 'settings', component: SettingsView },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  if (!sessionStore.state.ready) {
    await sessionStore.refreshSession();
  }

  if (sessionStore.state.bootstrapRequired) {
    return to.name === 'bootstrap' ? true : { name: 'bootstrap' };
  }

  if (to.name === 'bootstrap') {
    return sessionStore.state.authenticated ? { name: defaultAuthenticatedRouteName() } : { name: 'login' };
  }

  if (sessionStore.state.authenticated && sessionStore.state.user?.mustChangePassword && to.name !== 'account-security') {
    return {
      name: 'account-security',
      query: to.fullPath === '/app/account-security' ? {} : { redirect: to.fullPath },
    };
  }

  if (to.meta.requiresAuth && !sessionStore.state.authenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.anonymousOnly && sessionStore.state.authenticated) {
    return { name: defaultAuthenticatedRouteName() };
  }

  if (sessionStore.state.user?.role === 'requester' && requesterRestrictedRouteNames.has(String(to.name ?? ''))) {
    return { name: 'request-music' };
  }

  return true;
});

export default router;
