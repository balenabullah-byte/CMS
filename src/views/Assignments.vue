<script setup>
import { ref, computed } from 'vue'
import { all } from '../lib/api'
import { date, label, useWorkspace, usePage } from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
import Badge from '../components/Badge.vue'
const w = useWorkspace(), technician = ref(''), building = ref(''), scope = ref('Active'),
  { data, loading, error, refresh } = usePage(async signal => { await w.catalog(); return all('/assignments', signal) })
const rows = computed(() =>
  (data.value || []).filter(j => (!technician.value || j.technician_id === technician.value) && (!building.value || j.building_id === building.value)
    && (scope.value === 'All' || (scope.value === 'Ended' && j.ended_at) || (scope.value === 'Active' && !j.ended_at)
      || scope.value === (j.end_reason || (j.started_at ? 'in_progress' : 'assigned')))),
)
</script>
<template>
  <section class="panel">
    <div class="split">
      <h2>Work assignments</h2>
      <label v-if="w.has('coordinator')">Technician<select v-model="technician"><option value="">All technicians</option><option v-for="[id,name] in new Map((data || []).map(j => [j.technician_id,j.technician_name]))" :value="id">{{ name }}</option></select></label>
      <label>Building<select v-model="building"><option value="">All buildings</option><option v-for="b in w.catalogs?.buildings" :value="b.id">{{ b.name }}</option></select></label>
      <label>
        Show
        <select v-model="scope">
          <option>Active</option>
          <option>Ended</option>
          <option>All</option><option v-for="s in ['assigned','in_progress','completed','cancelled','reassigned']" :value="s">{{ label(s) }}</option>
        </select>
      </label>
    </div>
    <LoadState :loading :error @retry="refresh">
      <table class="records" v-if="rows.length">
        <thead>
          <tr>
            <th>Assignment</th>
            <th>Request</th>
            <th>Technician</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="j in rows">
            <td>
              <RouterLink :to="w.path('/assignments/' + j.id)">Assignment #{{ j.id }}</RouterLink>
            </td>
            <td>{{ j.title }}<small>REQ-{{ j.request_id }} · {{ w.building(j.building_id) }} · {{ label(j.priority) }}</small><small>Assigned {{ date(j.assigned_at) }}</small></td>
            <td>{{ j.technician_name }}</td>
            <td><Badge :value="j.end_reason || (j.started_at ? 'in_progress' : 'assigned')" /></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No {{ scope === 'All' ? '' : scope.toLowerCase() }} assignments.</p>
    </LoadState>
  </section>
</template>
