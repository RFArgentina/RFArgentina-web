# Frontend security headers

The frontend is a static SPA. Configure these response headers in the actual static host/CDN; this repository does not identify a single hosting configuration to edit safely.

Recommended Content-Security-Policy for the current frontend (replace the API origin if `REACT_APP_BACKEND_URL` changes):

```text
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests; script-src 'self' https://www.googletagmanager.com 'sha256-/77qhVrrsj6iYuRcR4uh132KY3+4WYawh6Xk1Awq+GI='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://api.rfargentina.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com
```

The script hash allows only the current inline JSON-LD block. Recompute it if that block changes. `style-src 'unsafe-inline'` is currently needed by inline React style attributes; remove it after those are eliminated. No `unsafe-eval` is required for the production build. Google Analytics script loading is consent-gated in the app; the hosts above are permitted, not contacted before consent. The API must separately send its own CSP/security headers.

Other recommended headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and HSTS only when the domain is HTTPS-only (including any subdomains covered by `includeSubDomains`).
