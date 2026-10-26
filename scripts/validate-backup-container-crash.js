/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import {parseArgs} from 'node:util';
import {runBackupContainerCrashQualification} from '../testing/server/backup-container-crash-runner.js';
const {values}=parseArgs({options:{image:{type:'string'},'evidence-dir':{type:'string'}}});
if(!values.image||!values['evidence-dir'])throw new TypeError('Provide --image sha256:<local-image-id> --evidence-dir <fresh-directory>');
const result=await runBackupContainerCrashQualification({image:values.image,evidenceDir:values['evidence-dir'],onProgress:value=>console.log(JSON.stringify(value))});
console.log(JSON.stringify({image:result.image,cases:result.cases.length,ownedResourcesRemoved:true}));
