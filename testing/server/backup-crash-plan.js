/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const publication = [
  ['intent-recorded','prepared','missing','missing',0,'missing-tree'],
  ['directories-ready','prepared','missing','missing',0,'abandoned'],
  ['bytes-written','prepared','complete','missing',0,'completed'],
  ['file-closed','prepared','complete','missing',0,'completed'],
  ['temporary-ready','temporary_ready','complete','missing',0,'completed'],
  ['link-created','temporary_ready','complete','complete',0,'completed'],
  ['final-directory-synced','temporary_ready','complete','complete',0,'completed'],
  ['temporary-unlinked','temporary_ready','missing','complete',0,'completed'],
  ['temporary-directory-synced','temporary_ready','missing','complete',0,'completed'],
  ['publish-finalized','finalized','missing','complete',0,'completed'],
  ['catalog-created','finalized','missing','complete',1,'completed'],
  ['publish-completed','completed','missing','complete',1,'terminal'],
];
const deletion = [
  ['delete-intent','prepared','missing','complete',1,'completed'],
  ['file-unlinked','prepared','missing','missing',1,'completed'],
  ['deletion-directory-synced','prepared','missing','missing',1,'completed'],
  ['delete-finalized','finalized','missing','missing',1,'completed'],
  ['catalog-deleted','finalized','missing','missing',0,'completed'],
  ['delete-completed','completed','missing','missing',0,'terminal'],
];
const entry = operation => ([checkpoint,phase,temporary,final,catalog,recovery]) => Object.freeze({checkpoint,operation,phase,temporary,final,catalog,recovery});
export const backupCrashPlan = Object.freeze([
  ...publication.map(entry('publish')),...deletion.map(entry('delete')),
  entry('publish')(['partial-write','prepared','partial','missing',0,'confirmation']),
]);
export function getBackupCrashCase(checkpoint) {
  const selected = backupCrashPlan.find(row => row.checkpoint === checkpoint);
  if (!selected) throw new TypeError('Unsupported backup crash checkpoint');
  return selected;
}
