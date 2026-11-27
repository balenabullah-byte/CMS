<script setup>
import { causes } from '../../shared/maintenance.js'
import { date, label } from '../lib/workspace'
defineProps({job:Object})
</script>
<template>
  <dl class="facts">
    <dt>Assignment</dt><dd>#{{ job.id }} · {{ job.technician_name }}</dd>
    <dt>Location</dt><dd>{{ job.building }} {{ job.room_code }}</dd>
    <dt>{{job.priority ? 'Category / priority' : 'Category'}}</dt><dd>{{ job.category }}<template v-if="job.priority"> · {{ label(job.priority) }}</template></dd>
    <dt>Ended</dt><dd>{{ label(job.end_reason) }} · {{ date(job.ended_at) }}</dd>
    <dt>Assigned / started</dt><dd>{{ date(job.assigned_at) }} / {{ date(job.started_at) }}</dd>
    <template v-if="job.end_reason==='completed'">
      <dt>Completed</dt><dd>{{ date(job.completed_at) }}</dd>
      <dt>Root cause</dt><dd>{{ causes[job.root_cause] || 'Not recorded' }}</dd>
      <dt v-if="job.root_cause_details">Cause explanation</dt><dd v-if="job.root_cause_details">{{ job.root_cause_details }}</dd>
      <dt>Repair notes</dt><dd>{{ job.completion_note }}</dd>
      <dt>Materials used</dt><dd>{{ job.materials_used || 'Not recorded' }}</dd>
      <dt>Elapsed repair</dt><dd>{{ job.elapsed_minutes == null ? 'Unknown' : job.elapsed_minutes+' min' }}</dd>
      <dt>Actual labor</dt><dd>{{ job.labor_minutes == null ? 'Not recorded' : job.labor_minutes+' min' }}</dd>
    </template>
    <template v-if="job.end_reason==='completed' && 'decision' in job">
      <dt>Verification of this repair</dt><dd>{{ job.decision==='closed'?'Verified and closed':job.decision==='reopened'?'Additional work requested':'No confirmed closure' }}
        <span v-if="job.decision_at"> · {{ date(job.decision_at) }}</span></dd>
    </template>
    <template v-if="job.status"><dt>Current request status</dt><dd>{{ label(job.status) }}</dd></template>
  </dl>
</template>
