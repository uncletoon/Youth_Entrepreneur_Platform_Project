# Architecture

YERSPS is an npm-workspace monorepo. `apps/web` owns the React user experience, `apps/api` owns
HTTP orchestration and business rules, and `packages/contracts` owns shared Zod schemas, enums,
DTOs, and response types.

## Runtime

- React 19 + Vite serves the public, entrepreneur, administrator, and system-administrator UI.
- Express 5 provides versioned `/api/v1` endpoints with Helmet, CORS, rate limits, structured logs,
  central error handling, and role/ownership checks.
- PostgreSQL 17 stores users, sessions, profiles, businesses, classifications, assessments,
  results, recommendations, feedback threads, Expert assignments, notifications, configuration,
  recovery tokens, and audit events.
- Prisma 7 owns the schema, generated client, migrations, reference catalog seed data, and Studio.

## Security and roles

Passwords use Argon2id. Short-lived JWT access tokens carry the user role; rotating refresh tokens
are stored as SHA-256 hashes and delivered through HttpOnly SameSite cookies. Password-reset tokens
are also hashed at rest, expire, and are single use. Account contact verification is not required.

Entrepreneurs can access only their own profiles, businesses, assessments, results, feedback, and
recommendations. Approved Experts can access only Entrepreneurs actively assigned to them and can
add assessment questions from their subject expertise. System Administrators approve Experts,
create assignments, manage users and roles, edit or remove assessment content, manage
configuration, export reports, and view the complete audit log. Each request refreshes role and
account status from PostgreSQL so disabling an account takes effect immediately.

Expert approval is a separate workflow from account registration. Expert profiles move from Draft
to Pending only after the professional form is submitted. Pending applications are read-only for
the Expert and visible to System Administrators; Draft profiles are excluded from the review queue.
Rejecting reopens the profile for revision, while approval unlocks Expert routes.

In-app notifications are durable; email uses optional SMTP settings and SMS uses optional Twilio
settings. Missing or temporarily unavailable external providers do not discard the in-app
notification.

## Assessment pipeline

Question routing combines active core questions with the entrepreneur's classified sector and
business stage. Responses are autosaved by session. Submission calculates weighted domain scores,
readiness level, risk level, strengths, gaps, and recommendations in one database transaction.
Rules and results retain version identifiers and always include a non-guarantee disclaimer. The
current result is an explainable readiness-risk estimate, not a trained success-prediction model.

## Deployment

Local development runs the web and API watchers on Windows with a native PostgreSQL cluster stored
outside the repository under `%LOCALAPPDATA%\YERSPS\PostgreSQL`. pgAdmin connects through the
dedicated `yersps_pgadmin` administration role, while the API uses the restricted `yersps_app`
role. Production uses a host-managed
PostgreSQL service and one Node process: Express serves both `/api/v1` and the built React SPA, while
an external TLS reverse proxy handles the public origin. `/health/ready` checks database
connectivity; scoped PowerShell scripts start and stop only the YERSPS cluster and create or restore
PostgreSQL custom-format backups outside the source checkout. CI runs unit, type, formatting, lint,
build, and Chromium workflow checks.
