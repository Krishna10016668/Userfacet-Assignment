# 📚 Enterprise E-Library Management System

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933.svg?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-v3.8+-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57.svg?style=flat&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Express](https://img.shields.io/badge/Express.js-v4.19-000000.svg?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![Flask](https://img.shields.io/badge/Flask-Microservice-000000.svg?style=flat&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-ready, dual-service backend architecture engineered for digital libraries. The system combines an **Express.js API Gateway** managing high-throughput CRUD and business logic with a **Python Flask AI Microservice** powering intelligent book analysis, semantic recommendation algorithms, literary personality profiling, and velocity-based reading progress analytics.

---

## 📑 Table of Contents

1. [System Architecture](#-system-architecture)
2. [Environment Variables Configuration (`.env`)](#-environment-variables-configuration-env)
3. [Quick Start & Installation](#-quick-start--installation)
4. [User Roles & Security (RBAC)](#-user-roles--security-rbac)
5. [Core Domain Features](#-core-domain-features)
6. [🌟 5 Innovative & Differentiating Features](#-5-innovative--differentiating-features)
7. [AI Microservice & Caching Engine](#-ai-microservice--caching-engine)
8. [Automated Background Cron Scheduler](#-automated-background-cron-scheduler)
9. [Comprehensive REST API Reference](#-comprehensive-rest-api-reference)
10. [Database Schema & Performance (14 Tables)](#-database-schema--performance-14-tables)
11. [Automated Integration Test Suite (20 Steps)](#-automated-integration-test-suite-20-steps)
12. [Project Structure Map](#-project-structure-map)

---

## 🏗️ System Architecture

The application is structured into two decoupled microservices sharing a common SQLite database operating in **Write-Ahead Logging (WAL)** mode for concurrent high-performance read/write operations:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Patron / Librarian / Admin Clients                  │
└───────────────────┬─────────────────────────────────▲───────────────────┘
                    │ HTTP REST (JSON / Multipart)    │
                    ▼                                 │
┌─────────────────────────────────────────────────────┴───────────────────┐
│              NODE.JS REST API GATEWAY & CORE (Port 3000)                │
│  ├── Security: Helmet, CORS, Rate Limiters, Bcrypt (12 Rounds), JWT     │
│  ├── Controllers & Services: Books, Borrows, Returns, Fines, Users      │
│  ├── Innovative Modules: Progress Tracker, Audit Trail, Bulk CSV        │
│  ├── Data Validation: Joi Schema Layer on all Payloads                  │
│  └── Automated Jobs: Node-Cron Overdue & Reservation Sweeps             │
└───────────────────┬─────────────────────────────────▲───────────────────┘
                    │ HTTP Proxy (Axios, 30s Timeout) │
                    ▼                                 │
┌─────────────────────────────────────────────────────┴───────────────────┐
│               PYTHON FLASK AI MICROSERVICE (Port 5000)                  │
│  ├── Prompt Engineering: GPT-4o-mini via UserFacet AI API               │
│  ├── Summary Engines: Brief, Detailed, and Chapter-Wise Formats         │
│  ├── Discovery: Semantic Book Recs & Reader Personality Insights        │
│  ├── Resiliency: SQLite 30-Day Cache Layer & Heuristic Fallbacks        │
│  └── Diagnostics: Health and Quota Usage Monitor Endpoints              │
└───────────────────┬─────────────────────────────────▲───────────────────┘
                    │                                 │
                    └────────────────┬────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               SHARED SQLITE DATABASE (data/library.db)                  │
│       14 Normalized Tables · 17 Optimized Indexes · WAL Enabled        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Environment Variables Configuration (`.env`)

Configuration is managed centrally via environment variables. Both services automatically read their respective settings from the root `.env` file (Node.js via `dotenv` in `src/config/index.js`, and Python via `os.environ` / `config.py`).

### 1. Creating Your `.env` File

Copy the template from `.env.example`:

```bash
# In the project root directory
cp .env.example .env
```

### 2. Complete `.env` Reference

```ini
# =================================================================
# E-Library Management System — Environment Configuration
# =================================================================

# --- HTTP Server Configuration ---
PORT=3000
NODE_ENV=development

# --- JWT Authentication & Security ---
JWT_SECRET=e-library-jwt-secret-key-2024-ultra-secure
JWT_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d

# --- Database Storage ---
DB_PATH=./data/library.db

# --- Inter-Service Communication ---
AI_SERVICE_URL=http://localhost:5000

# --- External AI Provider (UserFacet AI API / OpenAI-Compatible) ---
AI_API_TOKEN=sk-3a603b6cf3f44519aba4503735e35477
AI_API_BASE_URL=https://ai-api.userfacet.com
```

### 3. Detailed Variable Breakdown

| Variable | Type | Default | Required | Purpose & Description |
| :--- | :---: | :---: | :---: | :--- |
| `PORT` | `Number` | `3000` | Optional | Port on which the primary Node.js Express server listens. |
| `NODE_ENV` | `String` | `development` | Optional | Application runtime environment (`development`, `production`, `test`). In development, full stack traces are output on errors. |
| `JWT_SECRET` | `String` | — | **YES** | Secret key used to sign and verify JSON Web Tokens. In production, use a high-entropy string (>= 64 characters). |
| `JWT_EXPIRY` | `String` | `24h` | Optional | Access token expiration period (e.g., `15m`, `1h`, `24h`). |
| `JWT_REFRESH_EXPIRY`| `String`| `7d` | Optional | Refresh token lifetime used to issue new access tokens without credential re-entry. |
| `DB_PATH` | `String` | `./data/library.db`| Optional | File path to the SQLite database. Automatically creates the parent folder if missing. |
| `AI_SERVICE_URL` | `String` | `http://localhost:5000`| Optional | Base URL where the Node.js gateway forwards summary and insight requests to Flask. |
| `AI_API_TOKEN` | `String` | — | **YES** | Bearer authentication token used by the Python service to interact with the LLM API. |
| `AI_API_BASE_URL` | `String` | `https://ai-api.userfacet.com` | Optional | Target endpoint for OpenAI-compatible completions. |

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **Python**: `v3.8` or higher
- **Git**: Installed on your system

### Step-by-Step Setup

```bash
# 1. Clone or extract the repository
cd "e:\Userfacet Assignment"

# 2. Install Node.js backend dependencies
npm install

# 3. Install Python AI microservice dependencies
cd ai-service
pip install -r requirements.txt
cd ..

# 4. Seed the database with sample catalog and default accounts
npm run seed
```

### Running the Services

#### Option 1: One-Click Windows Launcher
Double-click [`start.bat`](file:///e:/Userfacet%20Assignment/start.bat) or run from terminal:
```cmd
start.bat
```
*(This launches the Python AI microservice on port `5000` and the Node.js API on port `3000` in dedicated windows).*

#### Option 2: Run in Separate Terminals
```bash
# Terminal 1 — Node.js REST API
npm start

# Terminal 2 — Python AI Microservice
npm run start:ai
```

---

## 👥 User Roles & Security (RBAC)

The system implements Role-Based Access Control enforced by the `authorize(...roles)` middleware:

| Role | Default Email | Default Password | Access Level & Permissions |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@library.com` | `admin123` | Full unrestricted administrative access. User deactivation, fine waivers, enterprise audit log inspection, transactional bulk CSV imports. |
| **LIBRARIAN** | `librarian@library.com` | `lib123` | Inventory management. Adding/updating books, author/category management, overdue borrowing reports, circulation analytics. |
| **MEMBER** | `member@library.com` | `member123` | Patron access. Catalog search, borrowing, reading progress tracking, AI summaries/insights, reviews (with verification gate), reading lists. |

---

## 📚 Core Domain Features

1. **Authentication & Identity**: JWT-based stateless tokens, password hashing via `bcryptjs` with 12 salt rounds, refresh token rotation.
2. **Catalog Management**: Multi-criteria search, author and category hierarchical trees, soft deletes (`is_deleted` flag), copy availability counting.
3. **Circulation & Borrowing Engine**:
   - Limit of max active loans per user (`max_books_allowed`).
   - Unpaid fine check (patrons with pending fines are blocked from new checkouts).
   - Automated stock decrementation on checkout, incrementation on return.
4. **FIFO Reservation Queue**:
   - Patrons can reserve out-of-stock titles.
   - On book return, the system auto-promotes the next in queue with a 48-hour expiration window.
5. **Dynamic Overdue Fines**:
   - Configurable fine rate per day (default ₹2/day).
   - Automatic fine assessment on late return or via hourly background cron sweeps.
6. **Reviews with Borrow Verification Gate**:
   - Patrons can only review a book if they have actively or previously borrowed it.
   - Submitting or updating a review dynamically recalculates the book's `avg_rating`.
7. **Personal & Public Reading Lists**:
   - Users can create custom collections, order book positions, and publish lists to the community.
8. **Automated Notification Dispatcher**:
   - In-app notification creation for overdue warnings, due date reminders, and reservation ready alerts.

---

## 🌟 5 Innovative & Differentiating Features

### 1. 📖 Reading Progress Tracker & Velocity/ETA Forecaster
- **What it does**: Allows readers to log page-by-page progress during active borrows.
- **Velocity Algorithm**: Calculates reading speed in **Pages Per Hour (PPH)** based on elapsed time:
  $$\text{Reading Velocity} = \frac{\Delta \text{Pages}}{\text{Elapsed Hours}}$$
- **ETA Forecasting**: Predicts exact estimated hours required to finish the book:
  $$\text{ETA (Hours)} = \frac{\text{Total Pages} - \text{Current Page}}{\text{Reading Velocity (PPH)}}$$
- **Endpoints**:
  - `PUT /api/reading-progress/:borrowId` — Update current page, notes, and compute ETA.
  - `GET /api/reading-progress/my-stats` — Personal analytics dashboard (total pages read, average speed, active books).

### 2. 🛡️ Enterprise Audit Trail System
- **What it does**: Comprehensive, immutable accountability logging for every sensitive operation (book creation/modification/deletion, checkouts, returns, renewals, fine waivers, and bulk imports).
- **Security Context**: Captures `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, structured JSON payload changes, and IP addresses.
- **Endpoints**:
  - `GET /api/audit-log` — Filter audit records by actor, date range, entity type, and action.
  - `GET /api/audit-log/:entityType/:entityId` — Retrieve complete chronological timeline of an entity.

### 3. 🧠 AI-Powered Smart Reading Insights & Reader Persona
- **What it does**: Analyzes a patron's lifetime borrowing history through an AI literary psychologist engine to produce a personalized reading profile.
- **AI Output**: Generates a creative "Reader Persona" (e.g. *"Dystopian Thinker & Classicist"*), identifies thematic interests, and curates unread recommendations from the catalog.
- **Endpoints**:
  - `GET /api/insights/my-profile` — Patron's personalized reading intelligence report.
  - `POST /ai/reading-insights` — Python microservice profiling endpoint.

### 4. 📊 Collaborative Filtering ("Readers Also Borrowed")
- **What it does**: Discovers books frequently checked out together by other patrons using a pure SQL co-occurrence recommendation algorithm.
- **Algorithmic Logic**:
  1. Finds all users who checked out target book $B$.
  2. Finds all *other* books checked out by those same users.
  3. Ranks candidates by co-occurrence frequency ($\text{COUNT}(\text{DISTINCT user\_id})$).
  4. Gracefully falls back to top-rated titles in the same category if co-borrow data is sparse.
- **Endpoint**:
  - `GET /api/books/:id/also-borrowed` — Returns co-borrowed book suggestions with match reasons.

### 5. 📬 Transactional Bulk CSV Book Importer
- **What it does**: Enables administrative batch onboarding of hundreds of books from CSV files with full ACID transaction safety.
- **Auto-Resolution**: Automatically checks if authors or categories exist; if missing, generates them on the fly.
- **Validation**: Performs strict ISBN-10/13 checksum validation, detects duplicates, and returns a granular row-by-row success/failure report.
- **Endpoints**:
  - `POST /api/exports/import/books` — Upload raw CSV or `{ "csv": "..." }` payload.
  - `GET  /api/exports/import/template` — Download standard import CSV template.

---

## 🤖 AI Microservice & Caching Engine

The AI Microservice (`ai-service/app.py`) leverages OpenAI-compatible endpoints with tailored system prompts:

### 30-Day SQLite Caching Layer
To preserve API quota limits, every generated summary is cached in the `ai_summaries` table with an expiration timestamp (`datetime('now', '+30 days')`). Identical requests for the same book and summary type return instantly from cache with **zero redundant API calls**.

### Summary Types
1. **Brief** (`100-150 words`): Concise synopsis covering premise, target audience, and key takeaway.
2. **Detailed** (`250-400 words`): Markdown-formatted overview covering Themes, Writing Style, and Character Arcs.
3. **Chapter-Wise** (`300-500 words`): Section-by-section breakdown without major spoilers.

---

## ⏰ Automated Background Cron Scheduler

Built using `node-cron` in [`src/cron/jobs.js`](file:///e:/Userfacet%20Assignment/src/cron/jobs.js):

1. **Hourly Overdue Check (`0 * * * *`)**:
   - Queries loans where `status = 'ACTIVE'` and `due_date < now`.
   - Transitions records to `'OVERDUE'`, creates pending fine records, and generates notification alerts.
2. **Daily 9:00 AM Due Reminders (`0 9 * * *`)**:
   - Finds active borrows due within the next 24 hours.
   - Dispatches `'DUE_REMINDER'` notifications to prevent fines.
3. **Every 6 Hours Reservation Expiration (`0 */6 * * *`)**:
   - Identifies fulfilled reservations where `expires_at < now`.
   - Transitions status to `'EXPIRED'`, restores available book copies, and auto-fulfills the next reservation in line.

---

## 📡 Comprehensive REST API Reference

### Authentication & Profiles
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a new member account |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue JWT |
| `POST` | `/api/auth/refresh` | Public | Rotate/refresh access token |
| `GET` | `/api/auth/me` | Private | Get authenticated user profile & loan stats |
| `PUT` | `/api/auth/change-password` | Private | Update current user password |

### Books & AI Intelligence
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/books` | Public | Paginated books with filters (`category_id`, `author_id`, `language`, `available`) |
| `GET` | `/api/books/search?q=...` | Public | Full-text catalog search on title, author, description |
| `GET` | `/api/books/popular` | Public | Top borrowed books ranked by checkout frequency |
| `GET` | `/api/books/:id` | Public | Detailed book record with review count & average rating |
| `GET` | `/api/books/:id/summary` | Private | AI summary (`?type=brief\|detailed\|chapter_wise`) |
| `GET` | `/api/books/:id/recommendations`| Private | AI-powered semantic book recommendations |
| `GET` | `/api/books/:id/also-borrowed` | Public | Collaborative filtering co-occurrence suggestions |
| `POST` | `/api/books` | Librarian/Admin | Create new book record |
| `PUT` | `/api/books/:id` | Librarian/Admin | Update book record |
| `DELETE`| `/api/books/:id` | Admin | Soft-delete book record |

### Circulation, Progress & Insights
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/borrows` | Private | Checkout book (enforces limits and fine blocks) |
| `POST` | `/api/borrows/:id/return` | Private | Return book (calculates fines & fulfills queue) |
| `POST` | `/api/borrows/:id/renew` | Private | Renew loan (enforces max renewals & queue locks) |
| `GET` | `/api/borrows` | Private | View active & past loan history |
| `GET` | `/api/borrows/overdue` | Librarian/Admin | View all currently overdue loans |
| `PUT` | `/api/reading-progress/:borrowId` | Private | Log reading progress (page count & notes) |
| `GET` | `/api/reading-progress/:borrowId` | Private | View progress, reading speed, and ETA |
| `GET` | `/api/reading-progress/my-stats` | Private | Reader statistics dashboard |
| `GET` | `/api/insights/my-profile` | Private | Generate AI reader persona & recommendations |

### Reservations & Reviews
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/reservations` | Private | Reserve out-of-stock book |
| `DELETE`| `/api/reservations/:id` | Private | Cancel reservation & reorder FIFO queue |
| `GET` | `/api/reservations` | Private | View user's active reservations |
| `POST` | `/api/reviews` | Private | Post review (Gated: Must have borrowed book) |
| `PUT` | `/api/reviews/:id` | Private | Update review rating/comment |
| `DELETE`| `/api/reviews/:id` | Private | Delete review & recalculate book average |
| `GET` | `/api/reviews/book/:bookId` | Public | List reviews for a book |

### Fines & Reading Lists
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/fines` | Private | View user fines (or all fines if Admin) |
| `POST` | `/api/fines/:id/pay` | Private | Pay fine |
| `POST` | `/api/fines/:id/waive` | Admin | Waive fine |
| `POST` | `/api/reading-lists` | Private | Create personal reading list |
| `GET` | `/api/reading-lists` | Private | List user's reading lists |
| `GET` | `/api/reading-lists/public` | Public | Browse community public lists |
| `POST` | `/api/reading-lists/:id/books` | Private | Add book to list |
| `DELETE`| `/api/reading-lists/:id/books/:bookId`| Private| Remove book from list |

### Analytics, Exports & Audit
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics/dashboard` | Librarian/Admin | Overview metrics (books, users, loans, revenue) |
| `GET` | `/api/analytics/borrow-trends` | Librarian/Admin | 30-day borrowing and return trend charts |
| `GET` | `/api/analytics/overdue-report` | Librarian/Admin | Overdue patron list with calculated fines |
| `GET` | `/api/exports/books` | Librarian/Admin | Export books catalog to CSV |
| `GET` | `/api/exports/borrows` | Librarian/Admin | Export borrowing transactions to CSV |
| `GET` | `/api/exports/fines` | Librarian/Admin | Export fines ledger to CSV |
| `GET` | `/api/exports/import/template` | Librarian/Admin | Download bulk CSV import template |
| `POST` | `/api/exports/import/books` | Librarian/Admin | Transactional batch book import |
| `GET` | `/api/audit-log` | Admin | Query system-wide enterprise audit logs |
| `GET` | `/api/audit-log/:entityType/:entityId` | Admin | Complete audit history of specific entity |

---

## 🗄️ Database Schema & Performance (14 Tables)

SQLite runs with `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON`.

```
users (id, email, username, password_hash, full_name, role, is_active, max_books_allowed, created_at, updated_at)
authors (id, name, biography, nationality, birth_date, created_at)
categories (id, name, description, parent_category_id, created_at)
books (id, isbn, title, description, author_id, category_id, publication_year, publisher, language, page_count, total_copies, available_copies, avg_rating, cover_image_url, is_deleted, created_at, updated_at)
borrow_records (id, user_id, book_id, borrow_date, due_date, return_date, renewal_count, status, created_at)
reservations (id, user_id, book_id, status, queue_position, reserved_at, expires_at, created_at)
reviews (id, user_id, book_id, rating, review_text, created_at, updated_at) [UNIQUE: user_id, book_id]
ai_summaries (id, book_id, summary_text, summary_type, token_count, created_at, expires_at) [UNIQUE: book_id, summary_type]
fines (id, user_id, borrow_record_id, amount, status, created_at, paid_at)
reading_lists (id, user_id, name, description, is_public, created_at)
reading_list_items (id, reading_list_id, book_id, position, added_at) [UNIQUE: reading_list_id, book_id]
notifications (id, user_id, title, message, type, is_read, created_at)
reading_progress (id, borrow_id, user_id, book_id, current_page, total_pages, percentage, reading_speed_pph, estimated_hours_remaining, notes, created_at, updated_at) [UNIQUE: borrow_id]
audit_log (id, actor_id, actor_role, action, entity_type, entity_id, details, ip_address, created_at)
```

---

## 🧪 Automated Integration Test Suite (20 Steps)

Execute the end-to-end integration test suite:

```bash
node tests/api.test.js
```

### Verified Scenarios
- ✅ **Step 1**: System Health & Version Verification
- ✅ **Step 2**: Member Authentication & Token Generation
- ✅ **Step 3**: Admin Authentication & RBAC Verification
- ✅ **Step 4**: Profile & Active Borrow Stats Retrieval
- ✅ **Step 5**: Catalog Multi-Criteria Search & Filter
- ✅ **Step 6**: AI Book Summary (Live & Cache Hit Verification)
- ✅ **Step 7**: AI Semantic Book Recommendations
- ✅ **Step 8**: Borrow Workflow (Copy Decrement & Cap Validation)
- ✅ **Step 9**: Review Submission with "Must Have Borrowed First" Gate
- ✅ **Step 10**: Book Return Workflow & Dynamic Fine Assessment
- ✅ **Step 11**: Reading List Creation & Book Association
- ✅ **Step 12**: In-App Notification System
- ✅ **Step 13**: Librarian & Admin Analytics Aggregations
- ✅ **Step 14**: CSV Data Exports (Books, Borrows, Fines)
- ✅ **Step 15**: Collaborative Filtering ("Readers Also Borrowed")
- ✅ **Step 16**: Reading Progress Tracker & Velocity/ETA Forecaster
- ✅ **Step 17**: AI Smart Reading Insights & Reader Persona Profiling
- ✅ **Step 18**: Transactional Bulk CSV Book Import
- ✅ **Step 19**: CSV Import Template Download
- ✅ **Step 20**: Enterprise Audit Trail System Verification

---

## 📁 Project Structure Map

```text
e:\Userfacet Assignment\
├── .env                          — Environment configuration
├── .env.example                  — Template environment file
├── .gitignore                    — Git ignore configurations
├── package.json                  — Dependencies and scripts
├── README.md                     — Complete project documentation
├── project_graph.md              — System architecture & ER diagram
├── walkthrough.md                — Verification test walkthrough
├── start.bat                     — Windows dual-service launcher
│
├── src/                          ── Node.js REST API Gateway (Port 3000) ──
│   ├── server.js                 — Express application entry point
│   ├── config/index.js           — Centralized configuration loader
│   ├── database/
│   │   ├── connection.js         — SQLite singleton connection (WAL mode)
│   │   ├── schema.js             — DDL definitions for 14 tables & 17 indexes
│   │   └── seed.js               — Initial catalog and account seeder
│   ├── middleware/
│   │   ├── auth.js               — JWT auth & RBAC middleware
│   │   ├── validate.js           — Joi request validation schemas
│   │   ├── errorHandler.js       — Global error & 404 handler
│   │   └── rateLimiter.js        — Rate limiters (General, Auth, AI)
│   ├── routes/                   — 16 REST Route Modules
│   ├── services/                 — 14 Business Logic Services
│   ├── utils/
│   │   ├── constants.js          — Roles, Statuses, Audit Actions, Entity Types
│   │   └── helpers.js            — UUID, formatting, pagination, math utilities
│   └── cron/
│       └── jobs.js               — Automated background scheduled sweeps
│
├── ai-service/                   ── Python Flask AI Microservice (Port 5000) ──
│   ├── app.py                    — Flask service entry point
│   ├── config.py                 — Microservice configuration
│   ├── requirements.txt          — Flask, requests, flask-cors
│   ├── routes/
│   │   ├── summary_routes.py     — /ai/summary, /ai/recommendations, /health
│   │   └── insights_routes.py    — /ai/reading-insights
│   ├── services/
│   │   ├── summary_service.py    — AI summary generation & 30-day cache
│   │   ├── recommendation_service.py — AI book recommendations
│   │   └── insights_service.py   — Reader personality profiling engine
│   └── utils/
│       └── prompt_templates.py   — GPT-4o-mini prompt engineering templates
│
├── data/
│   └── library.db                — Shared SQLite Database
│
└── tests/
    └── api.test.js               — Full 20-Step Automated Verification Suite
```

---

## 📄 License

This project is licensed under the MIT License. Developed for the Userfacet Backend Engineering Assignment.
