/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile,stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { backupPgCrashData,requireBackupPgCrashProfile } from './backup-pg-crash-profile.js';

const execute=promisify(execFile);
export async function createBackupPgCrashControl(){
  await requireBackupPgCrashProfile();
  const options={windowsHide:true,timeout:15_000,maxBuffer:262_144,env:{...process.env,LC_ALL:'C'}};
  const run=async(binary,args)=>(await execute(binary,args,options)).stdout;
  // Resolve installed tools, then require both to live beside the running server executable.
  const pid=Number((await readFile(backupPgCrashData+'/postmaster.pid','utf8')).split('\n')[0]);
  assert.ok(Number.isInteger(pid)&&pid>1);
  const {readlink}=await import('node:fs/promises');
  const executable=await readlink('/proc/'+pid+'/exe'),directory=executable.slice(0,executable.lastIndexOf('/'));
  assert.match(executable,/\/postgres$/u);
  const ctl=directory+'/pg_ctl',controldata=directory+'/pg_controldata';
  const control=async()=>{
    const text=await run(controldata,['-D',backupPgCrashData]);
    const field=name=>{const value=text.split('\n').find(line=>line.startsWith(name+':'))?.split(':').slice(1).join(':').trim();assert.ok(value);return value;};
    return {identifier:field('Database system identifier'),state:field('Database cluster state')};
  };
  let stopped=false;
  return {
    control,
    async stop(){
      assert.equal(stopped,false);const before=await control();assert.equal(before.state,'in production');
      const oldPid=Number((await readFile(backupPgCrashData+'/postmaster.pid','utf8')).split('\n')[0]);
      await run(ctl,['-D',backupPgCrashData,'-m','immediate','-w','-t','10','stop']);stopped=true;
      await assert.rejects(stat(backupPgCrashData+'/postmaster.pid'),{code:'ENOENT'});
      const after=await control();assert.deepEqual(after,before);
      await assert.rejects(run(ctl,['-D',backupPgCrashData,'status']),error=>error.code===3);
      return {identifier:before.identifier,oldPid,uncleanControlState:true};
    },
    async start(checkpoint){
      assert.equal(stopped,true);assert.match(checkpoint,/^[a-z-]+$/u);
      const log='/app/data/'+checkpoint+'-restart.log';
      await run(ctl,['-D',backupPgCrashData,'-l',log,'-w','-t','10','start','-o','-c listen_addresses=127.0.0.1 -c port=5432 -c unix_socket_directories=/run/postgresql']);
      stopped=false;
      const metadata=await stat(log);assert.ok(metadata.size<=262_144);
      const text=await readFile(log,'utf8');
      for(const pattern of [/database system was interrupted/u,/redo starts at/u,/redo done at/u,/database system is ready to accept connections/u])assert.match(text,pattern);
      const current=await control();assert.equal(current.state,'in production');
      return {...current,newPid:Number((await readFile(backupPgCrashData+'/postmaster.pid','utf8')).split('\n')[0]),walRedoObserved:true};
    },
  };
}
