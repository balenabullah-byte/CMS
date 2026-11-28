<script setup>
import {api} from '../lib/api'
import {usePage} from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
const {data,loading,error,refresh}=usePage(signal=>api('/analytics/qr',{signal}))
const sections=[['codes','Labels by resource'],['sources','Reports by source'],['buildings','QR reports by building'],['assets','Frequently reported equipment']]
function title(key,row) {
  if(key==='codes') return row.type+' · '+(row.active?'Active':'Revoked')
  if(key==='sources') return ({manual:'Manual',qr:'QR label'})[row.reporting_source] || 'Source unrecorded'
  return [row.asset_code,row.name].filter(Boolean).join(' · ')
}
</script>
<template><LoadState :loading :error @retry="refresh"><div class="stack" v-if="data"><section class="panel" v-for="[key,name] in sections" :key="key"><h2>{{name}}</h2><p v-if="!data[key].length">No records yet.</p><div v-for="row in data[key]" class="listrow"><span>{{title(key,row)}}</span><strong>{{row.total}}</strong></div></section></div></LoadState></template>
