<script setup>
import {ref,computed,watch} from 'vue'
import {useRoute} from 'vue-router'
import {api} from '../lib/api'
import {assetOptions} from '../lib/assets'
import {useWorkspace,useAction,usePage} from '../lib/workspace'
import {renderLabel} from '../lib/qr-label'
import LoadState from '../components/LoadState.vue'

const w=useWorkspace(), route=useRoute()
const type=ref(['building','room','asset'].includes(route.query.type)?route.query.type:'asset')
const selected=ref(route.query.id?[Number(route.query.id)]:[]), sheet=ref([])
const {run,busy,error:failure}=useAction()
const {data,loading,error,refresh}=usePage(async signal=>{
  const [catalog,assets]=await Promise.all([w.catalog(),assetOptions('/assets',{},signal)])
  return {building:catalog.buildings,room:catalog.rooms,asset:assets}
})
const rows=computed(()=>data.value?.[type.value] || [])
const path=id=>'/qr/'+type.value+'/'+id
const history=usePage(signal=>selected.value.length===1?api(path(selected.value[0]),{signal}):[],()=>[type.value,...selected.value])
watch(type,()=>{selected.value=[]})
watch(()=>[type.value,...selected.value],()=>{sheet.value=[]},{flush:'sync'})
function generate(previous) {
  if(previous && !window.confirm('Replace this label? The previous printed code will stop working.')) return
  run(async()=>{
    sheet.value=[]
    for(const id of selected.value){
      const result=await api(path(id),{method:'POST',body:previous?{replace_id:previous}:{}})
      sheet.value.push({...result,image:await renderLabel(result)})
    }
    await history.refresh()
  })
}
function revoke(id) {
  if(!window.confirm('Revoke this label? Its printed code will stop working.')) return
  run(async()=>{await api('/qr-revocations/'+id,{method:'POST',body:{}});sheet.value=[];await history.refresh()})
}
function printSheet(){ window.print() }
</script>
<template>
<LoadState :loading :error @retry="refresh"><div v-if="data" class="stack">
<section class="panel qr-controls"><h2>Prepare labels</h2>
<label>Resource type<select v-model="type" :disabled="busy"><option value="asset">Equipment</option><option value="room">Room</option><option value="building">Building</option></select></label>
<fieldset :disabled="busy"><legend>Resources</legend><p v-if="!rows.length">No resources available.</p>
<label v-for="r in rows" :key="r.id" class="qr-choice"><input type="checkbox" v-model="selected" :value="r.id">{{r.name || r.room_code}} · {{r.asset_code || r.code || w.building(r.building_id)}}</label></fieldset>
<div class="actions"><button class="primary" :disabled="busy || !selected.length" @click="generate()">Generate labels</button><button class="secondary" v-if="sheet.length" @click="printSheet">Print labels</button></div>
<p v-if="failure" role="alert" class="error">{{failure}}</p></section>
<div v-if="sheet.length" class="qr-sheet"><figure v-for="s in sheet" :key="s.id"><img :src="s.image" :alt="'QR label for '+s.resource.name"><figcaption><a :aria-label="'Download PNG for '+s.resource.name" :href="s.image" :download="'campus-label-'+s.id+'.png'">Download PNG</a></figcaption></figure></div>
<section v-if="selected.length===1" class="panel qr-controls"><h2>Label history</h2>
<LoadState :loading="history.loading.value" :error="history.error.value" @retry="history.refresh"><p v-if="!history.data.value?.length">No labels generated.</p>
<div class="listrow" v-for="r in history.data.value" :key="r.id"><span>#{{r.id}} · {{r.revoked_at?'Revoked':'Active'}} · {{new Date(r.created_at).toLocaleDateString()}}</span>
<div v-if="!r.revoked_at" class="actions"><button :disabled="busy" @click="generate(r.id)">Replace</button><button :disabled="busy" @click="revoke(r.id)">Revoke</button></div></div></LoadState></section>
</div></LoadState>
</template>
<style>
.qr-controls fieldset{max-height:18rem;overflow:auto;margin-block:1rem;padding:.5rem;border:1px solid var(--edge)}
.qr-controls .qr-choice{display:flex;align-items:center;gap:.6rem;min-height:44px}
.qr-choice input[type=checkbox]{width:18px;height:18px}
.qr-sheet{display:flex;flex-wrap:wrap;gap:1rem}.qr-sheet figure{margin:0;width:min(100%,300px)}.qr-sheet img{display:block;width:100%}
@media print{body:has(.qr-sheet) *{visibility:hidden}body:has(.qr-sheet) :is(aside,header,nav,.qr-controls,figcaption){display:none!important}.qr-sheet,.qr-sheet *{visibility:visible!important}.qr-sheet{position:absolute;inset:0 auto auto 0;width:100%;display:block}.qr-sheet figure{display:inline-block;width:75mm;break-inside:avoid;vertical-align:top;margin:3mm}}
</style>
