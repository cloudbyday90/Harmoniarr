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

import { createRequestAuthDependencies } from './auth-module.js';
import { createAccountClaimService } from './account-claim-service.js';
import { createAppUserProvisioningService } from './app-user-provisioning-service.js';
import { createAppUserPermissionService } from './app-user-permission-service.js';
import { createAppUserService } from './app-user-service.js';

export function createAppUserModule({
  accountClaimService,
  appUserProvisioningService,
  appUserService,
  permissionService,
  plexDirectoryImportService = null,
  plexLinkedAccountManagementService = null,
  plexLinkedAccountReconciliationService = null,
  ...overrides
} = {}) {
  const resolvedPermissionService = permissionService ?? createAppUserPermissionService();
  const resolvedAppUserService = appUserService ?? createAppUserService({
    permissionService: resolvedPermissionService,
  });
  const resolvedAccountClaimService = accountClaimService ?? createAccountClaimService({
    getAppUserByIdFn: resolvedAppUserService.getAppUserById,
  });
  const resolvedAppUserProvisioningService = appUserProvisioningService ?? createAppUserProvisioningService({
    getAppUserById: resolvedAppUserService.getAppUserById,
    updateAppUser: resolvedAppUserService.updateAppUser,
  });

  return {
    accountClaimService: resolvedAccountClaimService,
    appUserProvisioningService: resolvedAppUserProvisioningService,
    appUserService: resolvedAppUserService,
    permissionService: resolvedPermissionService,
    routeDependencies: {
      createAppUser: resolvedAppUserService.createAppUser,
      claimManagedLibraryRoot: resolvedAppUserProvisioningService.claimManagedLibraryRoot,
      getAppUserById: resolvedAppUserService.getAppUserById,
      getUserPreferences: resolvedAppUserService.getUserPreferences,
      issueAppUserClaimCode: resolvedAccountClaimService.issueClaimCode,
      listAppUsers: resolvedAppUserService.listAppUsers,
      resetAppUserPassword: resolvedAppUserService.resetAppUserPassword,
      ...(plexDirectoryImportService
        ? {
          applyPlexDirectoryImport: plexDirectoryImportService.applyImport,
          buildPlexDirectoryImportPreview: plexDirectoryImportService.buildPreview,
          relinkPlexDirectoryConflict: plexDirectoryImportService.relinkConflict,
          unlinkPlexAppUser: plexDirectoryImportService.unlinkUser,
        }
        : {}),
      ...(plexLinkedAccountManagementService
        ? {
          buildPlexLinkedAccountOverview: plexLinkedAccountManagementService.buildOverview,
        }
        : {}),
      ...(plexLinkedAccountReconciliationService
        ? {
          reconcilePlexLinkedAccount: plexLinkedAccountReconciliationService.reconcileUser,
        }
        : {}),
      provisionManagedLibraryRoot: resolvedAppUserProvisioningService.provisionManagedLibraryRoot,
      roleOptions: [...resolvedPermissionService.roleOptions],
      updateAppUser: resolvedAppUserService.updateAppUser,
      updateUserPreferences: resolvedAppUserService.updateUserPreferences,
      ...createRequestAuthDependencies(),
      ...overrides,
    },
  };
}
