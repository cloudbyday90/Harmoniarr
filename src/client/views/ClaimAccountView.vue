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
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthEntryShell from '../components/AuthEntryShell.vue';
import AuthFormFeedback from '../components/AuthFormFeedback.vue';
import { claimAccount } from '../lib/auth-api.js';
import { buildAuthEntrySupportItems } from '../lib/auth-entry-support.js';
import { useAutoFocus } from '../composables/useAutoFocus.js';
import { useAuthSubmission } from '../composables/useAuthSubmission.js';
import { usePasswordConfirmation } from '../composables/usePasswordConfirmation.js';

const route = useRoute();
const router = useRouter();
const firstInput = ref(null);
const confirmInput = ref(null);
const form = reactive({
  claimCode: '',
  confirmPassword: '',
  password: '',
  username: typeof route.query.username === 'string' ? route.query.username : '',
});
const { errorMessage, isSubmitting, pendingMessage, run } = useAuthSubmission();
const supportItems = computed(() => buildAuthEntrySupportItems('claim-account', { username: form.username }));
useAutoFocus(firstInput);
const { markTouched: markConfirmTouched, showMatch: showPasswordMatch, showMismatch: showPasswordMismatch, validate } = usePasswordConfirmation(
  () => form.password,
  () => form.confirmPassword,
  confirmInput,
);

async function submit() {
  if (isSubmitting.value) return;
  errorMessage.value = '';
  if (!await validate()) return;
  const credentials = {
    claimCode: form.claimCode,
    password: form.password,
    username: form.username,
  };
  await run(async () => {
    const payload = await claimAccount(credentials);
    await router.push({
      name: 'login',
      query: {
        reason: payload.requiresLogin ? 'claim-complete' : undefined,
        username: payload.username ?? credentials.username,
      },
    });
  }, { pendingText: 'Claiming account…', fallbackMessage: 'Account claim failed' });
}
</script>

<template>
  <AuthEntryShell
    eyebrow="Claim access"
    title="Activate an existing account"
    description="Use a one-time claim code from an administrator to set the first local password for an existing Harmoniarr account."
    :support-items="supportItems"
  >
    <article class="form-card panel-light auth-entry-form-card">
      <h2>Claim account</h2>
      <p class="auth-entry-form-copy">Use the same username or email the administrator assigned to your account.</p>
      <form class="stack-form" @submit.prevent="submit">
        <label>
          Username or email
          <input
            id="username"
            ref="firstInput"
            v-model="form.username"
            name="username"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            required
          />
        </label>
        <label>
          Claim code
          <input
            id="claim-code"
            v-model="form.claimCode"
            name="claimCode"
            autocomplete="off"
            placeholder="HCLM-XXXX-XXXX-XXXX"
            required
          />
        </label>
        <label>
          New password
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
            aria-describedby="claim-password-match"
            @input="markConfirmTouched"
          />
        </label>
        <div id="claim-password-match" role="status" aria-atomic="true" :class="{ 'sr-only': !showPasswordMismatch && !showPasswordMatch }">
          <p v-if="showPasswordMismatch" class="auth-pw-hint auth-pw-hint--mismatch">Passwords do not match.</p>
          <p v-else-if="showPasswordMatch" class="auth-pw-hint auth-pw-hint--match">Passwords match.</p>
        </div>
        <AuthFormFeedback :error-message="errorMessage" :pending-message="pendingMessage" />
        <button type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Claiming...' : 'Claim account' }}
        </button>
      </form>
      <p class="auth-entry-inline-note">After the claim completes, go back to the login screen and use the password you just set.</p>
    </article>
  </AuthEntryShell>
</template>
