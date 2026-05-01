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
import BootstrapSetupView from './views/BootstrapSetupView.vue';
import DashboardView from './views/DashboardView.vue';
import ImportReviewView from './views/ImportReviewView.vue';
import LoginView from './views/LoginView.vue';
import MetadataView from './views/MetadataView.vue';
import SettingsView from './views/SettingsView.vue';
import { sessionStore } from './state/session.js';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/app' },
    { path: '/bootstrap', name: 'bootstrap', component: BootstrapSetupView, meta: { anonymousOnly: true } },
    { path: '/login', name: 'login', component: LoginView, meta: { anonymousOnly: true } },
    {
      path: '/app',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: DashboardView },
        { path: 'metadata', name: 'metadata', component: MetadataView },
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
    return sessionStore.state.authenticated ? { name: 'dashboard' } : { name: 'login' };
  }

  if (to.meta.requiresAuth && !sessionStore.state.authenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.anonymousOnly && sessionStore.state.authenticated) {
    return { name: 'dashboard' };
  }

  return true;
});

export default router;
