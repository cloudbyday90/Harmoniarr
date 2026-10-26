<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import {computed} from 'vue';
import {RouterLink} from 'vue-router';
import {buildBackupRecoveryStatus} from '../lib/backup-recovery-presentation.js';
import {buildOperationRunLinkTarget} from '../lib/operation-run-link-targets.js';
const props=defineProps({status:{type:Object,default:null},loading:{type:Boolean,default:false}});
const presentation=computed(()=>buildBackupRecoveryStatus(props.status,{loading:props.loading}));
const job=computed(()=>props.status?.runId?buildOperationRunLinkTarget({operationType:'backup_artifact_recovery',runId:props.status.runId}):null);
</script>
<template>
  <section aria-label="Startup backup recovery">
    <p role="status" aria-atomic="true" :data-state="presentation.state">{{ presentation.message }}</p>
    <p class="hx-text-muted">Refresh status for the latest result. Recovery never bypasses a confirmation requirement.</p>
    <RouterLink v-if="job" :to="job.to">View backup recovery job</RouterLink>
  </section>
</template>
