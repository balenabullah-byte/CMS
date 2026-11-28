# Phase 3.4 fixes and development fixtures

## Configuration diagnosis

The API reads `server/.env` once at startup using Node's native environment loader. The live API process started at 09:23 on November 28. The configuration file containing the valid desktop frontend origin was saved at 09:54. A fresh process loaded and accepted `http://localhost:5173`. The old controller used the same 503 message for a missing value and an invalid URL. The QR Labels screen surfaced that API response.

Environment initialization now has a dedicated entry module imported before the application routes and database connection. Launch Express with `npm run api` from the project root. After an edit, stop the backend in its terminal with Ctrl+C and run that command again. Check `http://127.0.0.1:3000/api/health`, then retry **Generate labels**. A shell-level environment override takes precedence over the file. Missing and invalid origins now produce distinct recovery messages. The server example sets the desktop development value. Production requires the deployment's public HTTPS domain.

## Register an asset manually

1. Sign in to the administrator portal. Open **Asset management → Asset categories** and use **New category** if the appropriate active category is missing.
2. Open **Asset directory → Register equipment**. Enter the equipment name, choose an active category and building, and optionally select one of that building's active rooms.
3. Choose the operational status. Expand **Equipment details and warranty** for manufacturer, model, serial number and dates. Leave unknown fields blank.
4. Select **Save**. The detail page shows the generated asset code, location and equipment information. Use **Edit equipment** for descriptive changes, **Change status** for a condition change and **Retire** for a reasoned retirement.

## Seed and verify

Use an active development administrator account. Put its email and password in the ignored `server/.env` as `CMS_DEV_ADMIN_EMAIL` and `CMS_DEV_ADMIN_PASSWORD`. Keep the credentials local. Run from the repository root:

```powershell
npm run seed:assets -- --development --confirm=cms_maintenance
```

The flags confirm the named local database. The seed checks the live database, administrator password and role, validates inputs using the application schemas, and creates assets through the existing audited registration, status and retirement operations. It runs in one transaction, serializes concurrent runs and preserves records with existing fixture serials. Output distinguishes reused assets from serial collisions and inactive categories that were skipped. Dates in fixture warranties are fictional and relative to the first seed run.

To generate the six development labels and exercise the persisted projector report, also configure `CMS_DEV_STUDENT_EMAIL`, `CMS_DEV_STUDENT_PASSWORD` and `CHROMIUM_PATH` (the Chrome executable). Start Vite and Express with the desktop origin and run:

```powershell
node server/tests/dev-qr-fixtures.mjs --confirm=cms_maintenance
```

This creates or reuses active labels through the administrator interface, downloads and decodes each PNG, then uses a fresh browser context to open the projector link and sign in as the student. Repeated runs reuse the matching test report. For a phone, use the authorized private frontend origin and follow the README's loopback database and firewall instructions. A phone cannot reach the developer PC using its own localhost.

Read-only verification in phpMyAdmin, with `cms_maintenance` selected:

```sql
SELECT a.asset_code, a.serial_number, c.name AS category, b.code AS building,
       r.room_code, a.operational_status, a.warranty_expires_at
FROM assets a JOIN asset_categories c ON c.id=a.asset_category_id
JOIN buildings b ON b.id=a.building_id LEFT JOIN rooms r ON r.id=a.room_id
WHERE a.serial_number LIKE 'CMS-TEST-%' ORDER BY a.asset_code;
SELECT id, asset_id, room_id, building_id, revoked_at FROM qr_codes ORDER BY id;
SELECT id, asset_id, qr_code_id, reporting_source, status FROM maintenance_requests
WHERE title LIKE 'TEST QR projector report%';
SELECT n.request_id,n.portal,n.event_type,COUNT(*) AS recipients
FROM notifications n JOIN maintenance_requests m ON m.id=n.request_id
WHERE m.title LIKE 'TEST QR projector report%' GROUP BY n.request_id,n.portal,n.event_type;
```

## Verification and files

The production build, 13 unit tests, 179 QR and asset HTTP checks and 255 viewport/theme checks passed in the final regression run. Chromium exercised category creation, equipment registration, saving and re-reading an edited model, status dialogs, details, analytics, QR configuration errors, PNG download and decoding, and mobile report submission. The separate two-technician API and browser regression passed through submission, approval, assignment, completion, closure, reopening, reassignment, cancellation and rejection.

The seed ran twice against a disposable database. Its first transaction created six categories and 20 assets distributed 14 operational, three under maintenance, two out of service and one retired. Its second run reused all six categories and 20 assets, with zero creations or skips.

Changed files include `server/environment.js`, `server/connection.js`, `server/index.js`, `server/controller/qr.controller.js`, `server/.env.example`, `package.json`, `server/seeds/dev-assets.mjs`, `server/tests/{dev-qr-fixtures,qr-acceptance,asset-management}.mjs`, `README.md` and this report. The existing Vue pages supply the registration and reporting workflows.

## Working database status

The local API restarted and its health endpoint returned 200. The database has five active buildings and five active rooms. Room labels are 204, TEST-101, RUN-102, R-P6B7 and 3212. Their codes do not establish a classroom or laboratory designation.

Both configured account emails match active accounts with the requested roles. The running API returned HTTP 401 for both supplied password pairs. Working-database generation and student submission await valid sign-ins. Read-only counts at this checkpoint were zero assets, zero asset categories, zero location history rows, zero QR codes, zero QR-sourced requests, zero asset/category/QR audit events and zero QR report notifications. The isolated fixture counts above belong only to the disposable database.
