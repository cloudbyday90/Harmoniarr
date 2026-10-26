/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {validateBackupPgCrashOwnership,backupPgCrashData,backupPgCrashDatabase} from '../../testing/server/backup-pg-crash-profile.js';
import {assertBackupPgCrashMounts} from '../../testing/server/backup-pg-crash-container.js';

const profileId='00000000-0000-4000-8000-000000000001',containerId='a'.repeat(64),image='sha256:'+'b'.repeat(64);
const volumeName='harmoniarr-backup-pg-crash-'+profileId;
const manifest={profileId,volumeName,containerId,image,driver:'local'};
const context={hostname:containerId.slice(0,12),filesystem:'ext4',env:{PGHOST:'127.0.0.1',PGDATABASE:backupPgCrashDatabase,PGDATA:backupPgCrashData,HARMONIARR_MEMORY_PROFILE_GIB:'3'}};
const container=()=>({Image:image,Config:{User:'1000:1000',Labels:{'harmoniarr.backup-pg-crash':profileId}},
  HostConfig:{NetworkMode:'none',ReadonlyRootfs:true,Memory:3*1024**3,MemorySwap:3*1024**3,NanoCpus:2e9,PidsLimit:256,PortBindings:{}},
  Mounts:[{Destination:'/app/data',Type:'volume',Name:volumeName,Driver:'local',RW:true},{Destination:'/qualification',Type:'bind',RW:false}]});

test('persistent qualification accepts exact owned manifest without relaxing the tmpfs profile',()=>{
  assert.equal(validateBackupPgCrashOwnership(manifest,context),manifest);
  for(const filesystem of ['tmpfs','overlay',undefined])assert.throws(()=>validateBackupPgCrashOwnership(manifest,{...context,filesystem}));
});
test('persistent qualification refuses foreign containers, volumes, drivers and unexpected manifest fields',()=>{
  for(const change of [{volumeName:'live-data'},{containerId:'c'.repeat(64)},{profileId:'../live'},{image:'latest'},{driver:'nfs'},{extra:true}]){
    assert.throws(()=>validateBackupPgCrashOwnership({...manifest,...change},context));
  }
  assert.throws(()=>validateBackupPgCrashOwnership(manifest,{...context,hostname:'foreign'}));
});
test('persistent qualification refuses live database endpoints and undeclared resource/storage settings',()=>{
  for(const change of [{PGHOST:'remote'},{PGDATABASE:'harmoniarr'},{PGDATA:'/data/postgres'},{HARMONIARR_APPDATA:'/live'},{HARMONIARR_MEMORY_PROFILE_GIB:'2'}]){
    assert.throws(()=>validateBackupPgCrashOwnership(manifest,{...context,env:{...context.env,...change}}));
  }
});
test('Docker qualification refuses a host bind in place of its owned persistent volume',()=>{
  assertBackupPgCrashMounts(container(),volumeName,profileId,image);
  for(const change of [{Type:'bind'},{Name:'live-data'},{Driver:'nfs'},{RW:false}]){
    const value=container();Object.assign(value.Mounts[0],change);
    assert.throws(()=>assertBackupPgCrashMounts(value,volumeName,profileId,image));
  }
  const duplicate=container();duplicate.Mounts.push({...duplicate.Mounts[0]});assert.throws(()=>assertBackupPgCrashMounts(duplicate,volumeName,profileId,image));
});
test('Docker qualification refuses writable code/evidence, exposed ports and foreign runtime ownership',()=>{
  const mutations=[
    value=>{value.Mounts[1].RW=true;},value=>{value.HostConfig.NetworkMode='bridge';},
    value=>{value.HostConfig.PortBindings={'3000/tcp':[{HostPort:'3000'}]};},value=>{value.HostConfig.ReadonlyRootfs=false;},
    value=>{value.Config.User='0:0';},value=>{value.Config.Labels['harmoniarr.backup-pg-crash']='foreign';},
    value=>{value.Image='sha256:'+'c'.repeat(64);},value=>{value.HostConfig.MemorySwap=6*1024**3;},
  ];
  for(const mutate of mutations){const value=container();mutate(value);assert.throws(()=>assertBackupPgCrashMounts(value,volumeName,profileId,image));}
});
