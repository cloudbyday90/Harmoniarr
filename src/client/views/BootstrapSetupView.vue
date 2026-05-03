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
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useBootstrapStatus } from '../composables/useBootstrapStatus.js';
import { sessionStore } from '../state/session.js';

const router = useRouter();
const form = reactive({ claimCode: '', email: '', password: '', confirmPassword: '', username: '' });
const errorMessage = ref('');
const isSubmitting = ref(false);
const {
  errorMessage: bootstrapStatusError,
  isLoading: isLoadingBootstrapStatus,
  loadStatus,
  ownerClaimSummary,
  pathValidationSummary,
} = useBootstrapStatus();

function formatCheckedAt(value) {
  if (!value) {
    return 'Unavailable';
  }

  return new Date(value).toLocaleString();
}

function statusLabel(status) {
  switch (status) {
    case 'healthy':
      return 'Ready';
    case 'degraded':
      return 'Needs attention';
    default:
      return 'Unavailable';
  }
}

onMounted(() => {
  void loadStatus();
});

async function submit() {
  errorMessage.value = '';
  if (form.password !== form.confirmPassword) {
    errorMessage.value = 'Passwords must match.';
    return;
  }

  isSubmitting.value = true;
  try {
    await sessionStore.bootstrapAdmin({
      claimCode: form.claimCode,
      email: form.email,
      password: form.password,
      username: form.username,
    });
    await router.push({ name: 'dashboard', query: { onboarding: 'setup' } });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Bootstrap failed';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="auth-layout">
    <article class="hero-card panel-dark">
      <p class="eyebrow">First-run setup</p>
      <h1>{{ ownerClaimSummary?.required ? 'Claim the configured owner account' : 'Bootstrap the first admin' }}</h1>
      <p>
        Harmoniarr now has the runtime, migration layer, and protected routes in place.
        The first step is establishing the initial administrator account.
      </p>
      <p v-if="ownerClaimSummary?.required" class="muted-copy">
        This install was preconfigured with an owner claim secret, so first-run setup must match the configured
        owner identity before the initial admin account can be created.
      </p>
    </article>

    <article class="panel-light bootstrap-status-card">
      <p class="eyebrow">Setup preflight</p>
      <h2>Validate shared paths before scan and import</h2>
      <p class="muted-copy">
        Harmoniarr reuses the same non-destructive path checks from settings and system health
        so first-run setup can surface local filesystem issues early.
      </p>
      <p v-if="isLoadingBootstrapStatus">Checking the current shared path validation summary...</p>
      <p class="error-copy" v-else-if="bootstrapStatusError">{{ bootstrapStatusError }}</p>
      <template v-else-if="pathValidationSummary">
        <p class="status-chip" :data-status="pathValidationSummary.status">
          {{ statusLabel(pathValidationSummary.status) }}
        </p>
        <p>{{ pathValidationSummary.message }}</p>
        <ul class="status-metrics">
          <li>
            <span>Configured download mappings</span>
            <strong>{{ pathValidationSummary.configuredDownloadMappings }}</strong>
          </li>
          <li>
            <span>Last checked</span>
            <strong>{{ formatCheckedAt(pathValidationSummary.checkedAt) }}</strong>
          </li>
        </ul>
        <p class="muted-copy">
          Resolve setup issues in Settings after creating the admin account, before scans or imports.
        </p>
      </template>
    </article>

    <article class="form-card panel-light">
      <h2>{{ ownerClaimSummary?.required ? 'Claim owner account' : 'Create admin account' }}</h2>
      <form class="stack-form" @submit.prevent="submit">
        <label v-if="ownerClaimSummary?.required">
          Claim code
          <input v-model="form.claimCode" autocomplete="one-time-code" required />
        </label>
        <label>
          Username
          <input
            v-model="form.username"
            :placeholder="ownerClaimSummary?.usernameHint ?? ''"
            autocomplete="username"
            required
          />
        </label>
        <p class="muted-copy" v-if="ownerClaimSummary?.usernameHint">
          This install expects the owner username <strong>{{ ownerClaimSummary.usernameHint }}</strong>.
        </p>
        <label>
          Email
          <input
            v-model="form.email"
            :required="ownerClaimSummary?.emailRequired"
            autocomplete="email"
            type="email"
          />
        </label>
        <p class="muted-copy" v-if="ownerClaimSummary?.emailHint">
          Enter the matching owner email ending with <strong>{{ ownerClaimSummary.emailHint }}</strong>.
        </p>
        <label>
          Password
          <input v-model="form.password" type="password" autocomplete="new-password" required />
        </label>
        <label>
          Confirm password
          <input v-model="form.confirmPassword" type="password" autocomplete="new-password" required />
        </label>
        <p class="error-copy" v-if="errorMessage">{{ errorMessage }}</p>
        <button type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Creating account...' : 'Create bootstrap admin' }}
        </button>
      </form>
    </article>
  </section>
</template>
