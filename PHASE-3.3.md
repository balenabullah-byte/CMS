# Phase 3.3 · Campus asset management

**Implemented and applied to the development database.** The equipment register is available in the administrator and coordinator portals. Campus members can link equipment to an ordinary maintenance report. Technicians receive equipment context through their own active assignments.

## Preflight

The checkout was on the existing `phase-3.3` branch at `96ee3cf`, with the existing `v3.2.0` tag at `ab47f64`. The configured origin matched the requested CMS repository. The initial working tree was clean. Inspection found migrations 002.1 and 003, the Vue and Express applications, Phase 2 documentation and the technician visibility report. No repository-specific AGENTS.md was present.

The production build, 13 unit tests, 186 API checks, four-role browser workflow and two-technician visibility regression passed before asset implementation. The tests exercised notification delivery and portal isolation, audit records, priority policy snapshots, deadlines and technician recommendations. Both technician portals returned zero active jobs and zero submission notices before assignment. The mixed-role technician retained coordinator access only in the coordinator portal. [Technician authorization preflight](TECHNICIAN-VISIBILITY.md)

## Database execution

| Check | Observed result |
| --- | --- |
| Target | `cms_maintenance` at `127.0.0.1:3306`, MariaDB 10.4.32 |
| Before | 16 base tables, one view, 12 triggers. Migration 003 tables were present. The request table had no asset reference. |
| Isolated upgrade | Applied migration 004 twice to a disposable Phase 3.2 schema containing a user, building and submitted report. The existing report acquired a null asset reference. The request-to-asset foreign key existed once after the second application. |
| Backup | Created a 58,854-byte logical dump with a consistent InnoDB snapshot, triggers, routines and events. Verified the completion marker, all prior table definitions, view and trigger names, and SHA-256 digest. The backup verification did not include a full restore rehearsal. |
| Development execution | Applied only `server/migrations/004_asset_management.sql` on November 27, 2026. Verified 19 base tables, one view, 14 triggers, nullable request reference, the asset/status index, and foreign-key metadata. All existing table row counts and prior trigger and view definitions matched pre-migration values. |
| Service verification | Restarted the local Express API. Health returned 200. The new inventory, category, lookup and analytics endpoints required authentication. Live inventory, analytics and deadline queries succeeded. |

The backup is outside the repository at `%LOCALAPPDATA%\CampusResourceHub\backups\cms_maintenance-before-004-2026-11-27T18-31-06.474Z.sql`. Its SHA-256 digest is `3de723c5378af2aa91ca2fdb6e9789cbb139be09b66813b6c237518a17769420`.

The migration creates `asset_categories`, `assets` and `asset_location_history`, then adds nullable `maintenance_requests.asset_id`. Composite room/building foreign keys enforce location relationships. Two triggers reject changes to existing transfer records. The clean-install schema contains the same DDL. [Migration 004](server/migrations/004_asset_management.sql)

## Permissions and workflow

| Portal | Available operations |
| --- | --- |
| Administrator | Create, edit, activate and deactivate categories. Register equipment, edit descriptive fields, set operational status, transfer or retire equipment, inspect warranty, browse both histories and open analytics. |
| Coordinator | Search the register, inspect equipment, warranty, location and maintenance history, and review and assign linked reports. Record a condition recommendation in staff comments. |
| Technician | View identifying equipment details and previous completed repairs for the same asset through an active, owned assignment. Record a staff-only condition recommendation. Ended assignment history retains the stable equipment code and the technician's own assignment record. |
| Campus member | Look up equipment by the selected building and optional room. The picker and member equipment response expose only ID, code and name. The owner can submit and follow their request. |

Registration uses the database-assigned auto-increment ID. The registration transaction replaces a unique provisional key with the final code, such as `AST-000001`, before commit. The API keeps codes stable across edits, transfers and retirement. Optional manufacturer, serial, warranty and purchase data stay null until supplied. No sample inventory is installed in the working database.

Registration and transfer require an active building and an active room belonging to it when a room is selected. In the reporting form, a building-only selection lists building-level equipment. Selecting a room lists that room's equipment. **General location issue** submits a report without an asset.

