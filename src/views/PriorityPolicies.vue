<script setup>
import {ref} from 'vue'
import {api} from '../lib/api'
import {usePage,useAction,date,label} from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
const {data,error,loading,refresh}=usePage(()=>api('/priority-policies'))
const keys=['response_target_minutes','resolution_target_minutes','response_warning_minutes','resolution_warning_minutes']
const editing=ref(null),unit=ref(1),form=ref({}),{run,busy,error:failure}=useAction()
function edit(p,row){unit.value=1;form.value={...row,is_active:!!row?.is_active};editing.value=p}
function save(){if(!confirm('Apply this policy to future requests?'))return
 run(async()=>{const body={is_active:form.value.is_active};for(const key of keys)body[key]=form.value[key]*unit.value
 await api('/priority-policies/'+editing.value,{method:'PUT',body});editing.value=null;await refresh()})}
</script><template><section class="panel"><p>Active policies set targets for new reports. Existing reports keep their original targets.</p>
<LoadState :loading :error @retry="refresh"><article class="entry" v-for="p in ['high','normal','low']" :key="p">
<strong>{{label(p)}}</strong><template v-for="row in (data||[]).filter(r=>r.priority===p)"><p>{{row.is_active?'Active':'Inactive'}} · Updated {{date(row.updated_at)}} by user #{{row.updated_by_id}}</p><p v-for="key in keys">{{label(key)}} · {{row[key]}}</p></template>
<span v-if="!data?.some(r=>r.priority===p)"> · Not configured</span>
<button @click="edit(p,data?.find(r=>r.priority===p))">Configure {{p}}</button>
<form v-if="editing===p" @submit.prevent="save"><label>Duration unit<select v-model.number="unit" @change="keys.forEach(k=>form[k]=null)"><option :value="1">Minutes</option><option :value="60">Hours</option><option :value="1440">Days</option></select></label>
<label v-for="key in keys">{{label(key.replace('_minutes',''))}}<input type="number" step="any" min="0" required v-model.number="form[key]"></label>
<label><input type="checkbox" v-model="form.is_active"> Active policy</label><p role="alert" v-if="failure">{{failure}}</p><button :disabled="busy">Save policy</button></form>
</article></LoadState></section></template>
