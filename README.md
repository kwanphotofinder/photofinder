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

Create a `.env.local` file in the `photofinder-nextjs` directory. You will need credentials for the database, Google OAuth, Cloudinary, and the AI service.

```env
# Frontend Config
NEXT_PUBLIC_API_URL="/api"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"

# Backend Secrets
JWT_SECRET="your_super_secret_jwt_key"
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
CRON_SECRET="your_shared_cron_secret"

# AI Service (Python Microservice)
AI_SERVICE_URL="http://localhost:8000" # Or your live Hugging Face URL

# Database (Neon or Local Postgres with pgvector)
DATABASE_URL="postgresql://user:password@localhost:5432/facesearch"
DIRECT_URL="postgresql://user:password@localhost:5432/facesearch"

# Cloudinary
CLOUDINARY_URL="cloudinary://api_key:api_secret@cloud_name"
```

### 4. Database Setup

Apply the Prisma migrations so the database schema matches the current app:

```bash
npx prisma migrate dev
```

**Important:** If you are bootstrapping a new Neon database, verify that the `vector` extension and the `faces_embedding_idx` index exist after migrations are applied:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX IF NOT EXISTS faces_embedding_idx ON faces USING hnsw (embedding vector_cosine_ops);
```

### 5. Start the Development Server

```bash
npm run dev
```

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