Asset submission, transfer and retirement lock the equipment row. Reopening a linked request also participates in that lock. Transfer and retirement reject unresolved requests, including completed repairs awaiting coordinator verification. Transfers require a different location and a reason. Retirement requires a reason and retains the asset and its histories. An administrator can directly change canonical status. Closing a repair leaves that status under administrative control.

Successful administrative writes and their audits share one transaction. A transfer commits the location change, immutable movement record and audit together. Condition recommendations use the existing staff-comment permissions and notifications. The report's original building and room remain on the request after a transfer.

Maintenance history joins the existing request, assignment and verification records. It includes unassigned requests, assignment outcomes, repair notes, materials, cause, recorded labor, verification decisions, reopening and reporting locations. The technician view limits previous repairs to completed work on the same asset predating their assignment. Access ends at completion, cancellation or reassignment.

## API reference

All paths use the existing `/api` prefix, session authentication and portal authorization. Multi-role clients supply the selected `X-Campus-Role`. List responses use `rows` and `total` with validated limit and offset parameters.

| Method and path | Permission and purpose |
| --- | --- |
| `GET /asset-categories` | Administrator or coordinator. Search or filter by active state. |
| `POST /asset-categories`, `PATCH /asset-categories/:id` | Administrator. Manage category codes, names, descriptions and availability. |
| `GET /assets` | Administrator or coordinator. Search name, code or serial. Filter by category, building, room or status. Sort and paginate. |
| `POST /assets`, `PATCH /assets/:id` | Administrator. Register equipment or edit descriptive fields. |
| `GET /assets/:id` | Administrator or coordinator. Read current equipment details. |
| `PATCH /assets/:id/status` | Administrator. Set operational, under maintenance or out of service. |
| `POST /assets/:id/transfer`, `POST /assets/:id/retire` | Administrator. Perform a reasoned transfer or retirement. |
| `GET /assets/:id/history`, `GET /assets/:id/locations` | Administrator or coordinator. Page through maintenance or movement records. |
| `GET /asset-lookup` | Campus member. Requires building, accepts optional room, search and pagination. |
| `POST /maintenance-requests` | Campus member. Accepts optional `asset_id` and validates the equipment's current location and status. |
| `GET /maintenance-requests/:id/equipment` | Request owner, coordinator or actively assigned technician. Returns equipment fields and repair history appropriate to that portal. |
| `GET /analytics/assets` | Administrator. Optional inclusive `from` and `to` calendar dates. |

Analytics count current inventory by category, building, room and operational status, distinct assets with unresolved requests, retired assets, and current warranty buckets. Date filters apply to registrations, report frequency and completed repair events. Report counts come from requests and labor comes from completed assignments. A reassignment cannot multiply a report count. A recorded zero contributes a labor observation. Missing labor yields an unknown total when there are no observations.

## Test results

All workflow mutations used disposable databases and synthetic accounts. The operational database was used for the migration, backup and read-only service checks.

| Verification | Result |
| --- | --- |
| Build, unit and previous phases | Production Vue build passed. All 13 unit tests and 186 existing API checks passed. Previous migration, immutable records, four-role browser workflow and two-technician authorization suites passed. |
| Asset acceptance | 137 checked HTTP responses plus browser and persistence assertions. A student reported a registered projector, coordinator approval alone granted neither technician access, and assignment admitted A while B remained excluded. A recorded an electrical cause, lamp assembly, completion note and 45 labor minutes. The coordinator closed the request and the student received the closure notice. |
| Location and history | The projector moved from Engineering Hall 101 to 203. Its report and repair history retained room 101. Both update and deletion of the movement record failed at the database level. A simulated audit-insert failure rolled back the transfer and history insert. |
| Lifecycle and concurrency | Five concurrent registrations produced distinct stable codes. Invalid room/building pairs, inactive locations and categories, direct location/code edits, missing retirement reasons, retired-asset reports and transfers with open work were rejected. A concurrent report and transfer admitted one winner and left a consistent location. |
| Authorization and integration | Tested restricted asset endpoints, direct request access, notification recipients, active deadlines, recommendations, staff-only condition comments, reopening and reassignment. The former technician retained their own assignment history. B received prior repair context only after assignment to the projector. General location reports still worked. |
| Audit, search and analytics | Verified actor IDs across successful administrative operation types, serial and building searches, sorted and paginated responses, and rendered search results. A fixture with six assets, a reopened report and three assignments on that report produced one completed repair, 45 recorded minutes and one report for the projector. Empty date ranges returned unknown recorded labor. |
| Responsive and keyboard | 195 checks across 13 screen or dialog states, five widths and three theme modes. Checked system theme against both OS settings, page overflow, keyboard focus and Escape in dialogs, role-specific mobile navigation, and the transfer-conflict error state. |

