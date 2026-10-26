/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getBackupCrashCase } from './backup-crash-plan.js';

const failure = code => Object.assign(new Error('Backup crash fixture process failed'), {code});
const validPid = value => Number.isInteger(value) && value > 1 && value <= 2_147_483_647;
const countKeys = ['completedCount','deferredCount','awaitingConfirmationCount','abandonedCount'];
function validCounts(value) {
  return value && Object.keys(value).length === countKeys.length && countKeys.every(key=>Number.isInteger(value[key])&&value[key]>=0&&value[key]<=19);
}

/** Own one child only. A kill request never substitutes for observed process/stdio close. */
export function createBackupCrashProcessRunner({getCase=getBackupCrashCase,childModuleUrl=new URL('./backup-crash-child.js',import.meta.url),allowDispatch=false}={}) {
return function start({mode,checkpoint,root,signal,pgPort,spawnFn=spawn}={}) {
  signal?.throwIfAborted();getCase(checkpoint);
  if (!['crash','recover'].includes(mode)||typeof root!=='string'||!root.trim()||root.includes('\0')) throw new TypeError('Invalid backup crash process input');
  if(pgPort!==undefined&&(!allowDispatch||!Number.isInteger(pgPort)||pgPort<1||pgPort>65535))throw new TypeError('Invalid fixture PostgreSQL port');
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(?:PATH|SYSTEMROOT|WINDIR|TEMP|TMP|LANG|TZ|PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE|PGDATA|POSTGRES_USER|POSTGRES_PASSWORD|HARMONIARR_APPDATA|HARMONIARR_MEMORY_PROFILE_GIB|HARMONIARR_ENCRYPTION_KEY)$/u.test(key)));
  env.HARMONIARR_BACKUPS=root;
  if(pgPort!==undefined)env.PGPORT=String(pgPort);
  const child=spawnFn(process.execPath,[fileURLToPath(childModuleUrl),mode,checkpoint,root],
    {env,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true,shell:false});
  const ready=Promise.withResolvers(),closed=Promise.withResolvers(),fault=Promise.withResolvers();
  let result,closeResult,failed=false,primaryFailure,bytes=0,seen=false,dispatched=false;
  const fail=code=>{if(!failed){failed=true;primaryFailure=failure(code);fault.resolve({error:primaryFailure});}};
  child.on('error',()=>fail('fixture_spawn_failed'));
  child.once('close',(code,exitSignal)=>{closeResult={code,signal:exitSignal};closed.resolve(closeResult);});
  const collect=chunk=>{bytes+=chunk.length;if(bytes>32_768)fail('fixture_output_budget');};
  for(const stream of [child.stdout,child.stderr]){stream.on('data',collect);stream.on('error',()=>fail('fixture_output_failed'));}
  child.on('message',message=>{
    if(seen||!message||message.processPid!==child.pid||message.checkpoint!==checkpoint){fail('fixture_protocol_failed');return;}
    if(mode==='crash'&&message.event==='checkpoint'&&validPid(message.backendPid)&&Object.keys(message).length===4){seen=true;result=message;ready.resolve({value:message});return;}
    if(mode==='recover'&&message.event==='recovered'&&validCounts(message.first)&&validCounts(message.second)&&Object.keys(message).length===5){seen=true;result=message;ready.resolve({value:message});return;}
    fail('fixture_protocol_failed');
  });
  async function bounded(promise,milliseconds){
    let timer;
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(failure('fixture_wait_expired')),milliseconds);})]);}
    finally{clearTimeout(timer);}
  }
  const abort=()=>fail('fixture_aborted');signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  async function waitReady(){
    if(failed)throw primaryFailure;
    const outcome=await bounded(Promise.race([ready.promise,fault.promise,closed.promise.then(()=>({error:failure('fixture_closed_before_ack')}))]),15_000);
    if(failed)throw primaryFailure;
    if(outcome.error)throw outcome.error;
    return outcome.value;
  }
  async function killAndClose(){
    if(!closeResult&&validPid(child.pid))child.kill('SIGKILL');
    return bounded(closed.promise,5000);
  }
  async function crash(){
    if(mode!=='crash'||!seen||failed)throw failure('fixture_crash_not_acknowledged');
    const outcome=await killAndClose();
    if(outcome.code!==null||outcome.signal!=='SIGKILL')throw failure('fixture_abrupt_exit_unverified');
    return outcome;
  }
  async function complete(){
    if(mode!=='recover')throw failure('fixture_wrong_mode');
    await waitReady();const outcome=await bounded(Promise.race([closed.promise,fault.promise.then(value=>{throw value.error;})]),15_000);
    if(failed||outcome.code!==0||outcome.signal)throw failure('fixture_recovery_exit_failed');
    return result;
  }
  async function dispose(){
    try{await killAndClose();}finally{signal?.removeEventListener('abort',abort);}
  }
  async function dispatch(){
    if(!allowDispatch||mode!=='crash'||!seen||failed||dispatched||closeResult)throw failure('fixture_dispatch_not_acknowledged');
    dispatched=true;
    await bounded(new Promise((resolve,reject)=>{child.send({event:'dispatch'},error=>error?reject(failure('fixture_dispatch_failed')):resolve());}),5000);
  }
  return {pid:child.pid,waitReady,crash,complete,dispose,...(allowDispatch?{dispatch}:{}),isClosed:()=>Boolean(closeResult),outputBytes:()=>bytes};
};
}
export const startBackupCrashProcess=createBackupCrashProcessRunner();
