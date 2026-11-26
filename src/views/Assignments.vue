<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { api, all } from '../lib/api'
import { date, label, usePage, useWorkspace, useAction } from '../lib/workspace'
import { useReportQuery, exportReport } from '../lib/reporting'
import { causes } from '../../shared/maintenance.js'
import FilterToolbar from '../components/FilterToolbar.vue'
import ReportPager from '../components/ReportPager.vue'
import LoadState from '../components/LoadState.vue'
import Queue from '../components/Queue.vue'
const w=useWorkspace(),route=useRoute(),{page,parameters,go}=useReportQuery()
const history=computed(()=>route.path.endsWith('/history')),verify=computed(()=>route.path.endsWith('/verification'))
const dispatch = computed(() => w.has('coordinator') && !history.value && !verify.value)
const incoming = usePage(async signal => {
  if (!dispatch.value) return null
  await w.catalog()
  const [submitted, ready] = await Promise.all([
    api('/maintenance-requests?status=submitted&limit=6', {signal}),
    api('/maintenance-requests?status=ready&limit=6', {signal}),
  ])
  return {submitted, ready}
}, () => route.fullPath, {refetchOnFocus:true})
const defaults=computed(()=>({scope:verify.value?'verification':history.value?'ended':w.has('coordinator')?'all':'active',date_field:history.value?'ended':verify.value?'completed':'assigned'}))
const query=(extra={})=>new URLSearchParams({...defaults.value,...Object.fromEntries(new URLSearchParams(parameters())),...extra,...(history.value?{scope:'ended'}:verify.value?{scope:'verification'}:{})}).toString()
const fields=computed(()=>['search','date_field','building_id','room_id','category_id','priority','status',...(w.has('coordinator')?['technician_id']:[]),'cause','end_reason',...(!history.value&&!verify.value?['scope']:[]),'labor_min','labor_max','repair_min','repair_max','sort','direction'])
const lookups=usePage(async signal=>{await w.catalog();return w.has('coordinator')?all('/work-technicians',signal):[]})
const {data,loading,error,refresh}=usePage(signal=>api('/work-records?'+query({limit:20,offset:(page.value-1)*20}),{signal}),()=>route.fullPath)
const action=useAction()
</script>
<template>
  <section v-if="dispatch" class="stack">
    <div class="split">
      <h2>Requests awaiting allocation</h2>
      <button class="secondary" :disabled="incoming.loading.value" @click="incoming.refresh">Refresh requests</button>
    </div>
    <p>Open an incoming report to review and approve it, then choose a technician.</p>
    <LoadState :loading="incoming.loading.value" :error="incoming.error.value" @retry="incoming.refresh">
      <div v-if="incoming.data.value" class="queues">
        <Queue title="Incoming reports" :rows="incoming.data.value.submitted" link="/requests?status=submitted"
          action="View all incoming reports" empty="No requests awaiting review." />
        <Queue title="Ready to assign" :rows="incoming.data.value.ready" link="/requests?status=ready"
          action="View all ready requests" empty="No requests awaiting assignment." />
      </div>
    </LoadState>
  </section>
  <section class="panel">
  <FilterToolbar :fields="fields" :technicians="lookups.data.value||[]" :date-label="defaults.date_field" :default-scope="defaults.scope">
    <button v-if="w.has('coordinator')" class="secondary" :disabled="action.busy.value" @click="action.run(()=>exportReport('/work-records/export?'+query(),'maintenance-records'))">Export CSV</button>
  </FilterToolbar>
  <p class="error" role="alert" v-if="action.error.value || lookups.error.value">{{ action.error.value || lookups.error.value }}</p>
  <LoadState :loading :error @retry="refresh"><template v-if="data">
    <div class="table-scroll" tabindex="0" aria-label="Assignments"><table class="records" v-if="data.rows.length">
      <thead><tr><th>Assignment</th><th>Request</th><th>Technician</th><th>Root cause</th><th>{{ history||verify?'Ended':'Assigned' }}</th><th>Labor</th></tr></thead>
      <tbody><tr v-for="j in data.rows" :key="j.id">
        <td><RouterLink :to="w.path('/assignments/'+j.id)">ASG-{{ j.id }}</RouterLink><small>{{ label(j.end_reason || (j.started_at?'in_progress':'assigned')) }}</small></td>
        <td><RouterLink v-if="w.has('coordinator')" :to="w.path('/requests/'+j.request_id)">{{ j.title }}</RouterLink><strong v-else>{{ j.title }}</strong><small>REQ-{{ j.request_id }} · {{ j.building }} {{ j.room_code }} · {{ label(j.priority) }}</small></td>
        <td>{{ j.technician_name }}</td><td>{{ causes[j.root_cause] || (j.end_reason==='completed'?'Not recorded':'—') }}</td>
        <td>{{ date(history||verify?j.ended_at:j.assigned_at) }}<small v-if="j.elapsed_minutes!=null">Elapsed {{j.elapsed_minutes}} min</small></td><td>{{ j.labor_minutes==null?'—':j.labor_minutes+' min' }}</td>
      </tr></tbody></table></div>
    <p class="empty" v-if="!data.rows.length">No assignments match this view.</p>
    <p v-if="w.has('technician') && !history && !verify">
      My jobs shows your active assignments by default. Your coordinator must approve and assign a report before it appears here.
      <RouterLink :to="w.path('/history')">View completed jobs in Work history</RouterLink>
    </p>
    <ReportPager :total="data.total" :page @go="go"/>
  </template></LoadState>
</section></template>
