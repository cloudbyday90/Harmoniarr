<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { nextTick, useId } from 'vue';
import SettingsFormGroup from './SettingsFormGroup.vue';
import { buildDownloadMappingSourceLabel } from '../../lib/settings-media-storage-presentation.js';
import { removeSettingsRowWithFocus } from '../../lib/settings-row-removal.js';

const props = defineProps({ position: { required: true, type: Number }, addButton: { default: null, type: Object } });
const sourcePrefix = defineModel('sourcePrefix', { required: true, type: String });
const targetPrefix = defineModel('targetPrefix', { required: true, type: String });
const emit = defineEmits(['remove']);
const fieldId = useId();
function removeRow(event) {
  return removeSettingsRowWithFocus({ invoker: event.currentTarget, addButton: props.addButton, remove: () => emit('remove'), afterUpdate: nextTick });
}
</script>

<template>
  <div class="cfg-mapping-card">
    <SettingsFormGroup :title="`Path translation ${position}`">
      <div class="hx-form-row">
        <div class="hx-field">
          <label class="hx-field-label" :for="`${fieldId}-source`">{{ buildDownloadMappingSourceLabel() }}</label>
          <input :id="`${fieldId}-source`" class="hx-input" v-model="sourcePrefix" placeholder="/downloads/complete" />
        </div>
        <div class="hx-field">
          <label class="hx-field-label" :for="`${fieldId}-target`">Harmoniarr sees it as</label>
          <input :id="`${fieldId}-target`" class="hx-input" v-model="targetPrefix" placeholder="/data/downloads/complete" />
        </div>
      </div>
    </SettingsFormGroup>
    <button type="button" class="hx-btn" data-variant="ghost" :aria-label="`Remove path translation ${position}`" @click="removeRow">Remove</button>
  </div>
</template>
