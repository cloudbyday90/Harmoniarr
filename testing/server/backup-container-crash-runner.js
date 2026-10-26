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
import {backupSqlCrashPlan} from './backup-sql-crash-plan.js';
import {backupContainerCreateArgs,assertBackupContainerRuntime} from './backup-container-lifecycle.js';
import {startBackupContainerProbe} from './backup-container-probe.js';

export async function runBackupContainerCrashQualification({image,evidenceDir,onProgress=()=>{}}){
  assert.match(image,/^sha256:[a-f0-9]{64}$/u);
  const root=resolve(evidenceDir);await mkdir(root,{recursive:true});
  const profileId=randomUUID(),volumeName='harmoniarr-backup-pg-crash-'+profileId,execute=promisify(execFile),containers=new Set(),probes=new Set(),cases=[];
  const docker=async args=>(await execute('docker',args,{windowsHide:true,maxBuffer:2*1024**2,timeout:30_000})).stdout;
  const logsFor=async id=>{const result=await execute('docker',['logs',id],{windowsHide:true,maxBuffer:2*1024**2,timeout:30_000});return result.stdout+result.stderr;};
  const save=(name,value)=>writeFile(resolve(root,name),JSON.stringify(value,null,2),{flag:'wx'});
  await save('invocation.json',{profileId,volumeName,image});
  let volumeCreated=false;
  const inspect=async id=>JSON.parse(await docker(['inspect',id]))[0];
  const ownedVolume=async()=>{
    const row=JSON.parse(await docker(['volume','inspect',volumeName]))[0];
    assert.equal(row.Name,volumeName);assert.equal(row.Driver,'local');assert.equal(row.Labels['harmoniarr.backup-pg-crash'],profileId);
  };
  async function remove(id){
    const row=await inspect(id);assertBackupContainerRuntime(row,volumeName,profileId,image);
    await withWorkerTaskCleanup(async()=>writeFile(resolve(root,id+'-container.log'),await logsFor(id),{flag:'wx'}),async()=>{
      await docker(['rm','--force','--volumes',id]);assert.equal((await docker(['ps','-aq','--no-trunc','--filter','id='+id])).trim(),'');containers.delete(id);
    });
  }
  async function create(index){
    await ownedVolume();const directory=resolve(root,'container-'+index);await mkdir(directory);
    const id=(await docker(backupContainerCreateArgs({image,volumeName,profileId,evidenceDir:directory}))).trim();assert.match(id,/^[a-f0-9]{64}$/u);containers.add(id);
    assertBackupContainerRuntime(await inspect(id),volumeName,profileId,image);
    await writeFile(resolve(directory,'ownership.json'),JSON.stringify({profileId,volumeName,containerId:id,driver:'local',image}),{flag:'wx'});
    await docker(['start',id]);const deadline=Date.now()+45_000;
    for(;;){
      const row=await inspect(id);assertBackupContainerRuntime(row,volumeName,profileId,image);
      if(!row.State.Running)throw new Error('Replacement server failed startup');
      if(row.State.Health?.Status==='healthy')break;
      assert.ok(Date.now()<deadline,'container must become healthy');await new Promise(finish=>{setTimeout(finish,250);});
    }
    const logs=await logsFor(id);assert.match(logs,/applied 0 migration\(s\); verified 115 applied, 0 pending/u);
    return id;
  }
  function probe(phase,checkpoint,id,expected=[]){const value=startBackupContainerProbe({phase,checkpoint,containerId:id,expected});probes.add(value);return value;}
  return withWorkerTaskCleanup(async()=>{
    assert.ok(!(await docker(['volume','ls','--format','{{.Name}}'])).split(/\r?\n/u).includes(volumeName));
    assert.equal((await docker(['volume','create','--driver','local','--label','harmoniarr.backup-pg-crash='+profileId,volumeName])).trim(),volumeName);volumeCreated=true;
    let current=await create(0);
    const deadline=Date.now()+600_000;
    for(const [index,plan]of backupSqlCrashPlan.entries()){
      assert.ok(Date.now()<deadline,'container matrix must finish within its bound');
      const preparation=probe('prepare',plan.checkpoint,current),prepared=await preparation.waitReady();
      const running=await inspect(current);assertBackupContainerRuntime(running,volumeName,profileId,image);assert.equal(running.State.Running,true);
      await docker(['kill','--signal','KILL',current]);assert.equal((await docker(['wait',current])).trim(),'137');
      const stopped=await inspect(current);assert.equal(stopped.State.Running,false);assert.equal(stopped.State.ExitCode,137);assert.equal(stopped.State.OOMKilled,false);
      await preparation.complete(137);assert.equal(preparation.isClosed(),true);probes.delete(preparation);
      const previous=current;await remove(previous);await ownedVolume();
      current=await create(index+1);assert.notEqual(current,previous);
      const verification=probe('verify',plan.checkpoint,current,[prepared.snapshotSha256,prepared.clusterId]),verified=await verification.waitReady();
      await verification.complete(0);assert.equal(verification.isClosed(),true);probes.delete(verification);
      assert.equal(verified.snapshotSha256,prepared.snapshotSha256);assert.equal(verified.clusterId,prepared.clusterId);
      const logs=await logsFor(current);await writeFile(resolve(root,plan.checkpoint+'-startup.log'),logs,{flag:'wx'});
      const result={checkpoint:plan.checkpoint,outcome:plan.mode,previous,current,clusterId:verified.clusterId,snapshotSha256:verified.snapshotSha256,
        killedExit137:true,noOom:true,oldContainerRemoved:true,sameVolume:true,productionEntrypoint:true,httpAndSchemaReady:true,
        walRedoObserved:true,preCrashRecordVerified:true,automaticStartupRecovery:verified.automaticStartupRecovery===true,
        repeatedRecovery:true,currentBytesAndCatalogVerified:true};
      cases.push(result);await save(plan.checkpoint+'-result.json',result);onProgress({completed:cases.length,total:backupSqlCrashPlan.length,checkpoint:plan.checkpoint});
    }
    const result={image,cases,fullServerStartup:true,backgroundServicesEnabled:true,productionRuntimeUnmodified:true,powerLossNotTested:true};
    await save('native-result.json',result);return result;
  },async()=>{
    const removed=await Promise.allSettled([...containers].map(remove));
    const diagnostics=await Promise.allSettled([...probes].map((value,index)=>value.diagnostics()?writeFile(resolve(root,'probe-failure-'+index+'.log'),value.diagnostics(),{flag:'wx'}):Promise.resolve()));
    const closed=await Promise.allSettled([...probes].map(value=>value.dispose()));
    assert.equal(containers.size,0);assert.ok([...probes].every(value=>value.isClosed()),'all owned container/probe removal must be verified before volume removal');
    if(volumeCreated){await ownedVolume();await docker(['volume','rm',volumeName]);assert.ok(!(await docker(['volume','ls','--format','{{.Name}}'])).split(/\r?\n/u).includes(volumeName));}
    await save('retirement.json',{volumeName,containersRemoved:true,probesClosed:true,volumeRemoved:volumeCreated,absenceVerified:true});
    assert.ok([...removed,...diagnostics,...closed].every(row=>row.status==='fulfilled'),'cleanup diagnostics must preserve their failure after resource retirement');
  });
}
