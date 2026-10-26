/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import {parseArgs} from 'node:util';
import {runBackupPgCrashContainer} from '../testing/server/backup-pg-crash-container.js';
const {values}=parseArgs({options:{image:{type:'string'},'evidence-dir':{type:'string'}}});
if(!values.image||!values['evidence-dir'])throw new TypeError('Provide --image sha256:<local-image-id> --evidence-dir <fresh-directory>');
const result=await runBackupPgCrashContainer({image:values.image,evidenceDir:values['evidence-dir']});
console.log(JSON.stringify({image:result.image,tests:result.tests,cases:result.measurements[0].cases.length,persistentVolumeRemoved:true}));
