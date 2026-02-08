# Email Verification Setup (Production)

This project is configured for real email verification on registration.

## Required env vars
Set these in your production backend environment:

- `SENDGRID_API_KEY`
- `EMAIL_FROM` (must be a verified sender in SendGrid)
- `APP_BASE_URL=https://rfargentina.com`
- `CORS_ORIGINS=https://rfargentina.com`

## Backend behavior
- `POST /api/auth/register`: creates unverified user and sends verification email.
- `POST /api/auth/login`: blocks login until `email_verified=1`.
- `POST /api/auth/resend-verification`: resends verification link.
- `GET /api/auth/verify?token=...`: verifies email and returns auth token.
- `GET /api/auth/config`: returns `{ emailVerificationEnabled: boolean }`.

## Verification token
- Expires after 24 hours.
- If expired, user must request a new link.

## Quick test
1. Register a new email.
2. Open verification link from email.
3. Login should succeed.
4. Login before verification should return `EMAIL_NOT_VERIFIED`.
