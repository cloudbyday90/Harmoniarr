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
import ActivityBlocklistView from './views/ActivityBlocklistView.vue';
import AccountSecurityView from './views/AccountSecurityView.vue';
import ActivityDownloadsView from './views/ActivityDownloadsView.vue';
import ActivityFeedView from './views/ActivityFeedView.vue';
import ActivityHistoryView from './views/ActivityHistoryView.vue';
import ActivityImportsView from './views/ActivityImportsView.vue';
import ActivityReleasesView from './views/ActivityReleasesView.vue';
import ActivityUsersView from './views/ActivityUsersView.vue';
import ActivityWantedView from './views/ActivityWantedView.vue';
import ActivityWorkspaceView from './views/ActivityWorkspaceView.vue';
import ArtistDetailView from './views/ArtistDetailView.vue';
import BootstrapSetupView from './views/BootstrapSetupView.vue';
import ClaimAccountView from './views/ClaimAccountView.vue';
import DashboardView from './views/DashboardView.vue';
import ImportReviewView from './views/ImportReviewView.vue';
import LoginView from './views/LoginView.vue';
import MetadataView from './views/MetadataView.vue';
import MissingView from './views/MissingView.vue';
import OnboardingView from './views/OnboardingView.vue';
import OperationsView from './views/OperationsView.vue';
import RecoveryView from './views/RecoveryView.vue';
import RecoveryWorkspaceView from './views/RecoveryWorkspaceView.vue';
import DiscoverView from './views/DiscoverView.vue';
import LibraryView from './views/LibraryView.vue';
import MyRequestsView from './views/MyRequestsView.vue';
import RequestDetailView from './views/RequestDetailView.vue';
import RequestMusicView from './views/RequestMusicView.vue';
import SearchView from './views/SearchView.vue';
import SettingsConnectionsView from './views/SettingsConnectionsView.vue';
import SettingsGeneralView from './views/SettingsGeneralView.vue';
import SettingsLibraryView from './views/SettingsLibraryView.vue';
import SettingsMediaStorageView from './views/SettingsMediaStorageView.vue';
import SettingsNotificationsView from './views/SettingsNotificationsView.vue';
import SettingsUsersView from './views/SettingsUsersView.vue';
import SettingsWorkspaceView from './views/SettingsWorkspaceView.vue';
import { resolveRouterScroll } from './lib/router-scroll.js';
import { sessionStore } from './state/session.js';

const requesterRestrictedRouteNames = new Set([
  'missing',
  'onboarding',
  'activity',
  'activity-feed',
  'activity-operations',
  'activity-candidates',
  'activity-wanted',
  'activity-downloads',
  'activity-imports',
  'activity-releases',
  'activity-users',
  'activity-history',
  'activity-blocklist',
  'activity-failed',
  'settings',
  'settings-connections',
  'settings-media-storage',
  'settings-users',
  'settings-library',
  'settings-notifications',
  'settings-recovery',
  'settings-library-browser',
]);

function defaultAuthenticatedRouteName() {
  return 'dashboard';
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
        { path: '', name: 'dashboard', component: DashboardView },
        { path: 'onboarding', name: 'onboarding', component: OnboardingView },
        { path: 'discover', name: 'discover', component: DiscoverView },
        { path: 'library', name: 'library', component: LibraryView },
        { path: 'missing', name: 'missing', component: MissingView },
        { path: 'search', name: 'search', component: SearchView },
        { path: 'requests', name: 'request-music', component: RequestMusicView },
        { path: 'requests/:id', name: 'request-detail', component: RequestDetailView },
        { path: 'my-requests', name: 'my-requests', component: MyRequestsView },
        { path: 'artists/:mbid', name: 'artist-detail', component: ArtistDetailView },

        {
          path: 'activity',
          component: ActivityWorkspaceView,
          children: [
            { path: '', name: 'activity', redirect: { name: 'activity-operations' } },
            { path: 'operations', name: 'activity-operations', component: OperationsView },
            { path: 'candidates', name: 'activity-candidates', component: ImportReviewView },
            { path: 'requests', name: 'activity-requests', component: RequestMusicView },
            { path: 'queue', name: 'activity-queue', redirect: { name: 'activity-operations' } },
            { path: 'wanted', name: 'activity-wanted', component: ActivityWantedView },
            { path: 'downloads', name: 'activity-downloads', component: ActivityDownloadsView },
            { path: 'imports', name: 'activity-imports', component: ActivityImportsView },
            { path: 'releases', name: 'activity-releases', component: ActivityReleasesView },
            { path: 'feed', name: 'activity-feed', component: ActivityFeedView },
            { path: 'users', name: 'activity-users', component: ActivityUsersView },
            { path: 'history', name: 'activity-history', component: ActivityHistoryView },
            { path: 'blocklist', name: 'activity-blocklist', component: ActivityBlocklistView },
            { path: 'failed', name: 'activity-failed', component: ActivityImportsView, props: { status: 'failed', title: 'Failed', subtitle: 'Failed import candidates.', emptyTitle: 'No failed import candidates', emptyCopy: 'Imports that fail will surface here once the apply worker reports them.' } },
          ],
        },

        {
          path: 'settings',
          component: SettingsWorkspaceView,
          children: [
            { path: '', name: 'settings', component: SettingsGeneralView },
            { path: 'connections', name: 'settings-connections', component: SettingsConnectionsView },
            { path: 'library', name: 'settings-library', component: SettingsLibraryView },
            { path: 'media-storage', name: 'settings-media-storage', component: SettingsMediaStorageView },
            { path: 'users', name: 'settings-users', component: SettingsUsersView },
            { path: 'notifications', name: 'settings-notifications', component: SettingsNotificationsView },
            { path: 'account', name: 'settings-account', component: AccountSecurityView },
            { path: 'recovery', name: 'settings-recovery', component: RecoveryWorkspaceView },
            { path: 'library-browser', name: 'settings-library-browser', component: MetadataView },
          ],
        },

        // Backwards-compatible aliases for old deep links and existing route-name lookups.
        // Function form preserves query/hash so existing scroll anchors keep working.
        { path: 'jobs', name: 'jobs', redirect: (to) => ({ name: 'activity-operations', query: to.query, hash: to.hash }) },
        { path: 'review-queue', name: 'review-queue', redirect: (to) => ({ name: 'activity-candidates', query: to.query, hash: to.hash }) },
        { path: 'metadata', name: 'metadata', redirect: (to) => ({ name: 'settings-library-browser', query: to.query, hash: to.hash }) },
        { path: 'recovery', name: 'recovery-workspace', redirect: (to) => ({ name: 'settings-recovery', query: to.query, hash: to.hash }) },
        // Keep account-security as a top-level alias because the must-change-password guard
        // and existing recovery/claim flows route to it by name.
        { path: 'account-security', name: 'account-security', component: AccountSecurityView },
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

  if (
    sessionStore.state.authenticated
    && sessionStore.state.user?.mustChangePassword
    && to.name !== 'account-security'
    && to.name !== 'settings-account'
  ) {
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
    return { name: 'dashboard' };
  }

  return true;
});

export default router;
