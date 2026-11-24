<script setup>
import ThemeSelect from '../components/ThemeSelect.vue'
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Building2 } from 'lucide-vue-next'
import { api } from '../lib/api'
import { useWorkspace, useAction } from '../lib/workspace'
const email = ref(''),
  password = ref(''),
  router = useRouter(),
  route = useRoute(),
  w = useWorkspace(),
  { run, busy, error } = useAction()
function login() {
  run(async () => {
    await api('/auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
    password.value = ''
    await w.identify()
    w.notice = ''
    const next = route.query.next
    await router.replace(typeof next === 'string' && /^\/(?![\/\\])/.test(next) ? next : '/')
  })
}
</script>
<template>
  <main class="workspace signin">
    <section class="loginpanel">
      <div class="brandline">
        <Building2 />
        <b>Campus Resource Hub</b>
      </div>
      <h1>Sign in</h1>
      <p v-if="route.query.expired === '1'" role="status" class="notice">Your session ended. Sign in to continue.</p>
      <p v-if="w.notice" class="error" role="alert">{{w.notice}}</p>
      <form @submit.prevent="login">
        <label>
          Email
          <input type="email" v-model.trim="email" autocomplete="username" required />
        </label>
        <label>
          Password
          <input type="password" v-model="password" autocomplete="current-password" required />
        </label>
        <p v-if="error" role="alert" class="error">{{ error }}</p>
        <button class="primary" :disabled="busy">Sign in</button>
      </form>
      <ThemeSelect />
    </section>
  </main>
</template>
