<script setup>
import {api} from '../lib/api'
import {usePage,date,label} from '../lib/workspace'
import LoadState from './LoadState.vue'
const props=defineProps({requestId:[String,Number]})
const {data,loading,error,refresh}=usePage(signal=>api('/deadlines?request_id='+props.requestId,{signal}),()=>props.requestId)
</script><template><section class="panel"><h2>Maintenance targets</h2><LoadState :loading :error @retry="refresh">
<p v-if="!data?.rows.length">No targets were configured for this report.</p>
<template v-for="r in data?.rows"><p v-for="k in ['response','resolution']"><strong>{{k==='response'?'First work start':'Coordinator verification'}}</strong> · {{date(r[k+'_due_at'])}} · {{label(r[k+'_state'])}}
<span v-if="['on_track','approaching','overdue'].includes(r[k+'_state'])"> · {{Math.abs(r[k+'_remaining_minutes'])}} min {{r[k+'_remaining_minutes']<0?'past target':'remaining'}}</span></p></template>
</LoadState></section></template>
