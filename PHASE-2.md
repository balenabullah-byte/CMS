# Phase 2 implementation and verification

## What changed

The existing repository already had Vue Router, a Pinia workspace store, one fetch client, local Inter fonts, responsive navigation and forms for reporting, assignment, campus configuration and account management. The server already provided Express routes, Joi validation, class-based Knex modules, file-backed sessions, a role middleware and transaction-based maintenance controllers. The database definition is in `server/schema.sql` and includes seed rows, foreign keys, workflow triggers and an append-only history. The supplied workspace had no Git metadata or AGENTS.md.

The main gaps were a combined dashboard for multi-role accounts, a light-only interface, unprotected last-administrator changes, technician entry by numeric ID, and search limited to the current report page. Phase 2 extends these existing surfaces. It adds no dependencies or schema migrations. All work on live development accounts was read-only at the database level. Session tests created temporary files. Workflow and account mutation tests used randomly named disposable databases.

## Portal walkthrough

Sign in at `/login` with an existing university account. The router loads `/api/me`. Multi-role users start in admin, coordinator, technician, then member priority and can switch in the header. The URL preserves the selected portal across refreshes and links. An account with no recognized role can view its access message and sign out.

| Development account | Dashboard | What to exercise |
|---|---|---|
| admin@uni.edu | /admin/dashboard | Open Users and roles. Search or filter accounts, create an account, grant an existing role, reset a password, or update active status. Buildings, rooms, categories and technician skills use their existing editors. |
| student@uni.edu and faculty@uni.edu | /member/dashboard | Report an issue using a building, optional room and category. Open My reports to search by reference, title or building and follow public history and comments. |
| staff@uni.edu | /coordinator/dashboard | Review a submitted report, approve it, choose an active technician and optionally add instructions. Monitor work by technician or building. Review the completion note before closing or reopening. |
| contractor@uni.edu | /technician/dashboard | Open My jobs, start the assigned repair, add staff-only progress and submit a completion note. Completed assignments remain in the job log. |

Use isolated accounts and fixtures for write testing. The existing separate role-grant operation allows accounts to be provisioned before an administrator grants portal access. Sign-out is in the profile menu destination.

## Authorization and workflow

The server reloads the active account, password-hash version and memberships for each authenticated request. The existing scrypt1 password utility and cookie session implementation handle login, password reset invalidation, expiry and logout. The optional `X-Campus-Role` header restricts the request to one current membership. Existing API clients can omit it and use their assigned permissions. Campus member type has no bearing on either path.

Admin manages accounts, memberships and configuration. Disabling an account or revoking a role locks the admin role in a transaction before checking active administrators. Coordinator manages operational reports and assignments. Technician writes require an active assignment owned by the session user. Members can create and read their own reports. Public history excludes assignment audit events, internal notes and actor IDs. Staff-only progress and instructions stay in the staff comment stream. The existing admin-only aggregate maintenance statistics policy is retained.

The normal path is `submitted → approved → assigned → in_progress → completed → closed`. Coordinator closure records verification using the existing closure actor and timestamp. Reopening requires a reason. Reassignment ends the old assignment within the same transaction. The workflow uses the existing row locks and database triggers. Unauthorized roles receive 403, missing or invalid sessions receive 401, and inaccessible individual records use the established 404 convention.

## API changes

Paths below are relative to `/api`.

| Endpoint | Behavior |
|---|---|
| GET /technicians | New coordinator directory containing only IDs and names of active technician accounts. |
| GET /assignments/:id | New scoped assignment lookup. Coordinators see operational jobs and technicians see their own. |
| GET /maintenance-requests/summary | New scoped counts by persisted status for coordinators and members. |
| GET /maintenance-requests | Adds search across the full authorized queue and active or ready filters. Closed results sort by closure date. |
| GET /maintenance-requests/:id and its /history | Limits operational information returned to reporters. |
| GET /assignments | Adds request, location, priority and technician display fields, with optional request_id filtering. |
| POST /maintenance-requests/:id/assignments and /reassign | Accept optional instructions, stored as a staff comment in the assignment transaction. |
| GET /users | Includes role codes alongside existing safe account fields. |
| PATCH /users/:id and DELETE /users/:id/roles/:role_id | Reject removal or deactivation of the final active admin with 409. |
| GET /buildings, /rooms, /maintenance-categories and their detail routes | Require a recognized portal role. Existing admin write restrictions apply. |

## Interface and themes

