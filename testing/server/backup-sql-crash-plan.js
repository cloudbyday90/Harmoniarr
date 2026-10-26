/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const targets=[
  ['publish-intent','publish','journal','INSERT','prepared',null,'prepared','missing','missing',0,0,'none','missing-tree'],
  ['temporary-ready','publish','journal','UPDATE','temporary_ready','prepared','temporary_ready','complete','missing',0,0,'completed','completed'],
  ['publish-finalized','publish','journal','UPDATE','finalized','temporary_ready','finalized','missing','complete',0,0,'completed','completed'],
  ['catalog-insert','publish','catalog','INSERT','*','finalized','finalized','missing','complete',0,1,'completed','completed'],
  ['publish-completed','publish','journal','UPDATE','completed','finalized','completed','missing','complete',1,1,'completed','terminal'],
  ['delete-intent','delete','journal','INSERT','prepared',null,'prepared','missing','complete',1,1,'none','completed'],
  ['delete-finalized','delete','journal','UPDATE','finalized','prepared','finalized','missing','missing',1,1,'completed','completed'],
  ['catalog-delete','delete','catalog','DELETE','*','finalized','finalized','missing','missing',1,0,'completed','completed'],
  ['delete-completed','delete','journal','UPDATE','completed','finalized','completed','missing','missing',0,0,'completed','terminal'],
];
export const backupSqlCrashPlan=Object.freeze(targets.flatMap(([target,operation,table,verb,phase,before,after,temporary,final,catalogBefore,catalogAfter,rollbackRecovery,ackRecovery],index)=>
  ['wait-rollback','lost-ack'].map(mode=>Object.freeze({checkpoint:target+'-'+mode,target,operation,table:table==='journal'?'backup_artifact_file_operations':'backup_artifacts',
    verb,phase,mode,gateKey:index+1,expectedPhase:mode==='wait-rollback'?before:after,temporary,final,
    catalog:mode==='wait-rollback'?catalogBefore:catalogAfter,recovery:mode==='wait-rollback'?rollbackRecovery:ackRecovery}))));
export function getBackupSqlCrashCase(checkpoint){
  const plan=backupSqlCrashPlan.find(row=>row.checkpoint===checkpoint);
  if(!plan)throw new TypeError('Unsupported backup SQL crash checkpoint');
  return plan;
}
