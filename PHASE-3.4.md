# Phase 3.4 · QR maintenance reporting

Implemented on the existing `phase-3.4` branch. Migration 005 was applied to the working development database on November 28, 2026. The production origin is undecided. Label generation on the working instance requires an administrator to configure the frontend origin. Scanning and reporting use the existing university accounts and maintenance workflow.

## Database and preflight

The checkout was clean. There was no repository AGENTS.md. Inspection confirmed migrations 002.1, 003 and 004, MariaDB 10.4.32, 19 base tables, one view, 14 triggers, the asset foreign key and no QR table. The production build, 13 unit tests, existing API regression, migration regression, four-role browser suite and two-technician regression passed. The Phase 3.3 asset suite passed 137 API checks and 195 viewport/theme checks, including registration, transfer, retirement, maintenance history, audit, notifications, deadlines and technician recommendations.

Verified the Phase 3.3 backup against its documented SHA-256. Created a fresh 69,208-byte logical backup with triggers, routines and events at `%LOCALAPPDATA%\CampusResourceHub\backups\cms_maintenance-before-005-20261128-090357.sql`. Its SHA-256 was `8c7be62b69830834ffa911517f480e12a4ac51d46aa66aaa6d6c81dfa6d6acd7`. Restored it into a randomly named disposable database and applied 005 twice. Inspected the generated active-target key, token uniqueness, five foreign keys and both check constraints. Applied only 005 to `cms_maintenance` after checking its name, host and version. Verified the working QR indexes and request foreign key. All 11 pre-existing reports retained unknown reporting source. Restarted the API and checked its health and QR route authentication. [Migration 005](server/migrations/005_qr_reporting.sql)

## Resources, permissions and labels

Administrators select one or more resources of the same type under **QR labels**, or follow a label link from equipment, building or room details. Generating an active label again reuses its token. A resource row lock serializes concurrent generation, and the database enforces exactly one target and at most one active label per target. Replacement checks which active label the administrator saw. Replacement and revocation preserve history and write actor-attributed audit records in the same transaction. The audit payload excludes tokens.

Each token contains 32 random bytes encoded as 43 base64url characters. URLs are assembled when a label is requested. The downloadable PNG includes the campus identity, resource name and identifier, instruction, black-on-white symbol and four-module quiet zone. Multiple selections produce a printable sheet. Development PNGs are marked. Reprinting after configuring the permanent HTTPS domain preserves tokens.

The scan route requires an authenticated campus member. After sign-in, the reporter reviews the resolved resource, chooses a category, enters the issue and explicitly submits the existing form. Asset location is resolved on every scan. A room label permits equipment in that room. A building label also permits choosing an active room. Submission locks and revalidates the QR and location. A stale location causes a conflict, refreshes the form and requires another submission. A scan creates no visit record. Coordinators receive the ordinary report notification. Technician visibility requires an active assignment to that technician.

## API

All endpoints use the existing `/api` prefix and portal authorization.

| Method and path | Access and result |
| --- | --- |
| GET /qr/:type/:id | Administrator. Label history for an asset, room or building. |
| POST /qr/:type/:id | Administrator. Generate or reprint. Optional `replace_id` replaces that specific active code. |
| POST /qr-revocations/:id | Administrator. Revoke an issued label. |
| GET /scan/:token | Campus member. Current resource identity and reporting location. |
| POST /maintenance-requests | Campus member. Optional `qr_token` identifies the source. Server validates the submitted selections. |
| GET /analytics/qr | Administrator or coordinator. Active/revoked counts by type, distinct reports by source, reporting building and frequently reported equipment. |

The analytics use the report's original building. Historical null sources appear as **Source unrecorded**. Scan attempts never increment a report count.

## Verification

The QR acceptance run passed 178 checked API responses, 240 viewport/theme checks and 15 additional sign-in layout checks. The browser downloaded the full projector label and jsQR independently decoded its PNG to the expected URL. A signed-out scan resumed after login. A login destination on a different host fell back to the member dashboard. Tests covered invalid configuration, origin changes with stable tokens, concurrent issuance, multiple-label sheets, management permissions, building and room reports, invalid locations, inactive rooms, retired equipment, revocation, replacement, manual reporting, audit actors and analytics.

The projector report reached the coordinator. Neither technician received operational access before assignment, including after approval. Technician A completed the repair with notes, cause, materials and 45 minutes of labor. Technician B remained excluded. Closure notified the student and preserved the repair history. The original QR resolved to the new room after transfer. The original report retained its old room. Source totals counted three QR reports, including exactly one QR-linked asset report.

Impeccable and Frontend App Builder guided the extension of the existing shell and report form. Playwright Chromium exercised 375, 768, 823, 1024 and 1440px in light, dark and system modes. Screenshot review compared page hierarchy, field spacing, typography, navigation and theme contrast to the Phase 3.3 form. The scan form now displays fixed resource details once. Its submit action fits the 375px capture. The unavailable state offers a spaced, keyboard-accessible manual reporting link. The label page uses the shared secondary print button and resource-specific download names. Print media visibility and PNG decoding were tested in software. [Reference form](design/phase-3.3/member-report-375-dark.png) · [Rendered QR screens](design/phase-3.4)

## Implementation files

| Area | Files |
| --- | --- |
| Database | server/migrations/005_qr_reporting.sql, server/schema.sql |
| API and validation | server/index.js, server/{routes/qr.route,controller/qr.controller,module/qr.module,validation/qr.validation}.js, server/module/{audit,maintenance}.module.js, server/validation/maintenance.validation.js |
| Vue | src/router/index.js, src/components/{Shell,LoadState}.vue, src/views/{QrLabels,QrAnalytics,NewRequest,Buildings,AssetDetail}.vue, src/lib/qr-label.js |
| Tests and dependencies | server/tests/{qr-reporting,qr-acceptance,asset-management}.mjs, package.json, package-lock.json |
| Configuration and evidence | server/.env.example, README.md, PHASE-3.4.md, design/phase-3.4 |

Run `npm run test:qr` using the existing isolated-test MariaDB settings and `CHROMIUM_PATH`. The suite sets its own temporary application origin. Set `UI_SCREENSHOTS` to an existing directory to capture evidence.

## Phone testing and remaining setup

The README gives the private-network phone procedure and Phase 3.8 domain switch. This machine's existing XAMPP MariaDB listener was bound to `0.0.0.0:3306`. Bind it to loopback and verify that listener before enabling a LAN frontend. This phase ran the browser tests on loopback. Physical smartphone scanning, paper print quality and production deployment remain unverified. [Local phone setup](README.md#qr-maintenance-labels)