### Visual verification

Impeccable and the repository's Frontend App Builder skill guided the implementation. The existing maintenance-history design supplied the visual reference. Playwright Chromium provided a real renderer and network capture in this environment. The shell, navigation rail, page titles, control sizes, table density, semantic status colors and mobile table scrolling use the existing design system. Native dialogs contain focus and restore it when closed. Mobile verification prompted a change that keeps **Start work** above the new equipment details.

The viewport matrix covered 375, 768, 823, 1024 and 1440 pixels. Screenshots show synthetic data. [Design reference](design/phase-2.1/history-concept.png) · [Desktop directory](design/phase-3.3/directory-1440-light.png) · [Tablet directory](design/phase-3.3/directory-823-system.png) · [Mobile registration](design/phase-3.3/register-dialog-375-dark.png) · [All captures](design/phase-3.3)

## Implementation files

| Area | New or modified files |
| --- | --- |
| Database | `server/migrations/004_asset_management.sql`, `server/schema.sql` |
| Asset API | `server/module/asset.module.js`, `server/module/asset-analytics.module.js`, `server/controller/asset.controller.js`, `server/routes/asset.route.js`, `server/validation/asset.validation.js`, `server/index.js` |
| Existing workflow | `server/module/maintenance.module.js`, `server/module/assignment.module.js`, `server/module/audit.module.js`, `server/validation/maintenance.validation.js`, `server/validation/reporting.validation.js` |
| Vue screens | `src/views/Assets.vue`, `AssetDetail.vue`, `AssetAnalytics.vue`, `NewRequest.vue`, `RequestDetail.vue`, `AssignmentDetail.vue` |
| Vue shared UI | `src/components/AssetDialog.vue`, `AssetHistory.vue`, `RequestEquipment.vue`, `Shell.vue`, `src/lib/assets.js`, `src/router/index.js`, `src/workspace.css` |
| Verification and documentation | `server/tests/asset-management.mjs`, `package.json`, `design/phase-3.3/`, `PHASE-3.3.md` |

## Manual verification

1. Sign in as administrator. Under **Asset management**, create an active category, then register a projector in an active building and room. Record the generated asset code.
2. Sign in as a student. Open **Report an issue**, select the same building and room, choose the projector, and submit a maintenance report. Use **General location issue** for a separate report to check the optional path.
3. Open the coordinator's incoming queue and approve the projector report. Check both technicians' **My jobs** and notifications before assignment. Assign A and verify only A receives the job.
4. Start work as A, inspect the equipment and previous repairs, and record completion details. Verify and close the request as coordinator. Check the student's closure notice and A's completed work history.
5. On the administrator asset detail page, inspect maintenance history, then transfer the projector. Compare its current location with the report's original location. Check **Location history**, **Administrative audit** and **Asset analytics**.

Run `npm run test:assets` to repeat the isolated projector workflow. It uses the same `TEST_DB_PORT`, `TEST_DB_USER`, optional `TEST_DB_PASSWORD` and `CHROMIUM_PATH` as the existing integration suites. Set `UI_SCREENSHOTS` to an existing directory to save visual evidence. [Test database setup](server/README.md)

**Remaining blockers:** none for the local development implementation or migration. Browser verification used Chromium. Production deployment was outside the requested scope. Changes remain uncommitted.
