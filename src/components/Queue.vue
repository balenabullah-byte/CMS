<script setup>
import { FileText, Building2, ArrowRight } from 'lucide-vue-next'
import Badge from './Badge.vue'
import { useWorkspace } from '../lib/workspace'
defineProps({ title: String, rows: Array, link: String, action: String, empty: String })
const w = useWorkspace()
</script>
<template>
  <section class="panel">
    <div class="split">
      <h2>{{ title }}</h2>
      <RouterLink class="inline" :to="w.path(link)">
        {{ action }}
        <ArrowRight />
      </RouterLink>
    </div>
    <RouterLink class="queue-row" v-for="r in rows" :key="r.id" :to="w.path('/requests/' + r.id)">
      <FileText />
      <div>
        <strong>REQ-{{ r.id }}</strong>
        <b>{{ r.title }}</b>
        <small>
          <Building2 />
          {{ w.building(r.building_id) }}
        </small>
      </div>
      <Badge :value="r.status" />
      <ArrowRight />
    </RouterLink>
    <p v-if="!rows.length" class="empty">{{ empty }}</p>
  </section>
</template>
