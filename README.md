# YERSPS

Youth Entrepreneur Readiness and Success Prediction System (YERSPS) is an explainable platform for
helping aspiring and early-stage entrepreneurs understand readiness gaps, follow a relevant
assessment path, and turn results into practical actions.

## Workspace

- `apps/web` - React, Vite, TypeScript, Tailwind CSS
- `apps/api` - Express 5 and TypeScript
- `packages/contracts` - shared Zod schemas and API types
- `docs` - architecture and phased delivery plan

## Where to run commands

Run every project command from the repository root:

```text
D:\Toon\My Doc\Classmate\Paccy\YERSPS_Project
```

Do not run installation, Docker, database, or combined development commands from `apps/web` or
`apps/api`. npm workspaces route each root command to the correct application.

## Local development

From the repository root:

```powershell
Copy-Item .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The root `.env` is the single configuration file for the monorepo. The API scripts explicitly read
it from the root, and Vite is configured to use the root as its environment directory.

The website runs at `http://localhost:5173`; the API health endpoint is
`http://localhost:4000/api/v1/health`.

PostgreSQL is required for authentication, profiles, businesses, assessments, administration, and
audit data. Start it from the repository root with `docker compose up -d` before migrations.

## Full production-style Docker stack

Copy `.env.production.example` to `.env.production`, replace both secrets, and run:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

The website is then available at `http://localhost:8080`. Nginx serves the React application and
proxies `/api` to the API container; PostgreSQL remains internal to the Docker network.

## Quality commands

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

See `docs/IMPLEMENTATION_PLAN.md` for implemented scope, assumptions, and the remaining phases.
