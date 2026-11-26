<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkspace, label, roles } from '../lib/workspace'
import { causes, requestStates } from '../../shared/maintenance.js'
const props=defineProps({fields:{type:Array,required:true},technicians:{type:Array,default:()=>[]},dateLabel:{type:String,default:'Reported'},defaultScope:String})
const w=useWorkspace(), route=useRoute(), router=useRouter(), search=ref(''), preset=ref('')
const titles={assignment_status:'Workload group',building_id:'Building',room_id:'Room',category_id:'Maintenance category',priority:'Priority',status:'Request status',technician_id:'Technician',cause:'Root cause',end_reason:'End reason',scope:'Job state',date_field:'Date field',labor_min:'Minimum labor (min)',labor_max:'Maximum labor (min)',repair_min:'Minimum elapsed repair (min)',repair_max:'Maximum elapsed repair (min)',sort:'Sort by',direction:'Sort order',member_type:'Member type',role:'Role',active:'Account status'}
const pairs = values => values.map(v=>[v,label(v)])
const choices=computed(()=>({
  building_id:w.catalogs?.buildings.map(b=>[b.id,b.name]) || [],
  room_id:w.catalogs?.rooms.filter(r=>!route.query.building_id || String(r.building_id)===route.query.building_id).map(r=>[r.id,r.room_code]) || [],
  category_id:w.catalogs?.categories.map(c=>[c.id,c.name]) || [],
  priority:pairs(['low','normal','high']),status:pairs(requestStates),
  technician_id:props.technicians.map(t=>[t.id,t.full_name]),cause:[...Object.entries(causes),['missing','Not recorded']],
  end_reason:pairs(['completed','reassigned','cancelled']),scope:pairs(['all','active','waiting','started','ended','verification']),
  date_field:pairs(['assigned','completed','ended','reported','closed']),direction:[['desc','Descending'],['asc','Ascending']],
  sort:pairs(props.fields.includes('end_reason')?['id','assigned','completed','ended','title','labor']:['id','created_at','updated_at','title']),
  assignment_status:pairs(['active','in_progress','completed','verification']),
  role:Object.entries(roles),member_type:pairs(['student','faculty','staff','contractor']),active:[['true','Active'],['false','Inactive']],
}))
const advanced=computed(()=>props.fields.filter(k=>k!=='search'))
const active=computed(()=>Object.entries(route.query).filter(([k])=>!['page','section','create'].includes(k)))
let timer
watch(()=>route.fullPath,()=>{clearTimeout(timer);search.value=String(route.query.search || '');preset.value=''}, {immediate:true})
onUnmounted(()=>clearTimeout(timer))
function change(values) {
  const q={...route.query,...values};delete q.page
  for(const k of Object.keys(q)) if(q[k]==='' || q[k]==null) delete q[k]
  router.push({query:q})
}
function setField(k,v) {change({[k]:v,...(k==='building_id' && {room_id:''})})}
function searchLater(){clearTimeout(timer);timer=setTimeout(()=>setField('search',search.value.trim()),250)}
function dates(key) {
  if(key==='custom') return
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:w.user.campus_time_zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const get=k=>Number(parts.find(p=>p.type===k).value)
  const y=get('year'),m=get('month')-1,d=get('day')
  const iso=(month,day)=>new Date(Date.UTC(y,month,day)).toISOString().slice(0,10)
  const ranges={today:[iso(m,d),iso(m,d)],yesterday:[iso(m,d-1),iso(m,d-1)],week:[iso(m,d-6),iso(m,d)],month:[iso(m,d-29),iso(m,d)],current:[iso(m,1),iso(m+1,0)],previous:[iso(m-1,1),iso(m,0)]}
  const [from,to]=ranges[key] || ['','']; change({from,to})
}
function display(k,v){return choices.value[k]?.find(x=>String(x[0])===v)?.[1] || v}
</script>
<template>
  <div class="filterbar">
    <label v-if="fields.includes('search')">{{ dateLabel==='Reported' ? 'Search reports' : 'Search' }}
      <input type="search" maxlength="150" v-model="search" @input="searchLater" placeholder="Name or reference">
    </label>
    <label>Period · {{ route.query.date_field || dateLabel }}
      <select aria-label="Date preset" :value="preset" @change="preset=$event.target.value;dates(preset)">
        <option value="">{{ route.query.from || route.query.to ? 'Selected range' : 'All dates' }}</option>
        <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">Last 7 days</option>
        <option value="month">Last 30 days</option><option value="current">This month</option><option value="previous">Previous month</option><option value="custom">Custom range</option>
      </select>
    </label>
    <details class="filter-options" :open="preset==='custom' || undefined"><summary>Filters</summary>
      <div class="filter-grid">
        <label>From<input type="date" :value="route.query.from" :max="route.query.to" @change="setField('from',$event.target.value)"></label>
        <label>Through<input type="date" :value="route.query.to" :min="route.query.from" @change="setField('to',$event.target.value)"></label>
        <label v-for="k in advanced" :key="k">{{ titles[k] }}
          <select v-if="choices[k]" :aria-label="titles[k]" :value="route.query[k]||''" @change="setField(k,$event.target.value)">
            <option value="">{{ k === 'scope' && defaultScope ? label(defaultScope) + ' (default)' : 'Default' }}</option><option v-for="[v,name] in choices[k]" :value="v" :key="v">{{ name }}</option>
          </select>
          <input v-else type="number" min="0" step="1" :value="route.query[k]" @change="setField(k,$event.target.value)">
        </label>
      </div>
    </details>
    <slot/>
    <div v-if="active.length" class="filter-tags"><button v-for="[k,v] in active" :key="k" @click="setField(k,'')" :aria-label="'Remove '+(titles[k]||k)">{{ titles[k] || label(k) }} · {{ display(k,v) }} ×</button>
      <button class="textbtn" @click="router.push({query:{}})">Clear filters</button></div>
  </div>
</template>
