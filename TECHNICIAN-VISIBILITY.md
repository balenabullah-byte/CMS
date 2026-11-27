# Technician request visibility preflight

## Finding

A technician who also held the coordinator role could learn that a student had submitted a report, see its request ID, and open its coordinator notification from the technician portal. The account was entitled to that notice in the coordinator portal. The technician-only account received zero submission notices. Both accounts' active job queries returned zero rows at submission. The original manual session's account memberships and network capture were unavailable, so the observed notification leak is the specific case established here.

### Chromium network evidence

The fixture submitted one report before creating any assignments. Both browsers sent the technician portal header. The values below are API response data from the production Vue build against a disposable database.

| Request | Technician only, before | Technician + coordinator in technician portal, before | After correction |
| --- | --- | --- | --- |
| `GET /api/work-records?scope=active&limit=6` | 0 rows | 0 rows | 0 rows for both |
| `GET /api/notifications?event_type=submitted&limit=20&offset=0` | 0 rows | 1 row with `portal=coordinator` and `request_id=1` | 0 rows for both. The coordinator inbox still receives the report. |

Authentication already verified the browser's portal header against current memberships. The notification inbox then discarded that effective role and queried all of the account's role memberships again. The bell and notification center used that response. The open-record action could navigate to a different portal held by the same account. Submission delivery itself correctly targeted coordinators.

The shared request query already checked the authenticated technician's unfinished assignments. The work-record query started from assignments. The database view `v_maintenance_board` left-joins the active assignment and intentionally includes unassigned requests. No technician API query uses that view. The existing triggers enforce submission status, transition order, assignment eligibility, a single active assignment and historical immutability.

## Corrections

| Surface | Implemented behavior |
| --- | --- |
| Role-protected APIs | Single-role sessions retain their existing behavior. Multi-role clients must send their selected `X-Campus-Role`. The server verifies membership, and an ambiguous role-protected request receives 403. Identity and sign-out remain available independently of the selected portal. |
| Notifications | List, count, mark-one and mark-all use the authenticated account and effective portal. Each eligible portal can receive its own deduplicated event when a person participates in two capacities. The bell resets on portal changes. Opening a record stays in the same portal and the destination rechecks ownership. |
| Request detail, lists, comments, history and attachments | Technician operational reads require an assignment owned by the authenticated account, an empty `ended_at`, and request status `assigned` or `in_progress`. Related reads use one database snapshot. Comment writes acquire the same request lock as reassignment before checking access. Restricted individual records return 404. |
| Deadlines, job searches and counts | The deadline list uses the active assignment rule. Assignment rows and totals share an account-scoped base query before filtering or pagination. Technician summaries count that person's work. The dashboard and My Jobs use active job data. |
| Ended assignments | The technician retains their own assignment identifiers, outcome, recorded labor, completion details and the verification decision for that repair. History omits live deadlines, priority, request status, private description and location notes. Later assignments and new comments require fresh operational access. |
| Technician UI | The dashboard uses its existing active-assignment panel and empty state. The request directory is restricted to coordinators and campus members. A technician can still open an assigned request from the job. My Jobs enforces active scope, including on bookmarked URLs. Work History distinguishes completed, cancelled and reassigned records. |

### Files changed for this preflight

- Backend middleware and controllers in `server/` — `middleware/role.middleware.js`, `controller/maintenance.controller.js`, `controller/operations.controller.js`.
- Query modules in `server/module/` — `assignment.module.js`, `attachment.module.js`, `comment.module.js`, `deadline.module.js`, `history.module.js`, `maintenance.module.js`, `notification.module.js`, `report-filters.js`.
- Vue files in `src/` — `router/index.js`, `components/Shell.vue`, `components/CompletionRecord.vue`, and the `Dashboard`, `Assignments`, `AssignmentDetail`, `RequestDetail` and `Operations` views.
- Verification — `package.json`, `server/tests/api-full-test.mjs`, `server/tests/technician-visibility.mjs`, and this report.

## Verification

The new scenario uses a student, a coordinator, and two eligible technicians with distinct IDs. One technician also holds coordinator membership to exercise portal separation. It signs in through the API, uses independent browser cookie jars and checks HTTP response bodies as well as rendered pages.

| Check | Result |
| --- | --- |
| Submission and approval without assignment | Both technician portals had zero matching reports, jobs and deadlines. Direct detail, comments, attachment metadata and history requests returned 404. The coordinator received the submission and the student received the approval. |
| Assignment, start and completion | Only technician A received the assignment notice and job. B's direct request and assignment URLs, API reads and start attempt were denied. Searching with A's technician ID gave B zero rows. Verification contained the completed repair. |
| Closure and historical access | The student saw the closed result. A's history retained the completed job and closure decision. Its active count dropped to zero, modification was denied, and B continued to receive 404 for the assignment. |
| Reopen, reassignment and rejection | Reopening required a new assignment for operational access. Reassignment moved the job to B. A's old notification opened only A's historical assignment. Later private comments and B's assignment stayed outside A's scope. Cancellation retained its own end reason. Rejection remained visible to the student. |
| Notifications and counts | Deadline processing twice produced one notice per coordinator per event and zero technician-portal deadline notices. Unread updates stayed in the selected portal. A public comment reached the correct portals when one account was both coordinator and assigned technician. |
| Existing suites | Production build passed. All 13 unit tests and 186 API checks passed. The migration and immutability fixtures passed. The four-role Chromium suite passed its end-to-end repair workflow, conflict recovery, theme and responsive checks. |

At 390 × 844, the before-and-after technician dashboard renders retained the navigation, theme control, heading typography, assignment panel spacing and zero-job message. The general recent-request panel was removed. Playwright Chromium provided the browser and network capture.

Run `npm run test:visibility` with the local MariaDB test credentials and Chromium configuration described in [the server guide](server/README.md). The harness creates and removes a random database for each run. Deployment to a running campus instance is outside this preflight. The correction adds no tables or migrations.
