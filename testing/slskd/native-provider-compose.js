/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { resolve } from 'node:path';
import { nativeFileVolumeOptions } from './native-file-volume.js';

export function nativeProviderCompose({ rootDir, workspaceRoot, applicationImage, providerImage, mode = 'batch' }) {
  const files = ['files', 'partial', 'resume'].includes(mode);
  const partial = ['partial', 'resume'].includes(mode);
  const bind = (source, target) => ({ type: 'bind', source, target, read_only: true });
  const common = { restart: 'no', user: '1000:1000', read_only: true,
    cap_drop: ['ALL'], security_opt: ['no-new-privileges:true'], networks: ['isolated'],
    pids_limit: 128, cpus: 1 };
  return {
    services: {
      fixture: { ...common, image: applicationImage, mem_limit: '256m',
        entrypoint: ['node', '/app/testing/slskd/fixture-entry.js'], command: [],
        healthcheck: { disable: true },
        tmpfs: ['/tmp:rw,size=16m,mode=1777'],
        volumes: [bind(resolve(rootDir, 'testing/slskd'), '/app/testing/slskd'),
          bind(resolve(rootDir, 'src/server'), '/app/src/server'), bind(resolve(rootDir, 'src/shared'), '/app/src/shared'),
          bind(resolve(workspaceRoot, 'fixture.json'), '/run/fixture.json'),
          ...(files ? [{ type: 'volume', source: 'completed', target: '/downloads', read_only: true }] : []),
          ...(partial ? [{ type: 'volume', source: 'incomplete', target: '/incomplete', read_only: true }] : [])],
      },
      provider: { ...common, image: providerImage, mem_limit: '512m',
        depends_on: { fixture: { condition: 'service_started' } },
        environment: { APP_DIR: '/app', DOTNET_BUNDLE_EXTRACT_BASE_DIR: '/app/.net',
          SLSKD_CONFIG: '/run/slskd.yml', SLSKD_SLSK_ADDRESS: 'fixture', SLSKD_SLSK_PORT: '2271', SLSKD_NO_VERSION_CHECK: 'true' },
        volumes: [bind(resolve(workspaceRoot, 'slskd.yml'), '/run/slskd.yml'),
          ...(files ? [{ type: 'volume', source: 'completed', target: '/data/downloads' }] : []),
          ...(partial ? [{ type: 'volume', source: 'incomplete', target: '/data/incomplete' }] : [])],
        // The bundled native SQLite library needs executable extraction, confined to /app.
        tmpfs: ['/tmp:rw,size=32m,mode=1777', '/app:rw,exec,size=256m,mode=1777',
          ...(!files ? ['/data/downloads:rw,size=32m,mode=1777'] : []),
          ...(!partial ? ['/data/incomplete:rw,size=32m,mode=1777'] : [])],
        healthcheck: { test: ['CMD-SHELL', "bash -ec '</dev/tcp/127.0.0.1/5030'"], interval: '1s', timeout: '1s', retries: 20 },
      },
    },
    networks: { isolated: { internal: true } },
    ...(files ? { volumes: { completed: { driver: 'local', driver_opts: nativeFileVolumeOptions },
      ...(partial ? { incomplete: { driver: 'local', driver_opts: nativeFileVolumeOptions } } : {}) } } : {}),
  };
}
