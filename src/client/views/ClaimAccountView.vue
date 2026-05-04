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
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { claimAccount } from '../lib/auth-api.js';

const route = useRoute();
const router = useRouter();
const form = reactive({
  claimCode: '',
  confirmPassword: '',
  password: '',
  username: typeof route.query.username === 'string' ? route.query.username : '',
});
const errorMessage = ref('');
const isSubmitting = ref(false);

async function submit() {
  errorMessage.value = '';
  if (form.password !== form.confirmPassword) {
    errorMessage.value = 'Passwords must match.';
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = await claimAccount({
      claimCode: form.claimCode,
      password: form.password,
      username: form.username,
    });
    await router.push({
      name: 'login',
      query: {
        reason: payload.requiresLogin ? 'claim-complete' : undefined,
        username: payload.username ?? form.username,
      },
    });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Account claim failed';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="auth-layout">
    <article class="hero-card panel-dark">
      <p class="eyebrow">Account claim</p>
      <h1>Set your Harmoniarr password</h1>
      <p>
        Use the one-time claim code issued by an administrator to set a local password for your existing account.
        This does not sign you in automatically. After the claim succeeds, return to the login screen and sign in normally.
      </p>
    </article>

    <article class="form-card panel-light">
      <h2>Claim account</h2>
      <form class="stack-form" @submit.prevent="submit">
        <label>
          Username or email
          <input v-model="form.username" autocomplete="username" required />
        </label>
        <label>
          Claim code
          <input v-model="form.claimCode" autocomplete="off" placeholder="HCLM-XXXX-XXXX-XXXX" required />
        </label>
        <label>
          New password
          <input v-model="form.password" type="password" autocomplete="new-password" required />
        </label>
        <label>
          Confirm password
          <input v-model="form.confirmPassword" type="password" autocomplete="new-password" required />
        </label>
        <p class="error-copy" v-if="errorMessage">{{ errorMessage }}</p>
        <button type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Claiming...' : 'Claim account' }}
        </button>
      </form>
    </article>
  </section>
</template>