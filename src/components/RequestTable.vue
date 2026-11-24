<script setup>
import { Building2 } from 'lucide-vue-next'
import Badge from './Badge.vue'
import { useWorkspace, date } from '../lib/workspace'
defineProps({ rows: Array, empty: { type: String, default: 'No matching requests.' } })
const w = useWorkspace()
</script>
<template>
  <table v-if="rows.length" class="records request-table">
    <thead>
      <tr>
        <th>Request</th>
        <th>Building</th>
        <th>Status</th>
        <th>Priority</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="r in rows" :key="r.id">
        <td>
          <RouterLink :to="w.path('/requests/' + r.id)">
            <strong>REQ-{{ r.id }}</strong>
            <span>{{ r.title }}</span>
            <small v-if="w.has('campus_member')">Submitted {{ date(r.created_at) }} · Updated {{ date(r.updated_at) }}</small>
          </RouterLink>
        </td>
        <td>
          <div class="building-cell">
            <Building2 />
            {{ w.building(r.building_id) }}
          </div>
        </td>
        <td><Badge :value="r.status" /></td>
        <td><Badge :value="r.priority" /></td>
      </tr>
    </tbody>
  </table>
  <p v-else class="empty">{{ empty }}</p>
</template>