The installed **Impeccable 4.7.0** skill is at `C:/Users/MIQDAD/.agents/skills/impeccable/SKILL.md`. Its context launcher identified an incumbent interface. The implementation follows the Operate and craft-floor references, retaining the local font, putting the coordinator's actionable queues first and keeping forms, state badges, keyboard focus and navigation consistent. The repository also contains `skills/frontend-app-builder/SKILL.md` and desktop/mobile reference captures under `design/`.

The login screen and portal header offer Light, Dark and System. A small head script reads only the theme preference before Vue mounts. Semantic CSS colors use the selected color scheme and respond to operating-system changes in System mode. Sidebar collapse is in memory. Native dialogs and confirmation prompts handle protected interactions. The design detector flagged the two declarations of the existing Inter font. Retaining the project's bundled family was deliberate.

## Verification

| Check | Observed result |
|---|---|
| Development identities | All five IDs, emails, active flags and role assignments matched. All five signed in through the API and browser, loaded their expected dashboards and signed out. |
| Node unit and HTTP tests | 10 passed. Coverage includes password verification, actual expiry, cookie revocation, request field restrictions, closure authorization, transaction ordering and response status. |
| Isolated database API run | 117 HTTP assertions passed. Additional direct database assertions verified the persisted closure actor, request status, completed assignment and technician. Coverage includes concurrency, privacy, role restrictions, invalid transitions, password version changes, inactive sessions and last-admin protection. |
| Browser integration | Passed on installed Chromium using the production build and a disposable database. Covered report creation through verification and closure, member visibility, multi-role switching, no-role handling, access denial, validation, loading, empty results, failed reads and retry, session recovery and sign-out. |
| Responsive and theme checks | Verified all four dashboards at 375, 768, 1024 and 1440 px, light and dark selections, refresh persistence, live System preference changes, mobile drawer Escape, keyboard focus and a long account name. Checked the coordinator desktop and technician mobile renders and a dark tablet render. |
| Contrast | Ten text/background token pairs in each palette exceeded 4.5 to 1. The minimum sampled ratios were 5.17 in light and 6.30 in dark. |
| Production build | Vite build passed. The package defines no separate lint or type-check script. |

Browser checks recorded uncaught page errors, unexpected console errors and failed network transports. The suite intentionally exercises failed HTTP responses. The checked-in QA viewer continues to display its labeled earlier verification snapshot unless a different JSON report is opened.

## Run locally

From the project root with the existing database configuration, start the API and Vite in separate PowerShell terminals.

```powershell
node server/index.js
```

```powershell
npm.cmd run dev
```

Open the local URL Vite prints. On deployment, forward /api to Express and configure HTML history fallback for the frontend. Run the tests with the existing local test database setup described in [the server guide](server/README.md). The integration harness requires TEST_DB_PORT, TEST_DB_USER and, when needed, TEST_DB_PASSWORD. The test account must be able to create a fresh database. Set CHROMIUM_PATH to the installed Chromium executable for the browser run.

```powershell
npm.cmd test
npm.cmd run test:api
npm.cmd run build
npm.cmd run test:ui
```

## File inventory

Created `src/components/ThemeSelect.vue` and this report. Updated `README.md` and `index.html`. The build regenerated `dist/`.

| Directory | Modified files |
|---|---|
| src | App.vue, QaResults.vue, workspace.css |
| src/lib and src/router | api.js, workspace.js, router/index.js |
| src/components | CoordinatorActions.vue, Queue.vue, RecordEditor.vue, RequestTable.vue, Shell.vue |
| src/views | Admin.vue, AssignmentDetail.vue, Assignments.vue, Buildings.vue, Dashboard.vue, Login.vue, RequestDetail.vue, Requests.vue, Unavailable.vue |
| server/middleware | auth.middleware.js |
| server/controller | assignment.controller.js, maintenance.controller.js, user.controller.js |
| server/module | assignment.module.js, history.module.js, maintenance.module.js, user-role.module.js, user.module.js |
| server/routes | assignment.route.js, building.route.js, category.route.js, maintenance.route.js, room.route.js, user.route.js |
| server/validation | assignment.validation.js, maintenance.validation.js |
| server/tests | api-full-test.mjs, backend.test.js, ui-integration.mjs |

## Scope and verification limits

The schema supports buildings and rooms with floor numbers. Attachments, completion photos and notifications have no corresponding storage model. The administrator directory and technician workload views retrieve paged results before filtering or grouping in the browser. Large-campus load testing remains outstanding. Browser verification covered Chromium and sampled keyboard and contrast behavior. Safari, Firefox, assistive-technology testing and a complete WCAG 2.2 AA audit remain unverified.
