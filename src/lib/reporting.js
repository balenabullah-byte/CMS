import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from './api'

export function useReportQuery() {
  const route = useRoute(), router = useRouter()
  const page = computed(() => Math.max(1, Number.parseInt(route.query.page,10) || 1))
  const filters = computed(() => Object.fromEntries(Object.entries(route.query).filter(([k,v]) => k !== 'page' && typeof v === 'string' && v)))
  const parameters = (extra = {}) => new URLSearchParams({...filters.value,...extra}).toString()
  function go(next) { router.push({query:{...filters.value,...(next>1 && {page:next})}}) }
  return {page,filters,parameters,go}
}
export async function exportReport(endpoint, name) {
  const {csv} = await api(endpoint)
  const url = URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}))
  const anchor = document.createElement('a')
  anchor.href=url
  anchor.download=name+'-'+new Date().toISOString().slice(0,10)+'.csv'
  anchor.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
