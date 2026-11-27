<script setup>
import {computed} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {description,destination} from '../lib/notifications'
import {Bell} from 'lucide-vue-next'
import {api} from '../lib/api'
import {useReportQuery} from '../lib/reporting'
import {useWorkspace,usePage,useAction,date,label,portals} from '../lib/workspace'
import ReportPager from '../components/ReportPager.vue'
import LoadState from '../components/LoadState.vue'
const route=useRoute(),router=useRouter(),w=useWorkspace(),{page,parameters,go}=useReportQuery()
const mode=computed(()=>route.path.split('/').at(-1))
const choices={active:["true","false"],read:['unread','read'],kind:['response','resolution'],priority:['low','normal','high'],
 condition:['on_track','approaching','overdue','met','missed','not_applicable'],direction:['desc','asc'],
 status:['submitted','approved','assigned','in_progress','completed','closed','reopened','rejected']}
const fields=computed(()=>({specializations:['search','category_id','active'],notifications:['read','event_type','from','to'],'audit-logs':['search','actor_id','action','entity_type','entity_id','from','to','direction'],deadlines:['kind','condition','status','priority']})[mode.value])
const {data,error,loading,refresh}=usePage(signal=>api('/'+mode.value+'?'+parameters({limit:20,offset:(page.value-1)*20}),{signal}),()=>route.fullPath)
function filter(k,value){const query={...route.query,[k]:value};delete query.page;if(!value)delete query[k];router.push({query})}
const {run,busy,error:failure}=useAction()
function read(n,open=false){run(async()=>{
  await api('/notifications/'+(n?n.id+'/':'')+'read',{method:'PATCH'})
  window.dispatchEvent(new Event('notifications-read'))
  if(open && w.available.includes(n.portal)) await router.push(destination(n))
  else await refresh()
})}
</script>
<template><section class="panel"><div class="filterbar">
  <label v-for="k in fields" :key="k">{{label(k)}}
    <select v-if="choices[k]" :value="route.query[k]||''" @change="filter(k,$event.target.value)"><option value="">Default</option><option v-for="v in choices[k]" :value="v">{{label(v)}}</option></select>
    <input v-else :type="['from','to'].includes(k)?'date':k==='actor_id'?'number':'search'" :value="route.query[k]" @change="filter(k,$event.target.value)">
  </label><button v-if="Object.keys(route.query).length" @click="router.push({query:{}})">Clear filters</button>
  <button v-if="mode==='notifications'" :disabled="busy" @click="read()">Mark all as read</button>
</div><p v-if="failure" role="alert">{{failure}}</p>
<LoadState :loading :error @retry="refresh"><template v-if="data">
<p v-if="!data.rows.length" class="empty">{{mode==='deadlines'?'No requests with configured targets match this view.':'No matching records.'}}</p>
<article v-for="row in data.rows" :key="row.id||row.request_id" class="entry">
 <template v-if="mode==='notifications'"><Bell aria-hidden="true" :size="16"/> <strong>{{label(row.event_type)}}</strong> · REQ-{{row.request_id}}
 <small>{{row.read_at?'Read':'Unread'}} · {{date(row.created_at)}}</small><div class="actions"><button @click="read(row,true)">Open record</button><button v-if="!row.read_at" :disabled="busy" @click="read(row)">Mark read</button></div></template>
 <details v-else-if="mode==='audit-logs'"><summary>{{label(row.action)}} · {{label(row.entity_type)}} #{{row.entity_id}} · User #{{row.actor_id}} · {{date(row.created_at)}}</summary>
 <p>Before: {{row.old_values||'—'}}</p><p>After: {{row.new_values||'—'}}</p></details>
 <p v-else-if="mode==='specializations'"><strong>{{row.full_name}}</strong> · #{{row.id}} · {{row.is_active?'Active':'Inactive'}} · {{row.skills||'No specializations'}} · {{row.workload}} active assignments</p>
 <template v-else><strong>REQ-{{row.request_id}} · {{row.title}}</strong><p v-for="k in ['response','resolution']">{{label(k)}} · {{label(row[k+'_state'])}} · {{date(row[k+'_due_at'])}} <span v-if="['approaching','on_track','overdue'].includes(row[k+'_state'])">({{row[k+'_remaining_minutes']}} min)</span></p></template>
</article><ReportPager :total="data.total" :page @go="go"/></template></LoadState></section></template>
