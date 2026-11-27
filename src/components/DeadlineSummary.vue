<script setup>
import {api} from '../lib/api'
import {usePage,useWorkspace,label} from '../lib/workspace'
import LoadState from './LoadState.vue'
const w=useWorkspace(),{data,error,loading,refresh}=usePage(signal=>api('/deadline-summary',{signal}),()=>w.portal)
</script><template><section class="panel"><h2>Maintenance targets</h2>
<LoadState :loading :error @retry="refresh"><dl class="facts" v-if="data"><template v-for="k in ['response','resolution']">
<dt>{{label(k)}}</dt><dd>{{data[k].approaching||0}} approaching · {{data[k].overdue||0}} overdue ·
{{data[k].met||0}} met of {{(data[k].met||0)+(data[k].missed||0)}} evaluated</dd></template></dl>
<RouterLink v-if="w.has('coordinator')" :to="w.path('/deadlines')">Monitor deadlines</RouterLink>
<RouterLink v-else :to="w.path('/priority-policies')">Configure targets</RouterLink></LoadState></section></template>
