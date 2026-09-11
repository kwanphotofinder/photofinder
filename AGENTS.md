# Photo Finder Agent Guide

## Repository Overview

- `photofinder-nextjs/` is the main application: Next.js App Router, TypeScript, Prisma, Tailwind CSS, and shadcn/ui.
- `ai-service/` is the Python FastAPI face-processing service. It returns facial embeddings and handles liveness and blur-related processing.
- `docker-compose.yml` provides local PostgreSQL with `pgvector` and the AI service.
- Root documentation describes product requirements, deployment, infrastructure limits, and user workflows.

## Working Directories

Run commands from the directory that owns the relevant project:

```text
Root:                 D:\Project\photofinder-main
Next.js application:  D:\Project\photofinder-main\photofinder-nextjs
AI service:            D:\Project\photofinder-main\ai-service
```

## Development Commands

From `photofinder-nextjs/`:

```bash
npm install
npm run dev
npm run lint
npm run build
npx prisma generate
npx prisma migrate dev
```

From the repository root:

```bash
docker compose up postgres ai-service
```

For the AI service without Docker, use a Python 3.10 environment:

```bash
pip install -r ai-service/requirements.txt
python ai-service/main.py
```

The Next.js development server normally runs at `http://localhost:3000`; the AI service listens on port `8000` locally when using Docker Compose.

## Implementation Guidelines

- Preserve the existing Next.js App Router structure and TypeScript conventions.
- Prefer existing utilities in `photofinder-nextjs/lib/` and existing UI primitives in `photofinder-nextjs/components/ui/` before adding new abstractions.
- Keep API route handlers under `photofinder-nextjs/app/api/` thin: validate input, enforce authentication/authorization, call domain utilities, and return consistent responses.
- Use Prisma for database access through the existing Prisma setup. Keep vector and facial-embedding behavior compatible with PostgreSQL `pgvector`.
- Keep client components focused. Add `"use client"` only when browser APIs, React state, effects, or event handlers require it.
- Reuse the current Tailwind/shadcn design language when changing UI. Keep responsive behavior and loading/error/empty states intact.
- For AI changes, preserve the service API contract and CPU-compatible behavior used by the Docker image.
- Avoid unrelated refactors, dependency upgrades, or generated-file churn while implementing a focused change.

## Privacy and Security

- Treat facial images, embeddings, identity data, consent data, and authentication credentials as sensitive.
- Never commit `.env`, `.env.local`, API keys, OAuth secrets, database URLs, Cloudinary credentials, or downloaded model caches.
- Preserve consent, deletion, export, and opt-out behavior when changing user or face-related flows.
- Validate authorization on every protected API route; do not rely only on UI visibility.
- Do not log raw images, embeddings, tokens, or secrets.

## Database and Migrations

- Check `photofinder-nextjs/prisma/schema.prisma` before changing database-backed behavior.
- Use Prisma migrations for schema changes and verify the `pgvector` extension/index requirements when working with embeddings.
- Do not edit an applied migration to change history. Add a new migration instead.
- Test destructive or privacy-related database operations with a safe local database before using production credentials.

## Testing and Validation

For a focused Next.js change, run from `photofinder-nextjs/`:

```bash
npm run lint
npm run build
```

For Python or AI-service changes, run the relevant tests from the repository root or `ai-service/`, and confirm the service starts successfully. At minimum, validate the changed endpoint or processing path with a representative input.

Before finishing any change:

- Check `git diff` and `git status`.
- Confirm no secrets, local environment files, model caches, or generated build output are staged.
- Report tests that were run and any checks that could not run because required services or credentials were unavailable.

## Git Workflow

- Work on the requested feature branch, currently `feature/redesign` for redesign work.
- Use small, descriptive commits such as `feat:`, `fix:`, `refactor:`, `docs:`, or `chore:`.
- Do not force-push, reset, or discard user changes without explicit approval.
- Keep `main` updates separate from feature implementation commits. Do not push unless explicitly requested.
