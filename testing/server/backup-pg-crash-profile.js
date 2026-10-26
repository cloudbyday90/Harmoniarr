/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { artworkWorkerCgroup } from './artwork-worker-cgroup.js';

export const backupPgCrashDatabase='harmoniarr_backup_pg_crash_qualification';
export const backupPgCrashData='/app/data/postgres/18/data';
export function validateBackupPgCrashOwnership(manifest,{env=process.env,hostname,filesystem}){
  assert.deepEqual(Object.keys(manifest).sort(),['containerId','driver','image','profileId','volumeName'].sort());
  assert.match(manifest.profileId,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
  assert.equal(manifest.volumeName,'harmoniarr-backup-pg-crash-'+manifest.profileId);
  assert.match(manifest.containerId,/^[a-f0-9]{64}$/u);assert.equal(hostname,manifest.containerId.slice(0,12));
  assert.match(manifest.image,/^sha256:[a-f0-9]{64}$/u);assert.equal(manifest.driver,'local');
  assert.equal(env.PGHOST,'127.0.0.1');assert.equal(env.PGDATABASE,backupPgCrashDatabase);assert.equal(env.PGDATA,backupPgCrashData);
  assert.ok(!env.HARMONIARR_APPDATA||env.HARMONIARR_APPDATA==='/app/data');
  assert.ok(['ext4','xfs','btrfs','zfs'].includes(filesystem),'Require persistent Linux volume storage');
  assert.equal(env.HARMONIARR_MEMORY_PROFILE_GIB,'3');
  return manifest;
}
export async function requireBackupPgCrashProfile(){
  const manifest=JSON.parse(await readFile('/qualification/ownership.json','utf8'));
  const mount=(await readFile('/proc/self/mountinfo','utf8')).split('\n').find(line=>line.split(' ')[4]==='/app/data');
  validateBackupPgCrashOwnership(manifest,{hostname:(await readFile('/etc/hostname','utf8')).trim(),filesystem:mount?.split(' - ')[1]?.split(' ')[0]});
  assert.equal(process.getuid(),1000);
  const profile=await artworkWorkerCgroup({memoryBytes:3*1024**3,cpus:2,pids:256});
  process.env.VAPID_CONTACT='mailto:memory-qualification@example.invalid';
  process.env.VAPID_PUBLIC_KEY='BN9CEVhAa-agHfE816dgSQUoOhYCng4hD86REpzvPg3wzlT8fr9LmvK60sb70uhX-vk0UFixyFak3dhk6SPyKRA';
  process.env.VAPID_PRIVATE_KEY='tt5cAktvbcZtFB5tTbQr7eOaNWFH_-OvsAWx-yE9E00';
  return {manifest,profile};
}
