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

import { createAppUserDetailService } from '../app-user-detail-service.js';
import { createAppUserProvisioningService } from '../app-user-provisioning-service.js';
import { createAppUserService } from '../app-user-service.js';
import { createAccountSecurityService } from '../account-security-service.js';
import { createRequestAuthDependencies } from '../auth-module.js';
import { asyncRoute, sanitizePageLimit, sanitizePageOffset } from '../http.js';
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';

const defaultAppUserService = createAppUserService();
const defaultAppUserProvisioningService = createAppUserProvisioningService({
  getAppUserById: defaultAppUserService.getAppUserById,
});
const defaultAppUserDetailService = createAppUserDetailService();
const defaultAccountSecurityService = createAccountSecurityService();
const defaultRequestAuthDependencies = createRequestAuthDependencies();

export function registerAppUserRoutes(app, {
  adminRevokeAllUserSessions = defaultAccountSecurityService.adminRevokeAllUserSessions,
  adminRevokeUserSession = defaultAccountSecurityService.adminRevokeUserSession,
  applyPlexDirectoryImport = null,
  buildPlexLinkedAccountOverview = null,
  buildPlexDirectoryImportPreview = null,
  claimManagedLibraryRoot = defaultAppUserProvisioningService.claimManagedLibraryRoot,
  countAppUsers = defaultAppUserService.countAppUsers,
  createAppUser = defaultAppUserService.createAppUser,
  getAppUserById = defaultAppUserService.getAppUserById,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  getUserPreferences = defaultAppUserService.getUserPreferences,
  getUserRequestSummary = defaultAppUserDetailService.getUserRequestSummary,
  getUserSessions = defaultAppUserDetailService.getUserSessions,
  issueAppUserClaimCode = null,
  limitAppUserAdminMutations = skipRateLimitMiddleware,
  limitAppUserPreferencesMutations = skipRateLimitMiddleware,
  limitAppUserResetPassword = skipRateLimitMiddleware,
  listAppUsers = defaultAppUserService.listAppUsers,
  listAppUsersPage = defaultAppUserService.listAppUsersPage,
  listUserAuditEvents = defaultAppUserDetailService.listUserAuditEvents,
  reconcilePlexLinkedAccount = null,
  relinkPlexDirectoryConflict = null,
  resetAppUserPassword = defaultAppUserService.resetAppUserPassword,
  provisionManagedLibraryRoot = defaultAppUserProvisioningService.provisionManagedLibraryRoot,
  unlinkPlexAppUser = null,
  requireAdminSession = defaultRequestAuthDependencies.requireAdminSession,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
  requireFreshSession = defaultRequestAuthDependencies.requireFreshSession,
  roleOptions = defaultAppUserService.roleOptions,
  updateAppUser = defaultAppUserService.updateAppUser,
  updateUserPreferences = defaultAppUserService.updateUserPreferences,
} = {}) {
  app.get('/api/v1/users', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    const { search, role, isDisabled, limit, offset } = request.query;

    if (limit != null) {
      const filterParams = {
        isDisabled: typeof isDisabled === 'string' && isDisabled.length > 0 ? isDisabled : null,
        role: typeof role === 'string' && role.length > 0 ? role : null,
        search: typeof search === 'string' && search.trim().length > 0 ? search.trim() : null,
      };
      const [users, totalCount] = await Promise.all([
        listAppUsersPage({ ...filterParams, limit: sanitizePageLimit(limit), offset: sanitizePageOffset(offset) }),
        countAppUsers(filterParams),
      ]);
      response.json({ ok: true, roleOptions, totalCount, users });
    } else {
      response.json({ ok: true, roleOptions, users: await listAppUsers() });
    }
  }));

  app.get('/api/v1/users/:userId/detail', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const userId = request.params.userId;
    const [user, requestSummary, sessions] = await Promise.all([
      getAppUserById({ userId }),
      getUserRequestSummary({ userId }),
      getUserSessions({ userId }),
    ]);

    if (!user) {
      response.status(404).json({ ok: false, error: 'User not found' });
      return;
    }

    response.json({
      ok: true,
      requestSummary,
      sessions,
      user,
    });
  }));

  app.get('/api/v1/users/:userId/activity', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const userId = request.params.userId;
    const user = await getAppUserById({ userId });
    if (!user) {
      response.status(404).json({ ok: false, error: 'User not found' });
      return;
    }

    const limit = sanitizePageLimit(request.query.limit, { default: 25, max: 100 });
    const cursor = request.query.cursor || null;

    const result = await listUserAuditEvents({
      userId,
      cursor,
      limit,
    });

    response.json({
      events: result.events,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
      ok: true,
    });
  }));

  app.post('/api/v1/users', limitAppUserAdminMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const user = await createAppUser({
      actorUserId: session.appUserId,
      managedLibraryRelativeRoot: request.body?.managedLibraryRelativeRoot,
      password: request.body?.password,
      requestMetadata: getRequestMetadata(request),
      role: request.body?.role,
      username: request.body?.username,
    });

    response.status(201).json({
      ok: true,
      roleOptions,
      user,
    });
  }));

  app.patch('/api/v1/users/:userId', limitAppUserAdminMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const user = await updateAppUser({
      actorUserId: session.appUserId,
      isDisabled: request.body?.isDisabled,
      managedLibraryRelativeRoot: request.body?.managedLibraryRelativeRoot,
      requestMetadata: getRequestMetadata(request),
      role: request.body?.role,
      userId: request.params.userId,
    });

    response.json({
      ok: true,
      user,
    });
  }));

  if (typeof issueAppUserClaimCode === 'function') {
    app.post('/api/v1/users/:userId/claim-code', limitAppUserAdminMutations, asyncRoute(async (request, response) => {
      const session = await requireFreshAdminSession(request);
      requireCsrf(request, session);

      const result = await issueAppUserClaimCode({
        actorUserId: session.appUserId,
        requestMetadata: getRequestMetadata(request),
        ttlMinutes: request.body?.ttlMinutes,
        userId: request.params.userId,
      });

      response.status(201).json({
        claimCode: result.claimCode,
        expiresAt: result.expiresAt,
        ok: true,
        replacedExistingClaim: result.replacedExistingClaim,
        user: result.user,
      });
    }));
  }

  app.post('/api/v1/users/:userId/reset-password', limitAppUserResetPassword, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await resetAppUserPassword({
      actorUserId: session.appUserId,
      password: request.body?.password,
      requestMetadata: getRequestMetadata(request),
      userId: request.params.userId,
    });

    response.status(201).json({
      ok: true,
      revokedSessionCount: result.revokedSessionCount,
      user: result.user,
    });
  }));

  app.post('/api/v1/users/:userId/sessions/:refreshTokenId/revoke', limitAppUserAdminMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await adminRevokeUserSession({
      adminUserId: session.appUserId,
      refreshTokenId: request.params.refreshTokenId,
      requestMetadata: getRequestMetadata(request),
    });

    response.json({
      ok: true,
      ...result,
    });
  }));

  app.post('/api/v1/users/:userId/sessions/revoke-all', limitAppUserAdminMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await adminRevokeAllUserSessions({
      adminUserId: session.appUserId,
      requestMetadata: getRequestMetadata(request),
      targetUserId: request.params.userId,
    });

    response.json({
      ok: true,
      ...result,
    });
  }));

  app.post('/api/v1/users/:userId/provision-managed-library-root', limitAppUserAdminMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await provisionManagedLibraryRoot({
      actorUserId: session.appUserId,
      requestMetadata: getRequestMetadata(request),
      userId: request.params.userId,
    });

    response.status(201).json({
      ok: true,
      provisioning: result.provisioning,
      user: result.user,
    });
  }));

  app.get('/api/v1/users/me/preferences', asyncRoute(async (request, response) => {
    const session = await requireFreshSession(request);

    const preferences = await getUserPreferences({ userId: session.appUserId });

    response.json({ ok: true, preferences });
  }));

  app.patch('/api/v1/users/me/preferences', limitAppUserPreferencesMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshSession(request);
    requireCsrf(request, session);

    const preferences = await updateUserPreferences({
      actorUserId: session.appUserId,
      preferences: request.body,
      requestMetadata: getRequestMetadata(request),
      userId: session.appUserId,
    });

    response.json({ ok: true, preferences });
  }));

  app.post('/api/v1/users/me/claim-managed-library-root', limitAppUserPreferencesMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshSession(request);
    requireCsrf(request, session);

    const result = await claimManagedLibraryRoot({
      actorUserId: session.appUserId,
      managedLibraryRelativeRoot: request.body?.managedLibraryRelativeRoot,
      requestMetadata: getRequestMetadata(request),
    });

    response.status(201).json({
      ok: true,
      provisioning: result.provisioning,
      user: result.user,
    });
  }));

  if (typeof buildPlexDirectoryImportPreview === 'function') {
    app.get('/api/v1/users/imports/plex/preview', asyncRoute(async (request, response) => {
      await requireAdminSession(request);

      response.json({
        ok: true,
        ...(await buildPlexDirectoryImportPreview()),
      });
    }));
  }

  if (typeof buildPlexLinkedAccountOverview === 'function') {
    app.get('/api/v1/users/linked-accounts/plex', asyncRoute(async (request, response) => {
      await requireAdminSession(request);

      response.json({
        ok: true,
        ...(await buildPlexLinkedAccountOverview()),
      });
    }));
  }

  if (typeof applyPlexDirectoryImport === 'function') {
    app.post('/api/v1/users/imports/plex/apply', limitAppUserAdminMutations, asyncRoute(async (request, response) => {
      const session = await requireFreshAdminSession(request);
      requireCsrf(request, session);

      response.status(201).json({
        ok: true,
        ...(await applyPlexDirectoryImport({
          actorUserId: session.appUserId,
          requestMetadata: getRequestMetadata(request),
        })),
      });
    }));
  }

  if (typeof relinkPlexDirectoryConflict === 'function') {
    app.post('/api/v1/users/imports/plex/relink', limitAppUserAdminMutations, asyncRoute(async (request, response) => {
      const session = await requireFreshAdminSession(request);
      requireCsrf(request, session);

      response.status(201).json({
        ok: true,
        ...(await relinkPlexDirectoryConflict({
          actorUserId: session.appUserId,
          plexUserId: request.body?.plexUserId,
          requestMetadata: getRequestMetadata(request),
          userId: request.body?.userId,
        })),
      });
    }));
  }

  if (typeof reconcilePlexLinkedAccount === 'function') {
    app.post('/api/v1/users/:userId/plex-reconciliation', limitAppUserAdminMutations, asyncRoute(async (request, response) => {
      const session = await requireFreshAdminSession(request);
      requireCsrf(request, session);

      response.status(201).json({
        ok: true,
        ...(await reconcilePlexLinkedAccount({
          action: request.body?.action,
          actorUserId: session.appUserId,
          requestMetadata: getRequestMetadata(request),
          userId: request.params.userId,
        })),
      });
    }));
  }

  if (typeof unlinkPlexAppUser === 'function') {
    app.post('/api/v1/users/:userId/unlink-plex', limitAppUserAdminMutations, asyncRoute(async (request, response) => {
      const session = await requireFreshAdminSession(request);
      requireCsrf(request, session);

      response.status(201).json({
        ok: true,
        ...(await unlinkPlexAppUser({
          actorUserId: session.appUserId,
          requestMetadata: getRequestMetadata(request),
          userId: request.params.userId,
        })),
      });
    }));
  }
}
