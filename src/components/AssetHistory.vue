<script setup>
import { date, label } from '../lib/workspace'
import { causes } from '../../shared/maintenance.js'
import ReportPager from './ReportPager.vue'
defineProps({ records: Object, page: Number })
defineEmits(['go'])
</script>
<template>
  <p class="empty" v-if="!records.total">No maintenance history in this view.</p>
  <div v-else class="table-scroll" tabindex="0" aria-label="Equipment repair records">
    <table class="records">
      <thead>
        <tr>
          <th>Report</th>
          <th>Reporting location</th>
          <th>Assignment</th>
          <th>Repair record</th>
          <th>Verification</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in records.rows" :key="r.request_id + '-' + r.assignment_id">
          <td>
            <strong>{{ r.title }}</strong
            ><small>REQ-{{ r.request_id }} · {{ date(r.reported_at) }}</small
            ><small v-if="r.status"
              >{{ label(r.status) }}{{ r.was_reopened ? ' · Previously reopened' : '' }}</small
            >
          </td>
          <td>{{ [r.reported_building, r.reported_room].filter(Boolean).join(' · ') }}</td>
          <td>
            {{ r.technician || 'Unassigned'
            }}<small v-if="r.assignment_id"
              >ASG-{{ r.assignment_id }} · {{ label(r.end_reason || 'active') }}</small
            >
          </td>
          <td>
            <template v-if="r.end_reason === 'completed'"
              ><strong>{{ causes[r.root_cause] || 'Cause not recorded' }}</strong
              ><small
                >{{ date(r.completed_at) }} ·
                {{ r.labor_minutes == null ? 'Labor not recorded' : r.labor_minutes + ' min' }}</small
              >
              <details>
                <summary>Repair details</summary>
                <p>{{ r.completion_note }}</p>
                <p v-if="r.root_cause_details">{{ r.root_cause_details }}</p>
                <p>Materials: {{ r.materials_used || 'Not recorded' }}</p>
              </details></template
            ><span v-else>—</span>
          </td>
          <td>
            {{ r.decision ? label(r.decision) : r.end_reason === 'completed' ? 'Awaiting decision' : '—'
            }}<small v-if="r.decision_at">{{ date(r.decision_at) }}</small>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <ReportPager v-if="records.total > 20" :page :total="records.total" @go="$emit('go', $event)" />
</template>
