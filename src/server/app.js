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

import express from 'express';
import { resolve } from 'node:path';
import { createAuthModule } from './auth-module.js';
import { createDependencyHealthService, createProviderHealthRecorder } from './dependency-health-service.js';
import { createImportCandidateModule } from './import-candidates/import-candidate-module.js';
import { createLibraryModule } from './library/library-module.js';
import { createMetadataModule } from './metadata/metadata-module.js';
import { registerAuthRoutes } from './routes/auth-routes.js';
import { registerImportCandidateRoutes } from './routes/import-candidate-routes.js';
import { registerLibraryRoutes } from './routes/library-routes.js';
import { registerMetadataRoutes } from './routes/metadata-routes.js';
import { registerSlskdRoutes } from './routes/slskd-routes.js';
import { registerSystemRoutes } from './routes/system-routes.js';
import { createSettingsService } from './settings-service.js';
import { createSlskdModule } from './slskd/slskd-module.js';
import { createSystemModule } from './system-module.js';

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid APP_PORT value: ${value}`);
  }

  return parsed;
}

export function createApp({
  appPort = parsePort(process.env.APP_PORT, 3000),
  clientDistDir,
  packageJsonPath,
  startedAt = new Date(),
  createAuthModule: buildAuthModule = createAuthModule,
  createImportCandidateModule: buildImportCandidateModule = createImportCandidateModule,
  createLibraryModule: buildLibraryModule = createLibraryModule,
  createMetadataModule: buildMetadataModule = createMetadataModule,
  createSettingsService: buildSettingsService = createSettingsService,
  createSlskdModule: buildSlskdModule = createSlskdModule,
  createSystemModule: buildSystemModule = createSystemModule,
  registerAuthRoutes: mountAuthRoutes = registerAuthRoutes,
  registerImportCandidateRoutes: mountImportCandidateRoutes = registerImportCandidateRoutes,
  registerLibraryRoutes: mountLibraryRoutes = registerLibraryRoutes,
  registerMetadataRoutes: mountMetadataRoutes = registerMetadataRoutes,
  registerSlskdRoutes: mountSlskdRoutes = registerSlskdRoutes,
  registerSystemRoutes: mountSystemRoutes = registerSystemRoutes,
} = {}) {
  const app = express();
  const serverDir = import.meta.dirname;
  const resolvedClientDistDir = clientDistDir ?? process.env.HARMONIARR_CLIENT_DIST ?? resolve(serverDir, '../client');
  const resolvedPackageJsonPath = packageJsonPath ?? process.env.HARMONIARR_PACKAGE_JSON ?? resolve(serverDir, '../package.json');
  const providerHealthRecorder = createProviderHealthRecorder();
  const settingsService = buildSettingsService();
  const authModule = buildAuthModule({ settingsService });
  const metadataModule = buildMetadataModule({ providerHealthRecorder });
  const slskdModule = buildSlskdModule({ providerHealthRecorder });
  const importCandidateModule = buildImportCandidateModule({
    slskdTransferSnapshotService: slskdModule.slskdTransferSnapshotService,
    slskdService: slskdModule.slskdService,
  });
  const libraryModule = buildLibraryModule({
    importCandidateService: importCandidateModule.importCandidateService,
    settingsService,
    slskdService: slskdModule.slskdService,
  });
  const dependencyHealthService = createDependencyHealthService({
    recorder: providerHealthRecorder,
    checks: [
      {
        provider: 'slskd',
        check: slskdModule.slskdService.getConnectionStatus,
      },
    ],
  });
  const systemModule = buildSystemModule({
    appPort,
    dependencyHealthService,
    libraryScanSummaryService: libraryModule.libraryScanSummaryService,
    musicBrainzSearchService: metadataModule.musicBrainzSearchService,
    packageJsonPath: resolvedPackageJsonPath,
    settingsService,
    slskdService: slskdModule.slskdService,
    startedAt,
  });

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(express.static(resolvedClientDistDir, { index: false }));

  mountAuthRoutes(app, authModule.routeDependencies);
  mountMetadataRoutes(app, metadataModule.routeDependencies);
  mountSlskdRoutes(app, slskdModule.routeDependencies);
  mountImportCandidateRoutes(app, importCandidateModule.routeDependencies);
  mountLibraryRoutes(app, libraryModule.routeDependencies);
  mountSystemRoutes(app, systemModule.routeDependencies);

  app.use('/api', (_request, response) => {
    response.status(404).json({ ok: false, error: 'not_found' });
  });

  app.get(/.*/, async (_request, response) => {
    response.sendFile(resolve(resolvedClientDistDir, 'index.html'));
  });

  app.use((error, _request, response, _next) => {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    response.status(status).json({
      ok: false,
      error: {
        code: error?.code ?? 'internal_error',
        message: error?.message ?? 'Unexpected server error',
      },
    });
  });

  return {
    app,
    appPort,
    importCandidateModule,
    libraryModule,
  };
}
