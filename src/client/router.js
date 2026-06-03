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
import { resolveRouterScroll } from './lib/router-scroll.js';
import { sessionStore } from './state/session.js';

const ActivityBlocklistView = () => import('./views/ActivityBlocklistView.vue');
const AccountSecurityView = () => import('./views/AccountSecurityView.vue');
const ActivityDownloadsView = () => import('./views/ActivityDownloadsView.vue');
const ActivityFeedView = () => import('./views/ActivityFeedView.vue');
const ActivityHistoryView = () => import('./views/ActivityHistoryView.vue');
const ActivityIgnoredView = () => import('./views/ActivityIgnoredView.vue');
const ActivityImportsView = () => import('./views/ActivityImportsView.vue');
const ActivityMonitoredArtistsView = () => import('./views/ActivityMonitoredArtistsView.vue');
const ActivityReleasesView = () => import('./views/ActivityReleasesView.vue');
const ActivityUsersView = () => import('./views/ActivityUsersView.vue');
const ActivityWantedView = () => import('./views/ActivityWantedView.vue');
const ActivityWorkspaceView = () => import('./views/ActivityWorkspaceView.vue');
const ArtistDetailView = () => import('./views/ArtistDetailView.vue');
const BootstrapSetupView = () => import('./views/BootstrapSetupView.vue');
const ClaimAccountView = () => import('./views/ClaimAccountView.vue');
const HomeView = () => import('./views/HomeView.vue');
const ImportReviewView = () => import('./views/ImportReviewView.vue');
const LibraryView = () => import('./views/LibraryView.vue');
const LoginView = () => import('./views/LoginView.vue');
const MetadataView = () => import('./views/MetadataView.vue');
const MissingView = () => import('./views/MissingView.vue');
const OnboardingView = () => import('./views/OnboardingView.vue');
const OperationsView = () => import('./views/OperationsView.vue');
const RecoveryView = () => import('./views/RecoveryView.vue');
const RecoveryWorkspaceView = () => import('./views/RecoveryWorkspaceView.vue');
const DiscoverView = () => import('./views/DiscoverView.vue');
const MyRequestsView = () => import('./views/MyRequestsView.vue');
const RequestDetailView = () => import('./views/RequestDetailView.vue');
const RequestMusicView = () => import('./views/RequestMusicView.vue');
const SearchView = () => import('./views/SearchView.vue');
const SettingsConnectionsView = () => import('./views/SettingsConnectionsView.vue');
const SettingsGeneralView = () => import('./views/SettingsGeneralView.vue');
const SettingsLibraryView = () => import('./views/SettingsLibraryView.vue');
const SettingsMediaStorageView = () => import('./views/SettingsMediaStorageView.vue');
const SettingsNotificationsView = () => import('./views/SettingsNotificationsView.vue');
const SettingsUsersView = () => import('./views/SettingsUsersView.vue');
const SettingsWorkspaceView = () => import('./views/SettingsWorkspaceView.vue');
const UserDetailView = () => import('./views/UserDetailView.vue');

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
  'activity-ignored',
  'activity-failed',
  'activity-monitored-artists',
  'settings',
  'settings-connections',
  'settings-media-storage',
  'settings-users',
  'settings-user-detail',
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
        { path: '', name: 'dashboard', component: HomeView },
        { path: 'dashboard', redirect: (to) => ({ name: 'dashboard', query: to.query, hash: to.hash }) },
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
            { path: 'ignored', name: 'activity-ignored', component: ActivityIgnoredView },
            { path: 'failed', name: 'activity-failed', component: ActivityImportsView, props: { status: 'failed', title: 'Failed', subtitle: 'Failed import candidates.', emptyTitle: 'No failed import candidates', emptyCopy: 'Imports that fail will surface here once the apply worker reports them.' } },
            { path: 'monitored-artists', name: 'activity-monitored-artists', component: ActivityMonitoredArtistsView },
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
            { path: 'users/:userId', name: 'settings-user-detail', component: UserDetailView },
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
