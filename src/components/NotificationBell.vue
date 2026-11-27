<script setup>
import {destination} from '../lib/notifications'
import {useRouter} from 'vue-router'
import {Bell} from 'lucide-vue-next'
import {ref,onMounted,onUnmounted} from 'vue'
import {api} from '../lib/api'
import {useWorkspace,label} from '../lib/workspace'
const router=useRouter(),w=useWorkspace(), count=ref(null), recent=ref([]), error=ref(''), menu=ref(null)
let timer, pending, stopped=false
async function reload(){
  if(document.hidden || stopped || pending) return
  pending=new AbortController()
  try{
    count.value=await api('/notifications/count',{signal:pending.signal})
    if(menu.value?.open) recent.value=(await api('/notifications?limit=5',{signal:pending.signal})).rows
    error.value=''
  }catch(e){if(!stopped) error.value=e.message}
  finally{pending=null}
}
async function open(n){
  try{await api('/notifications/'+n.id+'/read',{method:'PATCH'});menu.value.open=false;await router.push(destination(n));reload()}
  catch(e){error.value=e.message}
}
onMounted(()=>{
  reload()
  timer=setInterval(reload,Math.max(5000,Number(import.meta.env.VITE_NOTIFICATION_INTERVAL_MS)||30000))
  window.addEventListener('focus',reload)
  document.addEventListener('visibilitychange',reload)
  window.addEventListener('notifications-read',reload)
})
onUnmounted(()=>{
  stopped=true;pending?.abort();clearInterval(timer)
  window.removeEventListener('focus',reload);document.removeEventListener('visibilitychange',reload)
  window.removeEventListener('notifications-read',reload)
})
</script>
<template><details class="notification-menu" ref="menu" @toggle="reload" @keydown.esc="menu.open=false">
  <summary :aria-label="'Notifications, '+(count??'unknown')+' unread'"><Bell aria-hidden="true"/> {{count??'…'}}</summary>
  <section class="panel"><h2>Notifications</h2><p v-if="error" role="alert">{{error}}</p>
    <p v-else-if="!recent.length">No recent notifications.</p>
    <p v-for="n in recent" :key="n.id">{{label(n.event_type)}} · REQ-{{n.request_id}}</p>
    <RouterLink :to="w.path('/notifications')" @click="menu.open=false">Open notification center</RouterLink>
  </section>
</details></template>
