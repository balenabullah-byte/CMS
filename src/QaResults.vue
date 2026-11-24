<script setup>
import { ref, computed } from 'vue'
import { summarize } from './test-results'
import verified from './verified-results.json'

const report = ref(summarize(verified))
const source = ref('Included verification run')
const error = ref('')
let selection = 0
async function openReport(event) {
  const file = event.target.files[0]
  if (!file) return
  const current = ++selection
  error.value = ''
  try {
    const next = summarize(JSON.parse(await file.text()))
    if (current !== selection) return
    report.value = next
    source.value = file.name
  } catch {
    if (current !== selection) return
    report.value = summarize([])
    source.value = file.name
    error.value = 'Could not read this report. Choose a JSON file produced by the API test runner.'
  }
}
const metrics = computed(() => [
  ['Tests', report.value.total], ['Passed', report.value.passed], ['Failed', report.value.failed],
  ['Notes', report.value.notes], ['Pass rate', report.value.rate],
])
</script>

<template>
  <main>
    <div class="brand">Campus Resource Hub</div>
    <header><div><h1>API test results</h1><p class="source" aria-live="polite">{{ source }}</p></div>
      <label><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3m-5 5 5-5 5 5M3 15v6h18v-6"/></svg>Open JSON report <input type="file" accept=".json,application/json" @change="openReport"></label>
    </header>
    <p v-if="error" role="alert">{{ error }}</p>
    <dl><div v-for="[name, value] in metrics" :key="name"><dt>{{ name }}</dt><dd>{{ value }}</dd></div></dl>
    <p v-if="!report.rows.length && !error">This report contains no results.</p>
    <section v-if="report.rows.length" aria-label="Test results" tabindex="0">
      <table><thead><tr><th>Test</th><th>Expected</th><th>Actual</th><th>Result</th></tr></thead>
        <tbody><tr v-for="(row, i) in report.rows" :key="i">
          <td>{{ row.name }}<small v-if="row.detail || row.note">{{ row.detail || row.note }}</small></td>
          <td>{{ row.expected ?? '—' }}</td><td>{{ row.status === 0 ? 'No response' : row.status ?? '—' }}</td>
          <td :class="row.result">{{ row.result }}</td>
        </tr></tbody></table>
    </section>
  </main>
</template>

<style scoped>
main {
  --ink: light-dark(#0b0b0b, #eff4fa);
  --forest: #0d4c1d;
  --gutter: clamp(1rem, 4.75vw, 6rem);
  --serif: "Times New Roman", Georgia, serif;
  min-height: 100vh;
  padding-inline: var(--gutter);
  background: var(--surface);
  color: var(--ink);
  font-family: Arial, sans-serif;
}
.brand { margin-inline: calc(-1 * var(--gutter)); padding: .48rem var(--gutter) 1.1rem; border-bottom: 2px solid; font: 700 clamp(1.55rem, 2.5vw, 2.5rem)/1.15 var(--serif); letter-spacing: -.045em; }
header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: clamp(1.5rem, 2.05vw, 2.1rem) 0; }
h1 { font: 700 clamp(2.5rem, 4.25vw, 4.4rem)/1.07 var(--serif); letter-spacing: -.035em; }
.source { margin-top: .25rem; line-height: 1.2; font-size: clamp(1rem, 1.75vw, 1.75rem); overflow-wrap: anywhere; }
label { position: relative; flex: none; display: inline-flex; align-items: center; gap: 1.1rem; padding: .6em 1em; background: var(--forest); color: white; cursor: pointer; border-radius: 3px; font-size: clamp(1rem, 1.55vw, 1.55rem); line-height: 1.35; font-weight: 700; }
label:hover { background: #083a15; }
label svg { width: 1.35em; height: 1.35em; }
input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
label:focus-within, section:focus-visible { outline: 3px solid #2675a7; outline-offset: 3px; }
dl { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); padding: 1.05rem 0 1.05rem; border-block: 2px solid; }
dl div { padding-inline-start: 1.6vw; }
dt { font-size: clamp(1rem, 1.52vw, 1.55rem); font-weight: 500; }
dd { font: 700 clamp(2.25rem, 4.5vw, 4.6rem)/1.08 var(--serif); letter-spacing: -.035em; font-variant-numeric: lining-nums tabular-nums; }
section { margin: 1.25rem -.8vw 0; padding-bottom: 2rem; }
table { width: 100%; table-layout: fixed; border-collapse: collapse; }
th, td { padding: .3rem 1.25vw; text-align: left; }
th { font-size: clamp(1rem, 1.65vw, 1.7rem); padding-block: .7rem; border-bottom: 1px solid var(--ink); }
th:first-child { width: 40%; }
th:nth-child(3) { width: 18.75%; }
td { border-bottom: 1px solid #aaa; overflow-wrap: anywhere; font: 500 clamp(.95rem, 1.5vw, 1.5rem)/1.38 Consolas, monospace; }
td:last-child { font-family: Arial, sans-serif; font-weight: 700; letter-spacing: .03em; }
small { display: block; font: .875rem/1.4 Arial, sans-serif; }
.PASS { color: var(--good); } .FAIL, [role=alert] { color: var(--bad); } .NOTE { color: var(--muted); }
@media (max-width: 660px) {
  header { flex-direction: column; align-items: flex-start; }
  label { min-height: 44px; }
  dl { grid-template-columns: repeat(3,minmax(0,1fr)); gap: .75rem; }
  dl div { padding: 0; }
  section { margin-inline: 0; }
  th, td { padding: .55rem .15rem; font-size: .84rem; }
  th:first-child { width: 42%; }
  th:nth-child(2) { width: 22%; }
}
</style>
