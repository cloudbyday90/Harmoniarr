/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import {spawn} from 'node:child_process';
import {backupContainerProtocolPrefix,parseBackupContainerMessage} from './backup-container-protocol.js';
import {getBackupSqlCrashCase} from './backup-sql-crash-plan.js';

const failure=code=>Object.assign(new Error('Backup container probe failed'),{code});
export function startBackupContainerProbe({phase,checkpoint,containerId,expected=[],spawnFn=spawn}){
  if(!['prepare','verify'].includes(phase)||!/^[a-f0-9]{64}$/u.test(containerId))throw new TypeError('Invalid container probe');
  getBackupSqlCrashCase(checkpoint);
  if(!Array.isArray(expected)||(phase==='prepare'?expected.length!==0:expected.length!==2||!/^[a-f0-9]{64}$/u.test(expected[0])||!/^\d{1,20}$/u.test(expected[1])))throw new TypeError('Invalid expected container record');
  const child=spawnFn('docker',['exec',containerId,'node','/app/testing/server/backup-container-stage.js',phase,checkpoint,...expected],{windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
  const ready=Promise.withResolvers(),closed=Promise.withResolvers(),fault=Promise.withResolvers();
  let result,outcome,primary,bytes=0,pending='',diagnostics='';
  const fail=code=>{primary??=failure(code);fault.resolve({error:primary});};
  child.on('error',()=>fail('probe_spawn_failed'));
  child.once('close',(code,signal)=>{outcome={code,signal};closed.resolve(outcome);});
  child.stderr.on('data',chunk=>{bytes+=chunk.length;if(bytes>32768)fail('probe_output_budget');else diagnostics+=chunk.toString('utf8');});
  child.stdout.on('data',chunk=>{
    bytes+=chunk.length;if(bytes>32768){fail('probe_output_budget');return;}
    pending+=chunk.toString('utf8');
    let index;
    while((index=pending.indexOf('\n'))>=0){
      const line=pending.slice(0,index).trimEnd();pending=pending.slice(index+1);
      if(!line)continue;
      try{
        if(result||!line.startsWith(backupContainerProtocolPrefix))throw failure('probe_protocol_failed');
        result=parseBackupContainerMessage(line,{phase,checkpoint,containerId});ready.resolve({value:result});
      }catch{fail('probe_protocol_failed');}
    }
  });
  for(const stream of [child.stdout,child.stderr])stream.on('error',()=>fail('probe_stream_failed'));
  async function bounded(task){
    let timer;
    try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(failure('probe_wait_expired')),30_000);})]);}
    finally{clearTimeout(timer);}
  }
  async function waitReady(){
    if(primary)throw primary;
    const value=await bounded(Promise.race([ready.promise,fault.promise,closed.promise.then(()=>({error:failure('probe_closed_before_ready')}))]));
    if(primary)throw primary;if(value.error)throw value.error;return value.value;
  }
  async function complete(code){
    if(primary)throw primary;
    const value=await bounded(Promise.race([closed.promise,fault.promise.then(row=>{throw row.error;})]));
    if(primary)throw primary;
    if(!result||value.code!==code||value.signal||pending.trim())throw failure('probe_close_unverified');
    return result;
  }
  return {waitReady,complete,
    async dispose(){if(!outcome)child.kill('SIGKILL');await bounded(closed.promise);},
    isClosed:()=>Boolean(outcome),diagnostics:()=>diagnostics};
}
