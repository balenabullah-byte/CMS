<script setup>
import {computed} from 'vue'
const props=defineProps({reported:Array,resolved:Array,from:String,to:String})
const chart=computed(()=>{
  const all=[...props.reported,...props.resolved].map(r=>r.label).sort()
  if(!all.length)return null
  const start=props.from || all[0],end=props.to || all.at(-1)
  const monthly=(Date.parse(end)-Date.parse(start))/86400000>90
  const key=s=>monthly?s.slice(0,7):s
  const sum=rows=>{const map=new Map(); for(const r of rows)map.set(key(r.label),(map.get(key(r.label))||0)+Number(r.value));return map}
  const created=sum(props.reported),closed=sum(props.resolved)
  // Limit the axis to the observed span; the filter still applies to the query.
  const cursor=new Date((monthly?all[0].slice(0,7)+'-01':all[0])+'T00:00:00Z')
  const points=[]
  while(key(cursor.toISOString().slice(0,10))<=key(all.at(-1))){
    const day=key(cursor.toISOString().slice(0,10))
    points.push({day,reported:created.get(day)||0,resolved:closed.get(day)||0})
    if(monthly)cursor.setUTCMonth(cursor.getUTCMonth()+1)
    else cursor.setUTCDate(cursor.getUTCDate()+1)
  }
  const max=Math.max(1,...points.flatMap(p=>[p.reported,p.resolved]))
  const x=i=>points.length===1?200:12+376*i/(points.length-1)
  const y=n=>95-80*n/max
  const line=k=>points.map((p,i)=>x(i)+','+y(p[k])).join(' ')
  return {points,monthly,max,line,x,y}
})
</script>
<template><section class="panel trend"><h2>Reported and first verified closures</h2>
  <p v-if="!chart" class="empty">No reports or first closures in this period.</p>
  <template v-else><div class="trend-key"><span>Reported</span><span>First closures</span><small>{{chart.monthly?'Monthly':'Daily'}} counts</small></div>
    <svg viewBox="0 0 400 110" role="img" aria-label="Reported requests and first verified closures over time. Data table follows.">
      <path d="M12 15H388 M12 95H388" fill="none" stroke="var(--edge)"/>
      <g v-for="k in ['reported','resolved']" :key="k" :stroke="k==='reported'?'var(--link)':'var(--good)'">
        <polyline :points="chart.line(k)" fill="none" stroke-width="2" :stroke-dasharray="k==='resolved'?'5 3':undefined"/>
        <circle v-for="(p,i) in chart.points" :cx="chart.x(i)" :cy="chart.y(p[k])" :r="chart.points.length<40?2.7:1" :fill="k==='reported'?'var(--link)':'var(--good)'"><title>{{p.day}} · {{k}} · {{p[k]}}</title></circle>
      </g>
    </svg><div class="split"><small>{{chart.points[0].day}}</small><small>0–{{chart.max}} requests</small><small>{{chart.points.at(-1).day}}</small></div>
    <details><summary>View trend data</summary><table class="records"><thead><tr><th>Period</th><th>Reported</th><th>First closures</th></tr></thead>
      <tbody><tr v-for="p in chart.points" :key="p.day"><th>{{p.day}}</th><td>{{p.reported}}</td><td>{{p.resolved}}</td></tr></tbody></table></details>
  </template></section></template>
