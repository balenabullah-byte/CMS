<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api'
import { useWorkspace, usePage, statuses, label } from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
import RequestTable from '../components/RequestTable.vue'
const route = useRoute(),
  router = useRouter(),
  w = useWorkspace(),
  search = ref(''),
  size = 20
const status = computed(() =>
    [...statuses, 'ready', 'active'].includes(route.query.status) ? route.query.status : '',
  ),
  page = computed(() => Math.max(1, Math.floor(Number(route.query.page) || 1)))
function go(s, p) {
  router.push({ query: { ...(s && { status: s }), ...(p > 1 && { page: p }) } })
}
const { data, loading, error, refresh } = usePage(async signal => {
  await w.catalog()
  const query = new URLSearchParams({limit: size + 1, offset: (page.value - 1) * size})
  if (status.value) query.set('status', status.value)
  if (search.value.trim()) query.set('search', search.value.trim())
  return api('/maintenance-requests?' + query, {signal})
}, () => [route.fullPath, search.value])
const visible = computed(() => (data.value || []).slice(0, size))
function clearFilters() {
  search.value = ''
  go('', 1)
}
</script>
<template>
  <section class="panel">
    <div class="toolbar">
      <label>
        Search reports
        <input type="search" v-model="search" maxlength="150" @input="page > 1 && go(status, 1)" placeholder="Request, ID or building" />
      </label>
      <label>
        Status
        <select :value="status" @change="go($event.target.value, 1)">
          <option value="">All statuses</option>
          <option value="active">Active reports</option>
          <option v-if="w.has('coordinator')" value="ready">Ready to assign</option>
          <option v-for="s in statuses" :value="s">{{ label(s) }}</option>
        </select>
      </label>
      <RouterLink v-if="w.has('campus_member')" class="primary" :to="w.path('/requests/new')">
        New request
      </RouterLink>
    </div>
    <LoadState :loading :error @retry="refresh">
      <RequestTable :rows="visible" empty="No matching reports." />
      <button v-if="status || search" class="textbtn" @click="clearFilters()">Clear filters</button>
      <div class="pager">
        <button class="secondary" :disabled="page === 1" @click="go(status, page - 1)">Previous</button>
        Page {{ page }}
        <button class="secondary" :disabled="!data || data.length <= size" @click="go(status, page + 1)">
          Next
        </button>
      </div>
    </LoadState>
  </section>
</template>
