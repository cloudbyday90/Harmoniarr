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

import { createAppUserProvisioningService } from '../app-user-provisioning-service.js';
import { createAppUserService } from '../app-user-service.js';
import { createRequestAuthDependencies } from '../auth-module.js';
import { asyncRoute } from '../http.js';

const defaultAppUserService = createAppUserService();
const defaultAppUserProvisioningService = createAppUserProvisioningService({
  getAppUserById: defaultAppUserService.getAppUserById,
});
const defaultRequestAuthDependencies = createRequestAuthDependencies();

export function registerAppUserRoutes(app, {
  applyPlexDirectoryImport = null,
  buildPlexDirectoryImportPreview = null,
  claimManagedLibraryRoot = defaultAppUserProvisioningService.claimManagedLibraryRoot,
  createAppUser = defaultAppUserService.createAppUser,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  getUserPreferences = defaultAppUserService.getUserPreferences,
  issueAppUserClaimCode = null,
  listAppUsers = defaultAppUserService.listAppUsers,
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
    response.json({
      ok: true,
      roleOptions,
      users: await listAppUsers(),
    });
  }));

  app.post('/api/v1/users', asyncRoute(async (request, response) => {
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

  app.patch('/api/v1/users/:userId', asyncRoute(async (request, response) => {
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
    app.post('/api/v1/users/:userId/claim-code', asyncRoute(async (request, response) => {
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

  app.post('/api/v1/users/:userId/reset-password', asyncRoute(async (request, response) => {
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

  app.post('/api/v1/users/:userId/provision-managed-library-root', asyncRoute(async (request, response) => {
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

  app.patch('/api/v1/users/me/preferences', asyncRoute(async (request, response) => {
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

  app.post('/api/v1/users/me/claim-managed-library-root', asyncRoute(async (request, response) => {
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

  if (typeof applyPlexDirectoryImport === 'function') {
    app.post('/api/v1/users/imports/plex/apply', asyncRoute(async (request, response) => {
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
    app.post('/api/v1/users/imports/plex/relink', asyncRoute(async (request, response) => {
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

  if (typeof unlinkPlexAppUser === 'function') {
    app.post('/api/v1/users/:userId/unlink-plex', asyncRoute(async (request, response) => {
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
