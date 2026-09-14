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
create, edit, archive, or remove only their own supplemental domains and questions. System
Administrators approve Experts, create assignments, manage users and roles, own CRUD access to the
mandatory questions and scoring classes, oversee supplemental questions, manage configuration,
export reports, and view the complete audit log. Each request refreshes role and account status
from PostgreSQL so disabling an account takes effect immediately.

Expert approval is a separate workflow from account registration. Expert profiles move from Draft
to Pending only after the professional form is submitted. Pending applications are read-only for
the Expert and visible to System Administrators; Draft profiles are excluded from the review queue.
Rejecting reopens the profile for revision, while approval unlocks Expert routes.

In-app notifications are durable; email uses optional SMTP settings and SMS uses optional Twilio
settings. Missing or temporarily unavailable external providers do not discard the in-app
notification.

## Assessment pipeline

The mandatory framework contains five active classes with ten questions each. Every class
contributes 20%, producing a 50-question core readiness score of 100%. Experts create separate
supplemental domains containing 5-10 equally weighted questions and select one or more applicable
innovation sectors. The server generates internal codes and display order. An Expert domain stays
in Draft below five active questions and becomes routable automatically at question five; question
eleven is rejected. The 10-slot Expert editor saves 5-10 questions as one transaction and applies
one shared sector selection to every question in that set. Question routing combines the mandatory framework with complete Expert domains
matching the innovation's sector. Responses are autosaved by session. Submission calculates the
mandatory class scores, overall readiness, risk, strengths, gaps, recommendations, and separate
equal-weight Expert-domain percentages in one database transaction. Supplemental percentages never alter the mandatory
readiness score. Rules and results retain version identifiers and always include a non-guarantee
disclaimer. The current result is an explainable readiness-risk estimate, not a trained
success-prediction model.

Only one Draft or In Progress assessment session may exist per business. Reopening an unfinished
assessment returns that same session and its saved responses; the web application resumes at the
first incomplete class instead of creating or displaying a second attempt.

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
