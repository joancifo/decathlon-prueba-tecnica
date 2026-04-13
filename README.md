# Auth Demo — Next.js Authorization Code Flow

Server-side OAuth 2.0 Authorization Code Grant with encrypted `httpOnly` session cookies. Access and refresh tokens never leave the server — they are invisible to `document.cookie`, `localStorage`, and the browser console.

---

## Architecture

```
Browser                 Next.js Server              Mock IdP (same app)
  │                          │                              │
  │  GET /dashboard          │                              │
  │─────────────────────────▶│                              │
  │                          │  proxy.ts intercepts         │
  │                          │  → no session cookie         │
  │  302 → /api/auth/login   │                              │
  │◀─────────────────────────│                              │
  │                          │                              │
  │  GET /api/auth/login     │                              │
  │─────────────────────────▶│                              │
  │                          │  generate state, store in    │
  │                          │  temp httpOnly cookie        │
  │  307 → /api/idp/authorize│                              │
  │◀─────────────────────────│                              │
  │                          │                              │
  │  GET /api/idp/authorize  │                              │
  │─────────────────────────────────────────────────────────▶
  │  HTML login form         │                              │
  │◀─────────────────────────────────────────────────────────
  │                          │                              │
  │  POST /api/idp/authorize │                              │
  │  (credentials)           │                              │
  │─────────────────────────────────────────────────────────▶
  │                          │                              │
  │  307 → /api/auth/callback?code=...&state=...            │
  │◀─────────────────────────────────────────────────────────
  │                          │                              │
  │  GET /api/auth/callback  │                              │
  │─────────────────────────▶│                              │
  │                          │  validate state              │
  │                          │  POST /api/idp/token ───────▶│
  │                          │◀─── { access_token, ... } ───│
  │                          │  encrypt tokens in           │
  │                          │  httpOnly session cookie     │
  │  307 → /dashboard        │                              │
  │◀─────────────────────────│                              │
  │                          │                              │
  │  GET /dashboard          │                              │
  │─────────────────────────▶│                              │
  │                          │  proxy.ts: session valid     │
  │                          │  Server Component reads user │
  │  200 HTML                │  from encrypted cookie       │
  │◀─────────────────────────│                              │
```

### Token refresh (proxy — proactive)

When `proxy.ts` intercepts a request and detects the access token expires in less than 2 minutes, it fetches a new token from the IdP server-to-server, updates the encrypted cookie, and continues — the user never notices.

### Token refresh (authFetch — reactive)

`lib/authFetch.ts` wraps `fetch` for use inside Route Handlers and Server Components. If the upstream call returns `401`, it refreshes the token, updates the session, and retries the request once before throwing `AuthError`.

---

## Sequence diagram (Mermaid)

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Next as Next.js Server
    participant IdP as Mock IdP (/api/idp)

    User->>Browser: navigate to /dashboard
    Browser->>Next: GET /dashboard
    Next->>Next: proxy.ts — no session cookie
    Next-->>Browser: 302 /api/auth/login

    Browser->>Next: GET /api/auth/login
    Next->>Next: generate state, set temp cookie
    Next-->>Browser: 307 /api/idp/authorize

    Browser->>IdP: GET /api/idp/authorize
    IdP-->>Browser: HTML login form

    User->>Browser: submit credentials
    Browser->>IdP: POST /api/idp/authorize
    IdP->>IdP: validate credentials, create auth code
    IdP-->>Browser: 307 /api/auth/callback?code=…&state=…

    Browser->>Next: GET /api/auth/callback
    Next->>Next: validate state cookie
    Next->>IdP: POST /api/idp/token (server-to-server)
    IdP-->>Next: { access_token, refresh_token, expires_in }
    Next->>Next: encrypt tokens → httpOnly session cookie
    Next-->>Browser: 307 /dashboard (Set-Cookie: session)

    Browser->>Next: GET /dashboard (with session cookie)
    Next->>Next: proxy.ts — session valid
    Next-->>Browser: 200 dashboard HTML

    note over Next: --- Auto-refresh (proxy) ---
    Browser->>Next: any request (token < 2 min left)
    Next->>IdP: POST /api/idp/token (refresh_token)
    IdP-->>Next: new access_token
    Next->>Next: update session cookie
    Next-->>Browser: continue as normal

    note over Browser,Next: --- Logout ---
    User->>Browser: click "Cerrar sesión"
    Browser->>Next: GET /api/auth/logout
    Next->>IdP: POST /api/idp/logout (revoke tokens)
    Next->>Next: destroy session cookie
    Next-->>Browser: 307 / (Max-Age=0 cookie)
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.local`

```env
# Secret used by the mock IdP to sign JWTs (HS256)
IDP_JWT_SECRET=replace-with-a-long-random-string

# Password used by iron-session to encrypt the session cookie (min 32 chars)
SESSION_PASSWORD=replace-with-32-plus-character-password-here
```

You can generate suitable values with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run

```bash
npm run dev      # development
npm run build    # production build
npm start        # production server
npm test         # run test suite
```

Open [http://localhost:3000](http://localhost:3000) and log in with:

| Field    | Value          |
|----------|----------------|
| Email    | demo@test.com  |
| Password | password123    |

---

## Technical decisions

### Why iron-session instead of next-auth?

next-auth (Auth.js) is a complete authentication framework. For this exercise the goal is to understand the OAuth 2.0 Authorization Code flow from scratch — implementing it manually makes every step explicit: state generation, code exchange, token storage, refresh strategy. iron-session provides only the encrypted-cookie primitive; everything else is hand-written.

### Why httpOnly cookies?

Access and refresh tokens stored in `localStorage` or returned as JSON are reachable by any JavaScript on the page, making them a target for XSS. An `httpOnly` cookie is never exposed to `document.cookie` or the browser console — it travels in HTTP headers only and can only be read by the server.

### Why server-side only?

Doing the token exchange on the server means the browser never sees the raw tokens. The server-to-server call to `/api/idp/token` stays within the Node.js process; only an opaque encrypted blob reaches the client.

### Why `proxy.ts` and not `middleware.ts`?

Next.js 16 deprecated `middleware.ts` and renamed the file convention to `proxy.ts` (function renamed from `middleware` to `proxy`). The behaviour is identical — it intercepts every request before routing. See the [migration guide](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#migration-to-proxy).

### Token refresh strategy

Two layers of defence:

1. **Proactive (proxy.ts):** If the access token expires in less than 2 minutes, the proxy refreshes it before the page renders. The user is never interrupted.
2. **Reactive (authFetch.ts):** If a server-side `fetch` to a protected resource returns `401` (e.g. clock skew), the helper refreshes the token and retries once before throwing `AuthError`.

---

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── callback/route.ts   — exchanges auth code for tokens
│   │   │   ├── login/route.ts      — initiates OAuth flow (GET) / direct login (POST)
│   │   │   └── logout/route.ts     — destroys session, revokes IdP tokens
│   │   └── idp/
│   │       ├── authorize/route.ts  — mock IdP login page + code issuance
│   │       ├── logout/route.ts     — revokes refresh tokens
│   │       ├── token/route.ts      — code exchange + refresh grant
│   │       └── userinfo/route.ts   — returns user profile for valid token
│   ├── dashboard/page.tsx          — protected server component
│   └── page.tsx                    — public landing page
├── lib/
│   ├── authFetch.ts                — authenticated fetch with transparent retry
│   ├── mock-idp.ts                 — in-memory IdP store + JWT helpers
│   └── session.ts                  — iron-session read/write helpers
└── proxy.ts                        — route protection + proactive token refresh
```
