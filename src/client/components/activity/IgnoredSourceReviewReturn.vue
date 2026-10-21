<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { resolveIgnoredSourceReviewReturn } from '../../lib/ignored-source-review-handoff.js';
import { sessionStore } from '../../state/session.js';

defineProps({ pending: { type: Boolean, default: false } });
const route = useRoute();
const destination = computed(() => resolveIgnoredSourceReviewReturn({ actorRole: sessionStore.state.user?.role, query: route.query }));
</script>

<template>
  <section v-if="destination" class="hx-card" aria-labelledby="hx-ignored-review-return-heading">
    <div class="hx-card-body hx-ignored-review-return">
      <div>
        <h3 id="hx-ignored-review-return-heading" class="hx-card-title">Return to your release</h3>
        <p>Check this release's latest status before choosing another action.</p>
      </div>
      <div>
        <p role="status" aria-atomic="true">{{ pending ? 'Saving source policy…' : '' }}</p>
        <RouterLink v-if="!pending" class="hx-btn" :to="destination">Return to Missing Music</RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hx-ignored-review-return { display: flex; align-items: center; justify-content: space-between; gap: var(--hx-space-4); margin-bottom: var(--hx-space-4); }
.hx-ignored-review-return p { margin: var(--hx-space-1) 0 0; color: var(--hx-text-muted); }
.hx-ignored-review-return p:empty { margin: 0; }
.hx-ignored-review-return .hx-btn { min-height: 44px; white-space: normal; }
@media (max-width: 640px) { .hx-ignored-review-return { align-items: flex-start; flex-direction: column; } }
</style>
