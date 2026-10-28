<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProviderCallbackFeedback } from '../../composables/useProviderCallbackFeedback.js';
import { clearProviderCallbackQuery, readProviderCallbackIntent } from '../../lib/provider-callback-feedback-policy.js';

const props = defineProps({ canCheck: { type: Boolean, default: false } });
const route = useRoute(), router = useRouter();
const { intent, feedback, isLoading, accept, check, setPermission, markCleanupFailed, dispose } = useProviderCallbackFeedback();
let mounted = false, generation = 0;
function consume() {
  if (!mounted) return;
  const next = readProviderCallbackIntent(route.query);
  if (!next) return;
  const current = ++generation;
  const original = route.fullPath;
  const cleanup = router.replace({ path: route.path, query: clearProviderCallbackQuery(route.query), hash: route.hash });
  void accept(next, props.canCheck);
  const cleanupFailed = () => { if (mounted && current === generation && route.fullPath === original) markCleanupFailed(); };
  void cleanup.then(cleanupFailed, cleanupFailed);
}
watch(() => route.fullPath, consume, { flush: 'post' });
watch(() => props.canCheck, setPermission);
onMounted(() => { mounted = true; consume(); });
onUnmounted(() => { mounted = false; dispose(); });
</script>

<template>
  <div class="hx-provider-callback-feedback">
    <p
      class="hx-provider-callback-feedback__status"
      :class="{ 'hx-alert': intent }"
      :data-tone="feedback.tone"
      role="status"
      aria-atomic="true"
    >{{ feedback.message }} <span v-if="intent">{{ feedback.guidance }}</span></p>
    <div v-if="intent && canCheck" class="hx-provider-callback-feedback__actions">
      <button v-if="intent.provider" type="button" class="hx-btn" :aria-disabled="isLoading" @click="check">
        {{ isLoading ? 'Checking saved status…' : 'Check saved status' }}
      </button>
      <RouterLink class="hx-btn" :to="{ name: 'settings-connections' }">Review Connections</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.hx-provider-callback-feedback__status { margin: 0; }
.hx-provider-callback-feedback__status.hx-alert {
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-sm);
  color: var(--hx-text);
  padding: var(--hx-space-3);
}
.hx-provider-callback-feedback__status[data-tone="warning"].hx-alert { border-color: var(--hx-warning); }
.hx-provider-callback-feedback__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
  margin-top: var(--hx-space-2);
}
.hx-provider-callback-feedback__actions .hx-btn { min-height: 44px; }
</style>
