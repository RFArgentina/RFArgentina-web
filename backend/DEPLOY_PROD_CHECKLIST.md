# Deploy Checklist (Produccion)

## 1) Configuracion de entorno
- Crear `.env` de produccion con:
  - `NODE_ENV=production`
  - `JWT_SECRET` (minimo 32 chars)
  - `APP_BASE_URL` en `https://...`
  - `CORS_ORIGINS` solo dominios reales (sin localhost)
  - `REFRESH_TOKEN_SECURE_COOKIE=true`
  - `REFRESH_TOKEN_SAME_SITE=lax` (o `none` si necesitas cross-site)
  - `TRUST_PROXY=true` si usas reverse proxy
- Si usas verificacion por email:
  - `AUTH_REQUIRE_EMAIL_VERIFICATION=true`
  - `SENDGRID_API_KEY` y `EMAIL_FROM`

Valores sugeridos para `rfargentina.com`:
- `APP_BASE_URL=https://rfargentina.com`
- `CORS_ORIGINS=https://rfargentina.com,https://www.rfargentina.com`
- `REFRESH_TOKEN_SECURE_COOKIE=true`
- `REFRESH_TOKEN_SAME_SITE=lax`
- `TRUST_PROXY=true`
- Base recomendada: `backend/.env.production.example`

## 2) Preflight y seguridad
- Ejecutar:
  - `npm ci`
  - `npm run preflight:prod` (con `PRECHECK_TARGET=production` si aplica)
  - `npm run release:check`
- Revisar salida y corregir cualquier `ERROR`.

Comando rapido de validacion prod:
- PowerShell:
  - `$env:PRECHECK_TARGET='production'; npm run preflight:prod`

## 3) Inicializacion y backup
- Confirmar backup inicial:
  - `npm run backup:db`
- Programar backup diario (Task Scheduler/cron):
  - `npm run backup:db`

## 4) Arranque y smoke test
- Iniciar backend:
  - `npm start`
- Verificar:
  - `GET /health` responde `OK`
  - Login OK
  - Refresh OK
  - Logout OK
  - Cambio de estado de caso OK

## 5) Observabilidad minima
- Revisar logs por `X-Request-Id`.
- Revisar `/api/security/login-audit` (admin).
- Revisar `/api/security/events` (admin).

## 6) Publicacion
- Confirmar que `.env`, DB y uploads no se suben al repo.
- Hacer commit solo de codigo/config seguros.
- Publicar y volver a ejecutar smoke test.
