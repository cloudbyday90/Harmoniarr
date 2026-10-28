<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { nextTick, useId } from 'vue';
import SettingsFormGroup from './SettingsFormGroup.vue';
import { removeSettingsRowWithFocus } from '../../lib/settings-row-removal.js';

const props = defineProps({ position: { required: true, type: Number }, addButton: { default: null, type: Object } });
const userId = defineModel('userId', { required: true, type: String });
const relativeRoot = defineModel('relativeRoot', { required: true, type: String });
const emit = defineEmits(['remove']);
const fieldId = useId();
function removeRow(event) {
  return removeSettingsRowWithFocus({ invoker: event.currentTarget, addButton: props.addButton, remove: () => emit('remove'), afterUpdate: nextTick });
}
</script>

<template>
  <div class="cfg-mapping-card">
    <SettingsFormGroup :title="`User library folder ${position}`">
      <div class="hx-form-row">
        <div class="hx-field">
          <label class="hx-field-label" :for="`${fieldId}-user`">User</label>
          <input :id="`${fieldId}-user`" class="hx-input" v-model="userId" placeholder="alice" />
        </div>
        <div class="hx-field">
          <label class="hx-field-label" :for="`${fieldId}-subfolder`">Subfolder</label>
          <input :id="`${fieldId}-subfolder`" class="hx-input" v-model="relativeRoot" placeholder="household/alice" />
        </div>
      </div>
    </SettingsFormGroup>
    <button type="button" class="hx-btn" data-variant="ghost" :aria-label="`Remove user library folder ${position}`" @click="removeRow">Remove</button>
  </div>
</template>
