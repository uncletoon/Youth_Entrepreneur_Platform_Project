# Architecture

YERSPS is an npm-workspace monorepo. `apps/web` owns the React user experience, `apps/api` owns
HTTP orchestration and business rules, and `packages/contracts` owns shared Zod schemas, enums,
DTOs, and response types.

## Runtime

- React 19 + Vite serves the public, entrepreneur, administrator, and system-administrator UI.
- Express 5 provides versioned `/api/v1` endpoints with Helmet, CORS, rate limits, structured logs,
  central error handling, and role/ownership checks.
- PostgreSQL 17 stores users, sessions, profiles, businesses, classifications, assessments,
  results, recommendations, feedback, configuration, recovery tokens, and audit events.
- Prisma 7 owns the schema, generated client, migrations, deterministic seed data, and Studio.

## Security and roles

Passwords use Argon2id. Short-lived JWT access tokens carry the user role; rotating refresh tokens
are stored as SHA-256 hashes and delivered through HttpOnly SameSite cookies. Password-reset and
contact-verification tokens are also hashed at rest, expire, and are single use.

Entrepreneurs can access only their own profiles, businesses, assessments, results, feedback, and
recommendations. Administrators receive operational review and configuration endpoints. System
administrators additionally control users/roles/status and view the complete audit log.

## Assessment pipeline

Question routing combines active core questions with the entrepreneur's classified sector and
business stage. Responses are autosaved by session. Submission calculates weighted domain scores,
readiness level, risk level, strengths, gaps, and recommendations in one database transaction.
Rules and results retain version identifiers and always include a non-guarantee disclaimer.

## Deployment

Local development runs the web and API watchers on Windows while PostgreSQL runs in Docker. The
production-style Compose stack builds separate API and Nginx web images and keeps PostgreSQL on an
internal Docker network. Nginx serves the SPA and proxies `/api` to Express.
