/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import {requireBackupPgCrashProfile} from './backup-pg-crash-profile.js';
import {getBackupSqlCrashCase} from './backup-sql-crash-plan.js';
import {backupContainerBackups} from './backup-container-record.js';
import {backupContainerProtocolPrefix} from './backup-container-protocol.js';
import {prepareBackupContainer} from './backup-container-prepare.js';
import {verifyBackupContainer} from './backup-container-verify.js';

const {manifest}=await requireBackupPgCrashProfile();
const [phase,checkpoint,expectedHash,expectedClusterId]=process.argv.slice(2),plan=getBackupSqlCrashCase(checkpoint);
assert.ok(['prepare','verify'].includes(phase));assert.equal(process.env.HARMONIARR_BACKUPS,backupContainerBackups);
const health=await fetch('http://127.0.0.1:3000/healthz',{signal:AbortSignal.timeout(5000)});
assert.equal(health.status,200,JSON.stringify(await health.json()));
const send=value=>{process.stdout.write(backupContainerProtocolPrefix+JSON.stringify(value)+'\n');};
if(phase==='prepare')await prepareBackupContainer(plan,manifest,send);
else send(await verifyBackupContainer(plan,manifest,expectedHash,expectedClusterId));
