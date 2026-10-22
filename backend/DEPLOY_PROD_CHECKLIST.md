# Production release checklist

This checklist targets the existing Render backend and Vercel frontend. It does not perform deployment, DNS changes, or the one-time data migration.

## Architecture and environment

Frontend production build environment in Vercel:
- `REACT_APP_BACKEND_URL=https://api.rfargentina.com`

Backend environment in Render:
- `NODE_ENV=production`
- `APP_BASE_URL=https://rfargentina.com`
- `CORS_ORIGINS=https://rfargentina.com` (add `https://www.rfargentina.com` only if that origin serves the app)
- `SQLITE_PATH=/var/data/rfa.db`
- `UPLOADS_PATH=/var/data/uploads`
- `BACKUP_DIR=/var/data/backups`
- `REFRESH_TOKEN_SECURE_COOKIE=true`
- `REFRESH_TOKEN_SAME_SITE=lax`
- `TRUST_PROXY=true`
- `MIGRATE_TO_PERSISTENT_DISK=false` except during the controlled first migration

Set the required secrets in Render's environment settings. Do not put secret values in Git. Cookie settings are host-only (`Domain` is omitted), use `Path=/`, and keep the refresh cookie `HttpOnly`. The CSRF value is obtained from `/api/auth/csrf`; the frontend sends it in `X-CSRF-Token` on refresh/logout. Browser requests use credentials and the backend returns credentials only to exact allowed origins.

## Custom API domain

1. In Render, open the backend web service's Custom Domains and add `api.rfargentina.com`.
2. In the domain provider, create the DNS record Render shows for that custom domain. Copy the target from Render; do not guess the target.
3. Remove conflicting `AAAA` records for the hostname while configuring it.
4. Return to Render and verify the domain. Wait until Render reports the TLS certificate active and confirm `https://api.rfargentina.com/health` responds.
5. Configure the Vercel production variable above, and verify the backend CORS allowlist contains the frontend's actual origin(s).

## Persistent storage

The Render disk must be mounted at `/var/data`. The application writes production data only beneath it:
- SQLite and its temporary/recovery files: `/var/data/rfa.db` and adjacent `.tmp`, `.bak`, `.restore-*`, `.corrupt-*` files.
- Case attachments, conversation attachments, and payment receipts: `/var/data/uploads/`.
- Full backup snapshots: `/var/data/backups/`.

The one-time migrator copies the legacy `backend/rfa.db` and `backend/uploads/` to those paths and never deletes its source. Render's pre-deploy command and one-off jobs cannot access the attached disk; migration runs at backend startup when `MIGRATE_TO_PERSISTENT_DISK=true`.

## First migration and rollback

1. Before changing the service, obtain and verify a separate copy of the current production `rfa.db` and the entire `uploads/` directory. Do not continue if the database or files cannot be preserved and read back.
2. Confirm the `/var/data` disk is attached to the backend service, mounted at the exact path, and has enough free space for the database, uploads, and snapshots.
3. Set the persistent paths above and temporarily set `MIGRATE_TO_PERSISTENT_DISK=true`. Keep `DATA_PURGE_ENABLED=false` until the retention policy is deliberately reviewed.
4. Deploy the prepared backend while auto-deploy is controlled. The migrator must log success; any migration error aborts startup before SQLite initialization.
5. Verify `/var/data/rfa.db` exists and is non-empty; compare its SHA-256 with the preserved source. Verify upload counts and sample file hashes against the source, and confirm the admin account is present by logging in.
6. Run the post-deploy smoke tests. Keep the preserved original data unchanged until all checks pass.
7. Set `MIGRATE_TO_PERSISTENT_DISK=false`, restart/redeploy, and verify health, admin login, cases, and private file reads again.
8. If any check fails, stop changes to the disk, set migration off, and roll back the service code/configuration to the previous version. Restore the preserved original database and uploads only to their original paths if the previous service needs them. Never delete the persistent-disk copy during rollback.

The current migrator requires the legacy source paths to exist in the runtime at first startup. If Render's new instance does not contain those ephemeral files, it intentionally fails closed. The separate verified copy in step 1 is therefore mandatory. The repository does not provide a mechanism to transfer that copy into the new runtime. Do not start the migration deploy until an operator has a supported, tested way to make the preserved source files available at the legacy paths, or has otherwise verified the exact migration source in the runtime. Render's pre-deploy command, one-off jobs, and cron jobs cannot access the attached disk; do not use them to copy or inspect its contents.

## Full backup snapshots

`npm run backup:snapshot` creates one directory in `BACKUP_DIR` containing:
- `rfa.db`;
- a full `uploads/` tree, including attachments and payment receipts;
- `manifest.json` with file sizes and SHA-256 hashes.

The command builds into a temporary sibling directory, verifies copied file hashes, then publishes the complete snapshot by rename. It prunes old snapshots only after a new snapshot is published successfully. Retention is controlled by `BACKUP_RETENTION_DAYS` (default 14 days). To restore, stop writes, choose a complete snapshot, verify hashes, copy its database and uploads to a separate restore directory, run `PRAGMA integrity_check`, then restore both together during a planned maintenance window. Do not restore only the database or only uploads.

The command is not scheduled by this repository. Run it periodically from the backend service runtime, after arranging a quiet/maintenance window so database and file changes cannot race the copy. Render Cron Jobs and one-off jobs cannot access this service's persistent disk. Render also creates encrypted daily disk snapshots retained for at least seven days; those snapshots are whole-disk recovery points, not an independently controlled off-site backup. Loss of the disk/account or data corruption outside that retention remains a risk. Maintain a verified copy outside this disk/provider for stronger recovery.

## Preflight and smoke tests

Run `npm ci` in the backend build environment. Run `npm run preflight:prod` only in an environment where the configured production paths are intentionally available; it creates a write-test file under `BACKUP_DIR`, so it must not be run as a Render pre-deploy command or as a one-off job. Render's pre-deploy command and one-off jobs run without access to the attached disk. Take `npm run backup:snapshot` from the backend service runtime before planned maintenance, using a verified low-write window.

After release, using test accounts and controlled test data:
- Frontend loads over HTTPS; API `/health` returns 200.
- Browser CORS response names the exact frontend origin and allows credentials; an untrusted origin is rejected.
- Admin login succeeds; access-token expiry triggers CSRF bootstrap and session refresh; logout succeeds.
- Create and look up a test case; publish an option; accept it; upload a test receipt; confirm payment.
- Download a private attachment with authorization; verify Conversations load and a customer reply is visible to admin.
- Log in as an Enterprise user and verify tenant isolation against another company's case.
- Restart the backend; verify the case, attachments, receipts, and conversation history still exist.
- Confirm a newly created backup snapshot contains the DB, uploads, and a valid manifest; restore it only in an isolated location.

## Repository hygiene

Do not commit real `.env` files, SQLite databases, uploads, backups, or `backend/reset-admin-local.cjs`. Before committing, review `git status` and the staged file list explicitly.
