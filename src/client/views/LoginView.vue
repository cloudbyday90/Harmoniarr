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
import { buildAuthEntrySupportItems } from '../lib/auth-entry-support.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();
const router = useRouter();
const form = reactive({
  username: typeof route.query.username === 'string' ? route.query.username : '',
  password: '',
});
const errorMessage = ref('');
const isSubmitting = ref(false);
const infoMessage = computed(() => {
  if (route.query.reason === 'claim-complete') {
    return 'Your account claim is complete. Log in with the password you just set.';
  }

  if (route.query.reason === 'session-expired') {
    return 'Your session expired. Log in again to continue.';
  }

  if (route.query.reason === 'reauth-required') {
    return 'A privileged action requires you to confirm your password again before continuing.';
  }

  return '';
});
const supportItems = computed(() => buildAuthEntrySupportItems('login', { username: form.username }));

async function submit() {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    await sessionStore.login(form);
    await router.push(typeof route.query.redirect === 'string' ? route.query.redirect : { name: 'dashboard' });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login failed';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <AuthEntryShell
    eyebrow="Local access"
    title="Log in to Harmoniarr"
    description="Use your local Harmoniarr account to manage requests, imports, diagnostics, and recovery from the same protected browser session."
    :support-items="supportItems"
  >
    <template #status>
      <article class="panel-light bootstrap-status-card" v-if="infoMessage">
        <p class="eyebrow">Session status</p>
        <h2>Continue with local login</h2>
        <p class="auth-entry-inline-status">{{ infoMessage }}</p>
      </article>
    </template>

    <article class="form-card panel-light auth-entry-form-card">
      <h2>Login</h2>
      <p class="auth-entry-form-copy">Enter the username or email tied to your local Harmoniarr account.</p>
      <form class="stack-form" @submit.prevent="submit">
        <label>
          Username or email
          <input v-model="form.username" autocomplete="username" required />
        </label>
        <label>
          Password
          <input v-model="form.password" type="password" autocomplete="current-password" required />
        </label>
        <p class="error-copy" v-if="errorMessage">{{ errorMessage }}</p>
        <button type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Logging in...' : 'Log in' }}
        </button>
      </form>
      <p class="auth-entry-inline-note">Need a first password for an existing account? Use the claim-account path shown in the related entry points.</p>
    </article>
  </AuthEntryShell>
</template>
