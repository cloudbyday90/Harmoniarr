/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import {withWorkerTaskCleanup} from '../../src/server/worker-task-cleanup.js';

export function assertBackupPgCrashMounts(container,volumeName,profileId,image){
  assert.equal(container.Image,image);assert.equal(container.Config.Labels['harmoniarr.backup-pg-crash'],profileId);
  assert.equal(container.HostConfig.NetworkMode,'none');assert.equal(container.HostConfig.ReadonlyRootfs,true);
  assert.equal(container.Config.User,'1000:1000');assert.equal(container.HostConfig.Memory,3*1024**3);
  assert.equal(container.HostConfig.MemorySwap,3*1024**3);assert.equal(container.HostConfig.NanoCpus,2e9);assert.equal(container.HostConfig.PidsLimit,256);
  assert.deepEqual(container.HostConfig.PortBindings,{});
  const data=container.Mounts.filter(row=>row.Destination==='/app/data');
  assert.equal(data.length,1);assert.equal(data[0].Type,'volume');assert.equal(data[0].Name,volumeName);assert.equal(data[0].Driver,'local');assert.equal(data[0].RW,true);
  for(const mount of container.Mounts.filter(row=>row.Type==='bind'))assert.equal(mount.RW,false);
}
export async function runBackupPgCrashContainer({image,evidenceDir}){
  assert.match(image,/^sha256:[a-f0-9]{64}$/u);
  const root=resolve(evidenceDir);await mkdir(root,{recursive:true});
  // A fresh directory is required: do not overwrite another run's ownership evidence.
  const profileId=randomUUID(),volumeName='harmoniarr-backup-pg-crash-'+profileId;
  const execute=promisify(execFile);
  const docker=async args=>(await execute('docker',args,{windowsHide:true,maxBuffer:8*1024**2,timeout:180_000})).stdout;
  const save=(name,value)=>writeFile(resolve(root,name),JSON.stringify(value,null,2),{flag:'wx'});
  await save('invocation.json',{profileId,volumeName,image});
  let volumeCreated=false,id;
  const volumeOwned=async()=>{
    const volume=JSON.parse(await docker(['volume','inspect',volumeName]))[0];
    assert.equal(volume.Name,volumeName);assert.equal(volume.Driver,'local');assert.equal(volume.Labels['harmoniarr.backup-pg-crash'],profileId);
  };
  return withWorkerTaskCleanup(async()=>{
    assert.equal((await docker(['volume','create','--driver','local','--label','harmoniarr.backup-pg-crash='+profileId,volumeName])).trim(),volumeName);
    volumeCreated=true;await volumeOwned();
    const args=['create','--label','harmoniarr.backup-pg-crash='+profileId,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true',
      '--user','1000:1000','--pids-limit','256','--cpus','2','--memory','3g','--memory-swap','3g','--shm-size','128m',
      '--mount','type=volume,source='+volumeName+',target=/app/data',
      '--tmpfs','/tmp:rw,nosuid,nodev,size=256m,mode=1777','--tmpfs','/run/postgresql:rw,nosuid,nodev,size=32m,mode=0770,uid=1000,gid=1000',
      '--mount','type=bind,source='+root+',target=/qualification,readonly','--workdir','/app',
      '--env','POSTGRES_DB=harmoniarr_backup_pg_crash_qualification','--env','PGDATA=/app/data/postgres/18/data','--env','HARMONIARR_MEMORY_PROFILE_GIB=3',
      '--env','HARMONIARR_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000'];
    for(const path of ['src/server','src/shared','testing/server','testing/operation-run-lease-fixtures.js','testing/fixtures/provider-https','testing/integration/fixture-lifecycle.js','testing/integration/metadata-fixtures.js','test/native/backup-postgres-crash.test.js']){
      args.push('--mount','type=bind,source='+resolve(path)+',target=/app/'+path+',readonly');
    }
    id=(await docker([...args,image,'node','--test','--test-concurrency=1','--test-reporter=tap','test/native/backup-postgres-crash.test.js'])).trim();
    assert.match(id,/^[a-f0-9]{64}$/u);
    let container=JSON.parse(await docker(['inspect',id]))[0];assertBackupPgCrashMounts(container,volumeName,profileId,image);
    await save('ownership.json',{profileId,volumeName,containerId:id,driver:'local',image});
    let output;
    try{output=await docker(['start','--attach',id]);}
    catch(error){await writeFile(resolve(root,'native.log'),(error.stdout??'')+(error.stderr??''),{flag:'wx'});throw error;}
    await writeFile(resolve(root,'native.log'),output,{flag:'wx'});
    container=JSON.parse(await docker(['inspect',id]))[0];assertBackupPgCrashMounts(container,volumeName,profileId,image);
    assert.equal(container.State.Running,false);assert.equal(container.State.ExitCode,0);assert.equal(container.State.OOMKilled,false);
    for(const [key,count]of [['tests',1],['pass',1],['fail',0],['cancelled',0],['skipped',0]])assert.match(output,new RegExp('^# '+key+' '+count+'$','mu'));
    const measurements=output.split('\n').filter(line=>line.startsWith('# {')).map(line=>JSON.parse(line.slice(2)));assert.equal(measurements.length,1);
    const result={image,memoryGiB:3,tests:1,measurements};await save('native-result.json',result);return result;
  },async()=>{
    if(id){
      const owned=JSON.parse(await docker(['inspect',id]))[0];assert.equal(owned.Config.Labels['harmoniarr.backup-pg-crash'],profileId);assert.equal(owned.Id,id);
      await docker(['rm','--force','--volumes',id]);assert.equal((await docker(['ps','-aq','--no-trunc','--filter','id='+id])).trim(),'');
    }
    if(volumeCreated){await volumeOwned();await docker(['volume','rm',volumeName]);assert.ok(!(await docker(['volume','ls','--format','{{.Name}}'])).split(/\r?\n/u).includes(volumeName));}
    await save('retirement.json',{id,volumeName,containerRemoved:Boolean(id),volumeRemoved:volumeCreated,absenceVerified:true});
  });
}
