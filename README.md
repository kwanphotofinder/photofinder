# Photo Finder

Photo Finder is an AI-powered platform for finding, saving, and downloading student photos from campus events using facial recognition.

## 🚀 Features

*   **Instant Face Search:** Upload a selfie to find photos of yourself across event albums.
*   **Auto-Match:** Set a default "reference face." The system finds and notifies you of matches from past and future events.
*   **Privacy-First:** Mandatory PDPA consent flow. Students can delete their biometric data at any time.
*   **Consent Intelligence:** Soft warning when withdrawing consent, one-click privacy data export, and one-click full privacy delete with live deletion status.
*   **Admin Dashboard:** Manage events, users, and photo removal requests. Includes real-time system health metrics.
*   **Photographer Portal:** Bulk upload high-resolution event photos to Cloudinary.
*   **Photographer Analytics Dashboard:** Track event-level photo views, downloads, and engagement rates.

## 🏗️ Architecture & Tech Stack

This project uses a unified Next.js architecture instead of a separate Node/NestJS backend.

**Core Stack:**
*   **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS & [shadcn/ui](https://ui.shadcn.com/)
*   **Authentication:** Custom JWT via Google Workspace OAuth

**Infrastructure & Services:**
*   **Database:** PostgreSQL hosted on [Neon](https://neon.tech/)
*   **ORM:** [Prisma](https://www.prisma.io/)
*   **Vector Search:** `pgvector` PostgreSQL extension (for storing and querying AI facial embeddings)
*   **Image Storage:** [Cloudinary](https://cloudinary.com/) (optimized storage and delivery)
*   **AI Microservice:** A separate Python/FastAPI service hosted on Hugging Face Spaces that processes images and returns 512-dimensional facial embeddings.

## 🛠️ Local Development Setup

### 1. Prerequisites
*   Node.js (v18 or higher)
*   npm or pnpm
*   A PostgreSQL database with the `pgvector` extension installed.

### 2. Installation

Navigate to the project directory and install dependencies:

```bash
cd photofinder-nextjs
npm install
```

### 3. Environment Variables

Copy `.env.example` to create your local `.env` (for Docker) or `.env.local` (for `npm run dev`):

```bash
# For Docker Compose (Root)
cp .env.example .env

# Or for local Next.js dev server:
cp .env.example photofinder-nextjs/.env.local
```

Refer to [.env.example](./.env.example) for the complete list of variables and status badges (Mandatory vs Pre-configured vs Optional).

### 4. Database Setup

When using Docker, PostgreSQL + pgvector is initialized automatically. Apply Prisma migrations to set up the database schema:

```bash
cd photofinder-nextjs
npx prisma migrate dev
```

### 5. Start the Application

You can run PhotoFinder in either of two modes:

* **Mode A: Full Docker Stack (Frontend + AI + Postgres)**
  ```bash
  docker compose up --build -d
  ```

* **Mode B: Fast Dev Server (Hot-Reload)**
  ```bash
  # 1. Start backend containers
  docker compose up postgres ai-service -d

  # 2. Start Next.js dev server
  cd photofinder-nextjs
  npm run dev
  ```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📚 Documentation

For more detailed information, please refer to the other documentation files in this directory:

*   **[PRD.md](./PRD.md):** Detailed Product Requirements, User Roles, and User Flows.
*   **[DEPLOYMENT.md](./DEPLOYMENT.md):** Step-by-step guide for deploying the application to production (Vercel, Neon, Cloudinary).
*   Monitoring docs are not included in this repository snapshot.

## Privacy Endpoints (Student Self-Service)

The Consent Intelligence flow exposes user-facing privacy endpoints:

*   `GET /api/me/privacy/export` - Export user privacy data in JSON format.
*   `POST /api/me/privacy/full-delete` - Perform full privacy cleanup and return deletion status.

## Privacy Scope Notes

`One-click full delete` currently removes privacy-related user data (reference face, saved photos list, removal requests, reports, deliveries, and consent/profile fields) but does not delete the entire user account or globally remove event photos uploaded by others.
