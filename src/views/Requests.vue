<script setup>
import {useRoute} from 'vue-router'
import {api} from '../lib/api'
import {useReportQuery} from '../lib/reporting'
import {useWorkspace,usePage} from '../lib/workspace'
import FilterToolbar from '../components/FilterToolbar.vue'
import ReportPager from '../components/ReportPager.vue'
import RequestTable from '../components/RequestTable.vue'
import LoadState from '../components/LoadState.vue'
const w=useWorkspace(),route=useRoute(),{page,parameters,go}=useReportQuery()
const {data,loading,error,refresh}=usePage(async signal=>{
  await w.catalog()
  return api('/maintenance-requests?'+parameters({limit:20,offset:(page.value-1)*20,totals:true}),{signal})
},()=>route.fullPath,{refetchOnFocus:true})
</script>
<template><section class="panel"><FilterToolbar :fields="['search','status','priority','building_id','room_id','category_id','sort','direction']">
  <button type="button" class="secondary" :disabled="loading" @click="refresh">Refresh</button>
  <RouterLink v-if="w.has('campus_member')" class="primary" :to="w.path('/requests/new')">New request</RouterLink>
</FilterToolbar><LoadState :loading :error @retry="refresh"><template v-if="data"><RequestTable :rows="data.rows" empty="No matching reports."/>
<ReportPager :total="data.total" :page @go="go"/></template></LoadState></section></template>
