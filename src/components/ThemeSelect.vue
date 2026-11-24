<script setup>
import { ref } from 'vue'
const mode = ref(document.documentElement.dataset.theme || 'system')
function change() {
  document.documentElement.dataset.theme = mode.value
  try { localStorage.setItem('campus-theme', mode.value) } catch {}
}
</script>
<template>
  <label class="theme-choice">Theme
    <select aria-label="Theme" v-model="mode" @change="change">
      <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
    </select>
  </label>
</template>
