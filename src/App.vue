<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Shell from './components/Shell.vue'
import { useWorkspace } from './lib/workspace'
const route = useRoute(),
  router = useRouter(),
  w = useWorkspace()
function expired() {
  if (!w.user) return
  w.clear(true)
  router.replace({ path: '/login', query: { next: route.fullPath, expired: '1' } })
}
onMounted(() => window.addEventListener('session-expired', expired))
onUnmounted(() => window.removeEventListener('session-expired', expired))
</script>
<template>
  <RouterView v-if="route.path === '/qa/results' || route.path === '/login'" />
  <Shell v-else-if="w.user"><RouterView :key="route.path" /></Shell>
</template>
