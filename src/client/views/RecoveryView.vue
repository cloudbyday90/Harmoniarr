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
import { buildAuthEntrySupportItems } from '../lib/auth-entry-support.js';
import { usePasswordMatch } from '../composables/usePasswordMatch.js';
import { useRecoveryStatus } from '../composables/useRecoveryStatus.js';

const router = useRouter();
const form = reactive({ recoveryCode: '', username: '', password: '', confirmPassword: '' });
const validationError = ref('');

const {
  blockedByLock,
  completionResult,
  destroy: destroyRecoveryStatus,
  errorMessage,
  expired,
  isCompleted,
  isLoading,
  isSubmitting,
  loadStatus,
  recoveryAvailable,
  remainingAttempts,
  secondsRemaining,
  submitRecovery,
} = useRecoveryStatus({ revalidateOnFocus: true });
const supportItems = computed(() => buildAuthEntrySupportItems('recovery', { username: form.username }));
const { markTouched: markConfirmTouched, showMatch: showPasswordMatch, showMismatch: showPasswordMismatch } = usePasswordMatch(
  () => form.password,
  () => form.confirmPassword,
);

const countdownDisplay = computed(() => {
  const total = secondsRemaining.value;
  if (total <= 0) {
    return 'Expired';
  }

  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
});

const formDisabled = computed(() => {
  return isSubmitting.value || !recoveryAvailable.value || expired.value || blockedByLock.value || remainingAttempts.value <= 0;
});

onMounted(async () => {
  await loadStatus();
});

onBeforeUnmount(() => {
  destroyRecoveryStatus();
});

function validate() {
  if (!form.recoveryCode.trim()) {
    return 'Recovery code is required.';
  }

  if (!form.username.trim()) {
    return 'Username is required.';
  }

  if (!form.password) {
    return 'Password is required.';
  }

  if (form.password !== form.confirmPassword) {
    return 'Passwords must match.';
  }

  return '';
}

async function submit() {
  validationError.value = '';
  const error = validate();
  if (error) {
    validationError.value = error;
    return;
  }

  try {
    await submitRecovery({
      recoveryCode: form.recoveryCode.trim(),
      username: form.username.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword,
    });
  } catch {
    await loadStatus();
  }
}

function goToLogin() {
  router.push({ name: 'login' });
}
</script>

<template>
  <AuthEntryShell
    eyebrow="Bootstrap-admin recovery"
    title="Recover admin access"
    description="Use this only when an operator armed bootstrap-admin recovery from the command line. Completing recovery revokes existing sessions and restores local admin access."
    :support-items="supportItems"
  >
    <article class="panel-light bootstrap-status-card" v-if="isLoading">
      <p class="eyebrow">Checking recovery status</p>
      <p>Loading recovery run information...</p>
    </article>

    <article class="panel-light bootstrap-status-card" v-else-if="errorMessage && !recoveryAvailable">
      <p class="eyebrow">Recovery status error</p>
      <p class="error-copy">{{ errorMessage }}</p>
      <p class="muted-copy">
        Ensure a recovery run is armed via <code>harmoniarrctl recovery arm-bootstrap-admin</code> and try again.
      </p>
    </article>

    <article class="panel-light bootstrap-status-card" v-else-if="!recoveryAvailable">
      <p class="eyebrow">No active recovery run</p>
      <h2>Recovery is not available</h2>
      <p class="muted-copy">
        No armed recovery run was found. An operator must arm a recovery run from the command
        line using <code>harmoniarrctl recovery arm-bootstrap-admin</code> before this page can be used.
      </p>
    </article>

    <template v-else-if="isCompleted && completionResult">
      <article class="panel-light bootstrap-status-card">
        <p class="eyebrow">Recovery complete</p>
        <h2>Admin account recovered successfully</h2>
        <p>
          The bootstrap-admin recovery has been completed. All existing sessions have been
          revoked. Use your new credentials to log in.
        </p>
        <ul class="status-metrics" v-if="completionResult.recoveryChecklist?.length">
          <li v-for="item in completionResult.recoveryChecklist" :key="item">
            <span>{{ item }}</span>
          </li>
        </ul>
        <button type="button" @click="goToLogin">Go to login</button>
      </article>
    </template>

    <template v-else>
      <article class="panel-light bootstrap-status-card">
        <p class="eyebrow">Recovery run status</p>
        <h2>Active recovery run detected</h2>
        <ul class="status-metrics">
          <li>
            <span>Time remaining</span>
            <strong :class="{ 'error-copy': secondsRemaining < 120 }">{{ countdownDisplay }}</strong>
          </li>
          <li>
            <span>Remaining attempts</span>
            <strong :class="{ 'error-copy': remainingAttempts <= 2 }">{{ remainingAttempts }}</strong>
          </li>
          <li v-if="blockedByLock">
            <span>Safety hold status</span>
            <strong class="error-copy">Blocked by an active safety hold</strong>
          </li>
        </ul>
        <p class="error-copy" v-if="expired">This recovery run has expired. Arm a new run from the command line.</p>
        <p class="error-copy" v-else-if="remainingAttempts <= 0">Too many invalid attempts. This recovery run has been invalidated.</p>
        <p class="error-copy" v-else-if="blockedByLock">Recovery cannot complete while a conflicting safety hold is active. Wait for the hold to be released or contact an operator.</p>
      </article>

      <article class="form-card panel-light auth-entry-form-card">
        <h2>Complete recovery</h2>
        <p class="auth-entry-form-copy">
          Enter the recovery code displayed by <code>harmoniarrctl recovery arm-bootstrap-admin</code>,
          then choose a username and password for the new admin account.
        </p>
        <form class="stack-form" @submit.prevent="submit">
          <label>
            Recovery code
            <input
              id="recovery-code"
              v-model="form.recoveryCode"
              name="recoveryCode"
              placeholder="HARM-XXXX-XXXX-XXXX"
              autocomplete="off"
              required
              :disabled="formDisabled"
            />
          </label>
          <label>
            Username
            <input
              id="username"
              v-model="form.username"
              name="username"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              required
              :disabled="formDisabled"
            />
          </label>
          <label>
            Password
            <input
              id="new-password"
              v-model="form.password"
              name="newPassword"
              type="password"
              autocomplete="new-password"
              required
              :disabled="formDisabled"
            />
          </label>
          <label>
            Confirm password
            <input
              id="confirm-new-password"
              v-model="form.confirmPassword"
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              required
              :disabled="formDisabled"
              @input="markConfirmTouched"
            />
          </label>
          <p v-if="showPasswordMismatch" class="auth-pw-hint auth-pw-hint--mismatch">Passwords do not match.</p>
          <p v-else-if="showPasswordMatch" class="auth-pw-hint auth-pw-hint--match">Passwords match.</p>
          <p class="error-copy" v-if="validationError">{{ validationError }}</p>
          <p class="error-copy" v-else-if="errorMessage">{{ errorMessage }}</p>
          <button type="submit" :disabled="formDisabled">
            {{ isSubmitting ? 'Recovering...' : 'Complete recovery' }}
          </button>
        </form>
      </article>
    </template>
    </AuthEntryShell>
</template>
