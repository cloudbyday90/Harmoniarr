/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {assertBackupPgCrashMounts} from './backup-pg-crash-container.js';

export function assertBackupContainerRuntime(container,volumeName,profileId,image){
  assertBackupPgCrashMounts(container,volumeName,profileId,image);
  assert.deepEqual(container.Config.Entrypoint,['/usr/local/bin/harmoniarr-entrypoint']);
  assert.deepEqual(container.Config.Cmd,['node','/app/server-dist/index.js']);
  assert.equal(container.Path,'/usr/local/bin/harmoniarr-entrypoint');
  assert.ok(!container.Config.Env.includes('HARMONIARR_TEST_DISABLE_BACKGROUND_SERVICES=true'));
}
export function backupContainerCreateArgs({volumeName,profileId,evidenceDir,image}){
  const args=['create','--label','harmoniarr.backup-pg-crash='+profileId,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true',
    '--user','1000:1000','--pids-limit','256','--cpus','2','--memory','3g','--memory-swap','3g','--shm-size','128m',
    '--health-interval','1s','--health-timeout','3s','--health-start-period','30s','--health-retries','30',
    '--mount','type=volume,source='+volumeName+',target=/app/data',
    '--mount','type=bind,source='+resolve(evidenceDir)+',target=/qualification,readonly',
    '--mount','type=bind,source='+resolve('testing/server')+',target=/app/testing/server,readonly','--workdir','/app'];
  for(const directory of ['/tmp','/run/postgresql','/data/downloads','/data/music','/data/staging','/data/transcode-temp']){
    args.push('--tmpfs',directory+':rw,nosuid,nodev,size=128m,mode=0770,uid=1000,gid=1000');
  }
  const env={POSTGRES_DB:'harmoniarr_backup_pg_crash_qualification',PGDATABASE:'harmoniarr_backup_pg_crash_qualification',PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'harmoniarr',PGDATA:'/app/data/postgres/18/data',HARMONIARR_MEMORY_PROFILE_GIB:'3',
    HARMONIARR_BACKUPS:'/app/data/backup-container-crash/backups',HARMONIARR_SECRET_ENCRYPTION_KEY:'0'.repeat(64),
    VAPID_CONTACT:'mailto:memory-qualification@example.invalid',VAPID_PUBLIC_KEY:'BN9CEVhAa-agHfE816dgSQUoOhYCng4hD86REpzvPg3wzlT8fr9LmvK60sb70uhX-vk0UFixyFak3dhk6SPyKRA',
    VAPID_PRIVATE_KEY:'tt5cAktvbcZtFB5tTbQr7eOaNWFH_-OvsAWx-yE9E00'};
  for(const [key,value]of Object.entries(env))args.push('--env',key+'='+value);
  return [...args,image];
}
