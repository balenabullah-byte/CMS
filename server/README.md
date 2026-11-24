# Campus maintenance API

## Start on Windows

Use the project's supported Node version and start MySQL in XAMPP. From the project root run:

```powershell
npm ci
Copy-Item server/.env.example server/.env
```

Set DB_USER and DB_PASSWORD to the credentials for your existing database. Use a runtime account with SELECT, INSERT, UPDATE and DELETE privileges as needed. The defaults connect to cms_maintenance on 127.0.0.1:3306. Set SESSION_DIR to a private directory outside OneDrive and the web root, for example an absolute path under your local AppData folder. Restrict its Windows permissions to your account. Node reads server/.env on startup.

```powershell
node server/index.js
node --test server/tests/backend.test.js
```

## First administrator

Use a new email. The command below inserts a new user and its admin membership together. A duplicate email rolls back the transaction. Run only when you intend to create a real account. Placeholder hashes cannot authenticate.

```powershell
$env:ADMIN_EMAIL = Read-Host 'New admin email'
$env:ADMIN_NAME = Read-Host 'Full name'
$secret = Read-Host 'New password (12 to 256 characters)' -AsSecureString
try {
  $env:ADMIN_PASSWORD = [Net.NetworkCredential]::new('', $secret).Password
  node server/scripts/create-admin.js
} finally {
  Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
  $secret.Dispose()
}
```

## Postman walkthrough

1. For workflow testing, point DB_NAME at a disposable copy with the inspected schema, role codes and triggers. Postman write requests persist changes. Import Campus Postman Collection.json and send health.
2. Enter your admin email and password in local Postman variables. Send login then me. Postman's cookie jar carries the session. Use the same host for every call.
3. List roles. Create a member, technician and coordinator with separate emails. Save each returned user ID and grant the appropriate role using userId and roleId. Record technicianId. Create or select a building, room and category. Copy returned IDs into the corresponding variables.
4. Log out and log in as the member. Submit a request, save requestId, and read its detail, comments and history.
5. As coordinator, approve, set priority and assign the technician. Save assignmentId. As that technician, start, record progress and complete the assignment.
6. As coordinator, inspect the completion note via GET /assignments. Close if verified, or reopen with a reason and assign again. Try rejection on a separate submitted request. Reassignment during active work creates a new assignmentId.
7. Verify a different member cannot fetch the request, a member cannot see staff_only comments, and a technician cannot close it. Authenticated lists accept limit and offset where pagination is supported. Requests also accept status.

## Routes

All paths below start with /api. An asterisk means any authenticated user. Success responses wrap the result in data. Errors wrap a message in error.

| Endpoint | Roles | Success |
| --- | --- | --- |
| GET /health | public | 200 |
| GET /buildings | * | 200 |
| GET /buildings/:id | * | 200 |
| POST /buildings | admin | 201 |
| PATCH /buildings/:id | admin | 200 |
| GET /rooms | * | 200 |
| GET /rooms/:id | * | 200 |
| POST /rooms | admin | 201 |
| PATCH /rooms/:id | admin | 200 |
| GET /maintenance-categories | * | 200 |
| GET /maintenance-categories/:id | * | 200 |
| POST /maintenance-categories | admin | 201 |
| PATCH /maintenance-categories/:id | admin | 200 |
| GET /users | admin | 200 |
| GET /users/:id | admin | 200 |
| POST /users | admin | 201 |
| PATCH /users/:id | admin | 200 |
| GET /users/:id/roles | admin | 200 |
| POST /users/:id/roles | admin | 201 |
| DELETE /users/:id/roles/:role_id | admin | 200 |
| GET /roles | admin | 200 |
| GET /roles/:id | admin | 200 |
| PATCH /roles/:id | admin | 200 |
| POST /auth/login | public | 200 |
| POST /auth/logout | * | 200 |
| GET /me | * | 200 |
| GET /technician-skills | admin coordinator | 200 |
| POST /technician-skills | admin | 201 |
| DELETE /technician-skills/:technician_id/:category_id | admin | 200 |
| GET /maintenance-requests | campus_member coordinator technician | 200 |
| POST /maintenance-requests | campus_member | 201 |
| GET /maintenance-requests/:id | campus_member coordinator technician | 200 |
| GET /statistics | admin | 200 |
| PATCH /maintenance-requests/:id/approve | coordinator | 200 |
| PATCH /maintenance-requests/:id/reject | coordinator | 200 |
| PATCH /maintenance-requests/:id/close | coordinator | 200 |
| PATCH /maintenance-requests/:id/reopen | coordinator | 200 |
| PATCH /maintenance-requests/:id/priority | coordinator | 200 |
| GET /maintenance-requests/:id/history | campus_member coordinator technician | 200 |
| GET /maintenance-requests/:id/comments | campus_member coordinator technician | 200 |
| POST /maintenance-requests/:id/comments | campus_member coordinator technician | 201 |
| POST /maintenance-requests/:id/assignments | coordinator | 201 |
| POST /maintenance-requests/:id/reassign | coordinator | 201 |
| GET /assignments | technician coordinator | 200 |
| PATCH /assignments/:id/start | technician | 200 |
| PATCH /assignments/:id/progress | technician | 200 |
| PATCH /assignments/:id/complete | technician | 200 |

## Storage and operation

MariaDB triggers create submission, transition and assignment history. Workflow transactions lock the request before changing assignments. The generated active_request_id unique index provides an additional database constraint. Roles are the four existing permission codes. Administrators can change descriptions and grant or revoke memberships.

The session cookie expires after eight hours. Sessions persist across process restarts in SESSION_DIR. Expired records can be removed after eight hours. Rate limits apply per IP per process. Production cookies require HTTPS. The local API listens on loopback.

Attachments need private storage, validated image uploads, and authorized download handling. The API exposes no attachment routes.

## Workflow and automated verification

Rejected is a terminal state. Reopen requires a coordinator and a reason. The API and the MariaDB transition trigger enforce the following rules.

| Current status | Allowed next statuses |
| --- | --- |
| submitted | approved, rejected |
| approved | assigned |
| assigned | in_progress, reopened |
| in_progress | completed, reopened |
| completed | closed, reopened |
| closed | reopened |
| reopened | assigned |
| rejected | none |

Reopening cancels an active assignment and records the reason. Completed assignments retain their completion records. Reassignment ends the old assignment and creates another in one transaction, passing through reopened. A blocked transition returns 409 before changing assignments or adding history.

Run `npm test` for database-independent checks. Run `npm run test:api` against a local MariaDB test server with `TEST_DB_PORT`, `TEST_DB_USER` and, if required, `TEST_DB_PASSWORD` set in your shell. The test account needs permission to create and drop test databases and install triggers and views. The runner creates a randomly named database, installs the schema from `server/schema.sql`, creates synthetic accounts, starts Express on an ephemeral loopback port, then removes its test database and sessions. The ordinary application reads `server/.env`. Supply test credentials separately.

Set `TEST_REPORT_FILE` to a JSON file path to save an integration run. The runner exits unsuccessfully on a mismatch or setup error. The dashboard starts with the included verification run. Use **Open JSON report** to inspect another run. A matching expected 401, 403 or 409 passes. A status mismatch or failed data assertion fails. An informational note has no expected or actual status and is excluded from the test count and pass rate.
