<script setup>
import {all} from '../lib/api'
import {usePage,useWorkspace} from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
const w=useWorkspace(),{data,loading,error,refresh}=usePage(signal=>all('/technicians',signal))
</script><template><LoadState :loading :error @retry="refresh"><section class="panel"><h2>Active technicians</h2><div v-for="t in data" :key="t.id" class="listrow">{{t.full_name}} <RouterLink :to="w.path('/assignments?technician_id='+t.id)">View jobs</RouterLink></div><p v-if="!data?.length">No active technicians.</p></section></LoadState></template>
