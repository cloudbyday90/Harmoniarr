<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<script setup>
import { computed, ref } from 'vue';
import { buildSlskdProviderModeGuidance } from '../../lib/settings-provider-mode-guidance.js';

const props = defineProps({
  managedDeploymentDetected: {
    default: false,
    type: Boolean,
  },
  providerMode: {
    default: 'external',
    type: String,
  },
});

const copyStatus = ref('');
const guidance = computed(() => buildSlskdProviderModeGuidance(props));

async function copyManagedCommand() {
  if (!guidance.value?.command) return;

  try {
    await navigator.clipboard.writeText(guidance.value.command);
    copyStatus.value = 'Command copied.';
  } catch {
    copyStatus.value = 'Copy the command from the text above.';
  }
}
</script>

<template>
  <section v-if="guidance" class="soulseek-provider-guidance" :data-guidance="guidance.type">
    <h4 class="soulseek-provider-guidance__title">{{ guidance.title }}</h4>
    <p class="soulseek-provider-guidance__copy">{{ guidance.copy }}</p>

    <template v-if="guidance.type === 'managed_setup'">
      <p class="soulseek-provider-guidance__label">Required secret files</p>
      <ul class="soulseek-provider-guidance__list">
        <li v-for="secretFile in guidance.secretFiles" :key="secretFile"><code>{{ secretFile }}</code></li>
      </ul>
      <p class="soulseek-provider-guidance__hint">Keep these files outside the repository in the directory set by <code>HARMONIARR_SLSKD_SECRETS_DIR</code>. Do not paste secret values into Settings.</p>
      <code class="soulseek-provider-guidance__command">{{ guidance.command }}</code>
      <div class="soulseek-provider-guidance__actions">
        <button type="button" class="hx-btn" @click="copyManagedCommand">Copy command</button>
        <span v-if="copyStatus" class="hx-text-muted" role="status">{{ copyStatus }}</span>
      </div>
    </template>

    <RouterLink v-else class="hx-btn" :to="{ name: guidance.actionRouteName }">
      {{ guidance.actionLabel }}
    </RouterLink>
  </section>
</template>

<style scoped>
.soulseek-provider-guidance {
  background: var(--hx-bg-surface-muted);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
  display: grid;
  gap: var(--hx-space-2);
  margin-top: var(--hx-space-3);
  padding: var(--hx-space-3);
}

.soulseek-provider-guidance__title,
.soulseek-provider-guidance__copy,
.soulseek-provider-guidance__label,
.soulseek-provider-guidance__hint {
  margin: 0;
}

.soulseek-provider-guidance__title,
.soulseek-provider-guidance__label {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.soulseek-provider-guidance__copy,
.soulseek-provider-guidance__hint {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.soulseek-provider-guidance__list {
  display: grid;
  gap: var(--hx-space-1);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding-left: var(--hx-space-4);
}

.soulseek-provider-guidance__command {
  overflow-wrap: anywhere;
}

.soulseek-provider-guidance__actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

@media (max-width: 640px) {
  .soulseek-provider-guidance__list {
    grid-template-columns: 1fr;
  }
}
</style>
