/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,open,stat,readFile} from 'node:fs/promises';
import {join} from 'node:path';

export const backupContainerRoot='/app/data/backup-container-crash';
export const backupContainerBackups=join(backupContainerRoot,'backups');
export const backupContainerLog=join(backupContainerRoot,'logs','container-recovery.log');
export const backupContainerHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function backupContainerSnapshot(client,plan){
  const operations=(await client.query('SELECT * FROM backup_artifact_file_operations WHERE filename=$1 AND operation_type=$2',[plan.checkpoint+'.json',plan.operation])).rows;
  assert.ok(operations.length<=1);
  return {operation:operations[0]??null,inventory:(await client.query('SELECT * FROM backup_artifacts WHERE filename=$1',[plan.checkpoint+'.json'])).rows};
}
export async function backupContainerBytes(path,expected,content){
  if(expected==='missing'){if(path)await assert.rejects(readFile(path),{code:'ENOENT'});return;}
  assert.equal(await readFile(path,'utf8'),content);
}
export async function writeBackupContainerRecord(checkpoint,record){
  const directory=join(backupContainerRoot,'records');await mkdir(directory,{recursive:true,mode:0o700});
  const text=JSON.stringify(record);assert.ok(Buffer.byteLength(text)<=65_536);
  const handle=await open(join(directory,checkpoint+'.json'),'wx',0o600);
  try{await handle.writeFile(text);await handle.sync();}finally{await handle.close();}
  const folder=await open(directory,'r');try{await folder.sync();}finally{await folder.close();}
  return backupContainerHash(text);
}
export async function readBackupContainerRecord(checkpoint,expectedHash){
  const path=join(backupContainerRoot,'records',checkpoint+'.json');assert.ok((await stat(path)).size<=65_536);
  const text=await readFile(path,'utf8');assert.equal(backupContainerHash(text),expectedHash);return JSON.parse(text);
}
