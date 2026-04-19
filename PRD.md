# Product Requirements Document (PRD): Photo Finder

## 1. Product Overview
**Name:** Photo Finder
**Purpose:** An AI-powered platform designed for university students to effortlessly find, save, and download photos of themselves from various campus events using facial recognition technology. 
**Problem Solved:** Manually scrolling through hundreds or thousands of event photos on Google Drive or Facebook pages to find pictures of oneself is tedious and time-consuming. 
**Value Proposition:** Instant, privacy-first photo discovery. Students upload a single reference selfie and instantly see every photo they appear in across all university events.

## 2. Target Audience & User Roles
The platform supports four distinct user roles, managed via Google OAuth (specifically targeting university emails like `@mfu.ac.th` and `@gmail.com`):

1. **Student (End User):** The primary user who searches for their photos.
2. **Photographer:** Uploads high-quality event photos to the platform.
3. **Admin:** Manages events, reviews privacy/removal requests, and monitors platform usage.
4. **Super Admin:** Has all Admin privileges, plus the ability to promote/demote other users to Admin or Photographer roles.

## 3. Core Features & User Flows

### 3.1. Student Features
* **Authentication:** Seamless login using Google Workspace.
* **PDPA Consent:** Mandatory privacy consent flow upon first login before accessing the platform.
* **Consent Intelligence:** When users withdraw consent, the system provides a soft warning explaining impact, offers one-click data export, and supports one-click full privacy delete with status feedback.
* **Auto-Match (Reference Selfie):** Students can upload a default "reference face". The system automatically notifies them and displays matches from all past and future events without needing to search manually.
* **Manual Face Search:** Students can upload a temporary selfie to perform a one-time search against specific events or the entire database.
* **Photo Actions:** 
  * **View:** View high-resolution photos with match confidence percentages (e.g., 95% Match).
  * **Save:** Add photos to a personal "Saved Photos" (Favorites) collection.
  * **Download:** Download the photo to their local device.
  * **Request Removal:** Submit a takedown request (Privacy/Delete) if they do not want a specific photo on the platform.
* **Profile Management & Notifications:** Students can link their LINE account (via LINE Login) on the Profile page to receive personalized, real-time push notifications (via LINE Official Account Flex Messages) when the AI pipeline detects a match in newly uploaded photos.

### 3.2. Photographer Features
* **Event Selection:** Choose which published or draft event to upload photos to.
* **Bulk Upload:** Upload multiple high-resolution photos at once. Photos are automatically processed by the AI pipeline to detect and index faces.
* **Analytics Dashboard:** View event-level engagement metrics such as photo views, downloads, total uploads, and engagement rate so photographers can understand which events perform best.

### 3.3. Admin & Super Admin Features
* **System Health Dashboard:** View real-time metrics including total users, active events, total photos, faces detected, and a live AI Confidence gauge.
* **Event Management:** Create, Edit, Publish, Archive, or Delete campus events.
* **User Management:** View all users. Super Admins can promote users to Photographers or Admins, or demote them back to Students.
* **Removal Requests:** Review, approve (deletes photo), or reject takedown requests submitted by students.

## 4. Technical Architecture & Stack

### 4.1. Core Stack
* **Frontend:** Next.js (App Router), React, Tailwind CSS, Shadcn UI, Lucide Icons, ECharts (for Admin Dashboard).
* **Backend:** Next.js API Routes (`/app/api/...`).
* **Database:** PostgreSQL hosted on Neon DB.
* **ORM:** Prisma Client.
* **Vector Search:** `pgvector` PostgreSQL extension for storing and querying AI facial embeddings.
* **Image Storage:** Cloudinary (optimized storage and delivery).

### 4.2. AI Pipeline
* **Microservice:** A separate AI service (e.g., Python/FastAPI hosted on Hugging Face Spaces or locally) handles the heavy lifting of facial detection and encoding.
* **Embeddings:** Faces are converted into mathematical vectors (e.g., 512-dimensional arrays) and stored in the database.
* **Matching Logic:** Searches are performed at the database level using Cosine Similarity (`<=>` operator in pgvector) to calculate the mathematical distance between a search face and event faces.

## 5. Database Schema Overview
* **User:** Stores Google auth details, role, PDPA consent status, and an optional `lineUserId` for push notifications.
* **UserFace:** Stores the student's reference selfie embedding for Auto-Match.
* **Event:** Stores event metadata (Name, Date, Status: Draft/Published/Archived).
* **Photo:** Represents an uploaded image, linked to an Event and a Uploader (Photographer). Includes storage URLs and processing status.
* **Face:** Represents a detected face within a `Photo`. Stores bounding box coordinates, AI detection confidence, and the pgvector embedding.
* **SavedPhoto:** Junction table linking a User to their favorited Photos.
* **RemovalRequest:** Tracks student requests to delete specific photos.

## 6. Privacy & Security
* **Consent First:** Users cannot utilize the facial recognition features without explicitly accepting the PDPA (Personal Data Protection Act) terms.
* **Soft Impact Disclosure:** If consent is withdrawn, users are informed that auto-match and related notifications will stop until re-consent.
* **Data Portability:** Users can export their privacy data in a machine-readable JSON file via self-service.
* **Data Erasure (Self-Service):** Users can trigger one-click full privacy delete and receive a status response (`processing`, `completed`, `failed`).
* **Self-Service Deletion:** Users can delete their reference selfie at any time, which completely removes their facial biometric data from the system.
* **Granular Access Control:** API routes verify JWT/Auth tokens and explicitly check user roles (e.g., preventing Students from accessing `/api/admin/*` routes).

## 7. Consent Intelligence Acceptance Criteria
* A student who toggles consent off sees a clear impact warning before saving preferences.
* A student can export privacy data with one click and successfully download a JSON file.
* A student can trigger full privacy delete with one click and see a clear deletion status message.
* Full privacy delete does not remove the user account itself and does not globally delete event photos owned by other users.
