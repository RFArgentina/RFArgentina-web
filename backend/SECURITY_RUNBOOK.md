# Security Runbook (RFA Backend)

## 1) Variables obligatorias
- `JWT_SECRET`: minimo 32 caracteres.
- `CORS_ORIGINS`: lista separada por coma con dominios permitidos.
- `APP_BASE_URL`: URL publica del frontend.
- `PORT`: puerto del backend.

## 2) Variables recomendadas
- `TRUST_PROXY=true` si hay proxy/reverse proxy.
- `LOGIN_MAX_ATTEMPTS=8`
- `LOGIN_LOCK_MINUTES=15`
- `ACCESS_TOKEN_TTL=15m`
- `REFRESH_TOKEN_DAYS=30`
- `REFRESH_TOKEN_COOKIE=rfa_refresh_token`
- `CSRF_COOKIE_NAME=rfa_csrf_token`
- `REFRESH_TOKEN_SECURE_COOKIE=true` en produccion HTTPS
- `REFRESH_TOKEN_SAME_SITE=lax|strict|none`
- `BACKUP_DIR=./backups`
- `BACKUP_RETENTION_DAYS=14`

## Email
RFA no realiza envio ni verificacion automatica de email. El email se conserva como dato de contacto, registro e inicio de sesion; la verificacion por correo no condiciona el alta ni el acceso.

## 3) Checklist antes de deploy
- Verificar que `.env` NO este versionado.
- Verificar CORS solo con dominios reales.
- Confirmar `JWT_SECRET` fuerte y unico por entorno.
- Confirmar backup de `rfa.db`.
- Ejecutar `npm run preflight:prod` con `PRECHECK_TARGET=production`.
- Ejecutar `npm run release:check` antes de subir.
- Ejecutar `npm install` y `npm start` en entorno limpio.
- Revisar endpoints de auth y upload con pruebas manuales.
- Referencia detallada: `backend/DEPLOY_PROD_CHECKLIST.md`.

## 4) Hardening activo en servidor
- `helmet` para headers de seguridad.
- CORS estricto por whitelist.
- Rate limiting global y especifico en auth/formulario publico.
- Los limites usan el store en memoria de express-rate-limit: al escalar a multiples instancias, configurar un store compartido antes de aumentar instancias.
- Limites por IP en ventanas de 15 minutos: login 10, refresh 30, consulta publica 15, creacion de caso 8, aceptar propuesta 5, comprobante 5, consultas empresa 5, token de accion admin 10, importacion admin 5, carga autenticada 10. Registro y otras acciones de autenticacion conservan su limite de autenticacion existente.
- Limites de payload JSON y de archivos.
- Filtro de tipos de archivo permitidos.
- Bloqueo temporal por intentos fallidos de login.
- Rotacion de refresh token (`/api/auth/refresh`) y cierre de sesion (`/api/auth/logout`).
- Proteccion CSRF en `refresh/logout` usando cookie + header `X-CSRF-Token`.
- Auditoria de eventos sensibles (`/api/security/events` para admin).
- `X-Request-Id` por request para trazabilidad.

## 5) Operacion diaria recomendada
- Monitorear logs de acceso y errores por `requestId`.
- Revisar respuestas `429` (abuso o intentos masivos).
- Rotar `JWT_SECRET` y API keys periodicamente.
- Mantener dependencias actualizadas y revisar `npm audit`.
- Respaldar DB con frecuencia definida (diaria minimo).
- Ejecutar backup diario: `npm run backup:db` (programar con Task Scheduler/cron).

## 6) Incidentes
- Si hay sospecha de filtracion:
  - Rotar `JWT_SECRET`.
  - Revocar/rotar API keys de email.
  - Cambiar credenciales de usuarios admin.
  - Restaurar backup si hay corrupcion de datos.
- El access token se conserva en localStorage por decision de alcance de esta fase; evaluar migracion futura a cookie segura cuando se planifique un cambio de autenticacion.
- Adjuntos: maximo 5 por caso, 25 MiB por archivo y 50 MiB por solicitud; validar firma/contenedor, no publicar `UPLOADS_PATH` como contenido estatico y monitorear/cuotar el volumen persistente desde el proveedor.
- Importaciones: solo admin, hasta 5 archivos, 10 MiB cada uno, 25 MiB total, 10.000 filas y 200 columnas. Se aceptan CSV y XLSX; el XLSX se procesa con `read-excel-file` en un Worker con limite de memoria y timeout. No se evalúan fórmulas. XLS y ODS ya no se aceptan porque la librería sustituida no los soporta.
