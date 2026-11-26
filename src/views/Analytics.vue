<script setup>
import {causes} from '../../shared/maintenance.js'
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import {api,all} from '../lib/api'
import {useWorkspace,usePage,useAction,label} from '../lib/workspace'
import {useReportQuery,exportReport} from '../lib/reporting'
import FilterToolbar from '../components/FilterToolbar.vue'
import ReportTrend from '../components/ReportTrend.vue'
import ReportSeries from '../components/ReportSeries.vue'
import LoadState from '../components/LoadState.vue'
const w=useWorkspace(),route=useRoute(),{filters,parameters}=useReportQuery()
const kind=computed(()=>route.path.split('/').at(-1))
const endpoint=computed(()=>'/analytics/'+kind.value)
const causePage=computed(()=>['causes','workload'].includes(kind.value))
const fields=computed(()=>kind.value==='accounts'?['search','member_type','role','active']:
  ['building_id','room_id','category_id','priority','status',...(causePage.value?['technician_id',...(kind.value==='causes'?['cause']:['assignment_status'])]:[])])
const lookups=usePage(async signal=>{await w.catalog();return w.has('coordinator')?all('/work-technicians',signal):[]})
const {data,loading,error,refresh}=usePage(async signal=>{
  const [result,records]=await Promise.all([api(endpoint.value+'?'+parameters(),{signal}),
    kind.value==='causes'?api('/work-records?'+parameters({scope:'ended',end_reason:'completed',date_field:'completed',limit:6}),{signal}):null])
  return {...result,records}
},()=>route.fullPath)
const {run,busy,error:failure}=useAction()
function drill(series,row) {
  const q={...filters.value}
  const building = w.catalogs?.buildings.find(b=>b.name===row.label),category = w.catalogs?.categories.find(c=>c.name===row.label)
  if(series.title.includes('by building') && building) return w.path((w.has('admin')?'/analytics/infrastructure':'/requests')+'?'+new URLSearchParams({...q,building_id:building.id}))
  if(series.title.includes('by category') && category) return w.path((w.has('admin')?'/analytics/infrastructure':'/requests')+'?'+new URLSearchParams({...q,category_id:category.id}))
  if(w.has('admin') && kind.value==='accounts' && series.title.startsWith('Role memberships'))return w.path('/users?'+parameters({role:row.label}))
  if(w.has('admin')) return kind.value==='accounts' && series.title==='Member types'?w.path('/users?'+parameters({member_type:row.label})):null
  if(series.title==='Completed assignments by cause')return w.path('/history?'+new URLSearchParams({...q,cause:row.label,end_reason:'completed',date_field:'completed'}))
  if(series.title==='Current request statuses') {delete q.from;delete q.to;return w.path('/requests?'+new URLSearchParams({...q,status:row.label}))}
  if(series.title==='Reported by day')return w.path('/requests?'+new URLSearchParams({...q,from:row.label,to:row.label}))
  return null
}
const format=v=>v==null?'—':typeof v==='number'?v.toLocaleString(undefined,{maximumFractionDigits:1}):v
</script>
<template><div class="stack">
  <section class="panel"><FilterToolbar :fields="fields" :technicians="lookups.data.value||[]" :date-label="kind==='accounts'?'Account creation':causePage?'Work completion':kind==='infrastructure'?'Reported':'Metric event'">
    <button class="secondary" :disabled="busy" @click="run(()=>exportReport(endpoint+'/export?'+parameters(),kind))">Export CSV</button>
  </FilterToolbar><p v-if="failure || lookups.error.value" class="error" role="alert">{{ failure || lookups.error.value }}</p></section>
  <LoadState :loading :error @retry="refresh"><template v-if="data">
    <dl class="metric-strip" v-if="data.metrics.length"><div v-for="m in data.metrics" :key="m.label"><dt>{{ m.label }}</dt><dd>{{ format(m.value) }} {{ m.unit }}</dd><small v-if="m.samples!=null">{{ m.samples }} observations</small></div></dl>
    <ReportTrend v-if="['operations','trends'].includes(kind)" :reported="data.series[0].rows" :resolved="data.series[1].rows" :from="filters.from" :to="filters.to"/>
    <div class="analytics-grid"><ReportSeries v-for="s in data.series" :key="s.title" :series="s" :link="r=>drill(s,r)"/></div>
    <section v-if="data.table" class="panel"><h2>{{kind==='causes'?'Recurring causes at the same building and category':'Supporting records'}}</h2><div class="table-scroll" tabindex="0" v-if="data.table.length"><table class="records"><thead><tr><th v-for="k in Object.keys(data.table[0])">{{ label(k) }}</th></tr></thead>
      <tbody><tr v-for="(r,i) in data.table" :key="i"><td v-for="v in r">{{ format(v) }}</td></tr></tbody></table></div><p v-else class="empty">No matching records.</p></section>
    <section class="panel" v-if="data.records"><h2>Completed assignments</h2>
      <p v-if="!data.records.total" class="empty">No matching completed repairs.</p>
      <div class="table-scroll" v-else><table class="records"><thead><tr><th>Assignment</th><th>Request</th><th>Building</th><th>Root cause</th><th>Actual labor</th></tr></thead>
      <tbody><tr v-for="r in data.records.rows" :key="r.id"><td><RouterLink :to="w.path('/assignments/'+r.id)">ASG-{{r.id}}</RouterLink></td><td>{{r.title}}</td><td>{{r.building}}</td><td>{{causes[r.root_cause] || 'Not recorded'}}</td><td>{{r.labor_minutes==null?'—':r.labor_minutes+' min'}}</td></tr></tbody></table></div>
    </section>
    <RouterLink v-if="kind==='causes'" :to="w.path('/history?'+parameters({end_reason:'completed',date_field:'completed'}))">Inspect completed assignments</RouterLink>
    <RouterLink v-if="kind==='accounts'" :to="w.path('/users?'+parameters())">Open filtered user directory</RouterLink>
  </template></LoadState>
</div></template>
