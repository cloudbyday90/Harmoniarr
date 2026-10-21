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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthEntryShell from '../components/AuthEntryShell.vue';
import AuthFormFeedback from '../components/AuthFormFeedback.vue';
import {
  buildAuthEntrySupportItems,
  getBootstrapHeading,
  getBootstrapTitle,
} from '../lib/auth-entry-support.js';
import { navigateAfterAuthSuccess } from '../lib/auth-navigation.js';
import { useAutoFocus } from '../composables/useAutoFocus.js';
import { useAuthSubmission } from '../composables/useAuthSubmission.js';
import { useBootstrapStatus } from '../composables/useBootstrapStatus.js';
import { usePasswordConfirmation } from '../composables/usePasswordConfirmation.js';
import { sessionStore } from '../state/session.js';

const router = useRouter();
const firstInput = ref(null);
const confirmInput = ref(null);
const form = reactive({ claimCode: '', email: '', password: '', confirmPassword: '', username: '' });
const { errorMessage, isSubmitting, pendingMessage, run } = useAuthSubmission();
const { loadStatus, ownerClaimSummary, destroy: destroyBootstrapStatus } = useBootstrapStatus({ revalidateOnFocus: true });
const supportItems = computed(() => buildAuthEntrySupportItems('bootstrap'));
useAutoFocus(firstInput);
const { markTouched: markConfirmTouched, showMatch: showPasswordMatch, showMismatch: showPasswordMismatch, validate } = usePasswordConfirmation(
  () => form.password,
  () => form.confirmPassword,
  confirmInput,
);

onMounted(() => {
  void loadStatus();
});

onBeforeUnmount(() => {
  destroyBootstrapStatus();
});

async function submit() {
  if (isSubmitting.value) return;
  errorMessage.value = '';
  if (!await validate()) return;
  const credentials = {
    claimCode: form.claimCode,
    email: form.email,
    password: form.password,
    username: form.username,
  };
  await run(async () => {
    await sessionStore.bootstrapAdmin(credentials);
    await navigateAfterAuthSuccess({
      router,
      target: { name: 'onboarding' },
    });
  }, { pendingText: 'Creating account…', fallbackMessage: 'Bootstrap failed' });
}
</script>

<template>
  <AuthEntryShell
    eyebrow="First-run setup"
    :title="getBootstrapTitle(ownerClaimSummary)"
    description="New installs start here. Harmoniarr already has the runtime, migrations, and protected routes in place, but the first administrator still needs to be established."
    :support-items="supportItems"
  >
    <article class="form-card panel-light auth-entry-form-card">
      <h2>{{ getBootstrapHeading(ownerClaimSummary) }}</h2>
      <p class="auth-entry-form-copy">This form establishes the first durable administrator for the install.</p>
      <form class="stack-form" @submit.prevent="submit">
        <label v-if="ownerClaimSummary?.required">
          Claim code
          <input
            id="bootstrap-claim-code"
            v-model="form.claimCode"
            name="claimCode"
            autocomplete="one-time-code"
            required
          />
        </label>
        <label>
          Username
          <input
            id="username"
            ref="firstInput"
            v-model="form.username"
            name="username"
            :placeholder="ownerClaimSummary?.usernameHint ?? ''"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            required
          />
        </label>
        <p class="muted-copy" v-if="ownerClaimSummary?.usernameHint">
          This install expects the owner username <strong>{{ ownerClaimSummary.usernameHint }}</strong>.
        </p>
        <label>
          Email
          <input
            id="email"
            v-model="form.email"
            name="email"
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
          <input
            id="new-password"
            v-model="form.password"
            name="newPassword"
            type="password"
            autocomplete="new-password"
            required
          />
        </label>
        <label>
          Confirm password
          <input
            id="confirm-new-password"
            ref="confirmInput"
            v-model="form.confirmPassword"
            name="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
            :aria-invalid="showPasswordMismatch ? 'true' : undefined"
            aria-describedby="bootstrap-password-match"
            @input="markConfirmTouched"
          />
        </label>
        <div id="bootstrap-password-match" role="status" aria-atomic="true" :class="{ 'sr-only': !showPasswordMismatch && !showPasswordMatch }">
          <p v-if="showPasswordMismatch" class="auth-pw-hint auth-pw-hint--mismatch">Passwords do not match.</p>
          <p v-else-if="showPasswordMatch" class="auth-pw-hint auth-pw-hint--match">Passwords match.</p>
        </div>
        <AuthFormFeedback :error-message="errorMessage" :pending-message="pendingMessage" />
        <button type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Creating account...' : 'Create bootstrap admin' }}
        </button>
      </form>
    </article>
  </AuthEntryShell>
</template>
