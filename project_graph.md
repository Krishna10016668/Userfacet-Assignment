# E-Library Management System — Project Graph & Architecture (v1.2.0)

## 📁 Directory Tree

```text
e:\Userfacet Assignment\
├── .env                          (335 B)   — Environment variables
├── .env.example                  (436 B)   — Template with placeholder values
├── .gitignore                    (65 B)    — Node + Python ignores
├── README.md                     (14.5 KB) — Project documentation & API reference
├── package.json                  (743 B)   — Node.js dependencies & scripts
├── package-lock.json             (64.2 KB) — Lockfile
├── project_graph.md              (8.5 KB)  — System architecture & ER diagram
├── walkthrough.md                (7.2 KB)  — 30-Step Test verification walkthrough
├── start.bat                     (612 B)   — Dual-service launcher
│
├── src/                                     ── NODE.JS API SERVER (Port 3000) ──
│   ├── server.js                 (4.4 KB)  — Express entry point (v1.2.0)
│   │
│   ├── config/
│   │   └── index.js              (1.1 KB)  — Centralized config loader
│   │
│   ├── database/
│   │   ├── connection.js         (944 B)   — SQLite singleton (WAL mode)
│   │   ├── schema.js             (12.5 KB) — 20 tables + 25 indexes DDL
│   │   └── seed.js               (6.7 KB)  — Sample data seeder
│   │
│   ├── middleware/
│   │   ├── auth.js               (3.0 KB)  — JWT auth + RBAC + optionalAuth
│   │   ├── validate.js           (4.2 KB)  — Joi schema validation
│   │   ├── errorHandler.js       (2.4 KB)  — AppError + global handler
│   │   └── rateLimiter.js        (1.3 KB)  — General / Auth / AI limiters
│   │
│   ├── routes/
│   │   ├── auth.routes.js        (2.6 KB)  — Register, Login, Refresh
│   │   ├── user.routes.js        (7.5 KB)  — Profile, List users (Admin)
│   │   ├── book.routes.js        (6.5 KB)  — CRUD + Summary + Recs + Ask-Book + Quiz + Reviews-Digest
│   │   ├── author.routes.js      (5.4 KB)  — Author CRUD
│   │   ├── category.routes.js    (6.1 KB)  — Category CRUD
│   │   ├── borrow.routes.js      (2.5 KB)  — Borrow, Return, Renew
│   │   ├── reservation.routes.js (2.2 KB)  — Reserve, Cancel
│   │   ├── review.routes.js      (1.9 KB)  — Add/Update/Delete reviews
│   │   ├── fine.routes.js        (2.2 KB)  — Pay, Waive fines
│   │   ├── readingList.routes.js (8.5 KB)  — CRUD + Add/Remove items
│   │   ├── notification.routes.js(1.9 KB)  — List, Mark read
│   │   ├── analytics.routes.js   (2.8 KB)  — Dashboard stats
│   │   ├── export.routes.js      (3.6 KB)  — CSV Exports + Bulk CSV Import
│   │   ├── readingProgress.routes.js (1.8 KB) — 🌟 Reading Progress Tracker
│   │   ├── audit.routes.js       (1.2 KB)  — 🌟 Enterprise Audit Trail
│   │   ├── insights.routes.js    (1.4 KB)  — 🌟 AI Smart Reading Insights
│   │   ├── moodMatch.routes.js   (1.1 KB)  — 🌟 Unique: AI Mood & Vibe Matchmaker
│   │   ├── curriculum.routes.js  (1.2 KB)  — 🌟 Unique: AI Reading Curriculum
│   │   ├── tag.routes.js         (2.0 KB)  — 🌟 Unique: Multi-Dimensional Taxonomies
│   │   ├── gamification.routes.js(1.5 KB)  — 🌟 Unique: Reading Streaks & Badges
│   │   └── bookClub.routes.js    (2.8 KB)  — 🌟 Unique: Digital Book Clubs
│   │
│   ├── services/
│   │   ├── auth.service.js       (5.9 KB)  — Registration, login, JWT
│   │   ├── book.service.js       (16.5 KB) — CRUD + search + AI proxy + Co-occurrence + Tags
│   │   ├── borrow.service.js     (11.8 KB) — Borrow engine + dynamic fine policy + Gamification
│   │   ├── reservation.service.js(7.3 KB)  — Queue management
│   │   ├── review.service.js     (4.9 KB)  — Review gates
│   │   ├── fine.service.js       (7.8 KB)  — Dynamic fine policy with 3-day grace period & caps
│   │   ├── notification.service.js(3.7 KB) — Notification dispatch
│   │   ├── analytics.service.js  (4.9 KB)  — Dashboard aggregations
│   │   ├── export.service.js     (3.3 KB)  — CSV generation
│   │   ├── ai.service.js         (5.2 KB)  — Node→Python HTTP bridge
│   │   ├── readingProgress.service.js (5.8 KB) — 🌟 Reading velocity & ETA + Gamification
│   │   ├── audit.service.js      (3.8 KB)  — 🌟 Security audit logger & query
│   │   ├── bulkImport.service.js (6.2 KB)  — 🌟 Transactional CSV parser
│   │   ├── insights.service.js   (4.1 KB)  — 🌟 AI profiling coordinator
│   │   ├── moodMatch.service.js  (1.8 KB)  — 🌟 Unique: AI Mood matching service
│   │   ├── curriculum.service.js (2.2 KB)  — 🌟 Unique: AI Reading curriculum service
│   │   ├── tag.service.js        (3.5 KB)  — 🌟 Unique: Taxonomies & tagging service
│   │   ├── gamification.service.js(6.8 KB) — 🌟 Unique: Reading streaks & badges service
│   │   └── bookClub.service.js   (7.2 KB)  — 🌟 Unique: Digital Book Clubs service
│   │
│   ├── utils/
│   │   ├── constants.js          (3.5 KB)  — Enums (Roles, Fine Policy, Badges, Audit Actions)
│   │   └── helpers.js            (4.4 KB)  — UUID, pagination, fine calc
│   │
│   └── cron/
│       └── jobs.js               (5.7 KB)  — Overdue detection, reminders
│
├── ai-service/                              ── PYTHON AI MICROSERVICE (Port 5000) ──
│   ├── app.py                    (2.2 KB)  — Flask entry point
│   ├── config.py                 (646 B)   — Python config loader
│   ├── requirements.txt          (69 B)    — flask, flask-cors, requests
│   │
│   ├── routes/
│   │   ├── summary_routes.py     (2.8 KB)  — /ai/summary, /ai/recommendations
│   │   ├── insights_routes.py    (1.2 KB)  — /ai/reading-insights
│   │   ├── ask_book_routes.py    (1.1 KB)  — 🌟 Unique: /ai/ask-book
│   │   ├── mood_match_routes.py  (1.2 KB)  — 🌟 Unique: /ai/mood-match
│   │   ├── quiz_routes.py        (1.2 KB)  — 🌟 Unique: /ai/book-quiz
│   │   ├── review_digest_routes.py(1.2 KB) — 🌟 Unique: /ai/review-digest
│   │   └── curriculum_routes.py  (1.2 KB)  — 🌟 Unique: /ai/reading-curriculum
│   │
│   ├── services/
│   │   ├── summary_service.py    (9.4 KB)  — AI summary gen + SQLite cache
│   │   ├── recommendation_service.py(6.8 KB) — AI recommendation engine
│   │   ├── insights_service.py   (4.8 KB)  — AI reader profiling engine
│   │   ├── ask_book_service.py   (2.5 KB)  — 🌟 Unique: Conversational Q&A engine
│   │   ├── mood_match_service.py (3.2 KB)  — 🌟 Unique: Natural language mood matcher
│   │   ├── quiz_service.py       (3.0 KB)  — 🌟 Unique: Comprehension quiz generator
│   │   ├── review_digest_service.py(3.2 KB)— 🌟 Unique: Review sentiment digest engine
│   │   └── curriculum_service.py (3.5 KB)  — 🌟 Unique: Reading curriculum designer
│   │
│   └── utils/
│       └── prompt_templates.py   (9.4 KB)  — GPT-4o-mini prompt templates
│
├── data/
│   ├── library.db                (350 KB)  — SQLite database (20 Tables, WAL Mode)
│   ├── library.db-shm            (32 KB)   — WAL shared memory
│   └── library.db-wal            (64 KB)   — Write-ahead log
│
└── tests/
    └── api.test.js               (20.8 KB) — Full 30-Step Integration Test Suite
```

---

## 🗄️ Database Tables (20 Tables)

1. `users` — Authentication, roles, and borrow limits
2. `authors` — Authors metadata
3. `categories` — Hierarchical book categories
4. `books` — Catalog stock with active copy tracking
5. `borrow_records` — Checkout history, due dates, renewals
6. `reservations` — FIFO reservation queue
7. `reviews` — Book ratings gated by checkout history
8. `ai_summaries` — 30-day cached AI summaries
9. `fines` — Overdue fine assessments and payment tracking
10. `reading_lists` — Custom collections
11. `reading_list_items` — Indexed book positions
12. `notifications` — System notification triggers
13. `reading_progress` — 🌟 Unique: Pages read, velocity, and completion ETA
14. `audit_log` — 🌟 Unique: Complete security and administrative audit trail
15. `tags` — 🌟 Unique: Multi-dimensional taxonomies
16. `book_tags` — 🌟 Unique: Many-to-many book tag relationships
17. `user_badges` — 🌟 Unique: Milestone achievements and rewards
18. `reading_streaks` — 🌟 Unique: Daily consecutive reading streaks
19. `book_clubs` — 🌟 Unique: Reading circles & group book assignments
20. `club_members` — 🌟 Unique: Club roles & membership tracking
