# Client Meeting-to-Action Tracker

An enterprise-grade, traceability-first web application that ingests unstructured client meeting transcripts and notes, extracts structured tasks, decisions, risks, and open questions via Google Gemini API, enforces human review with duplicate detection and clarification workflows, and exports verified records to Excel (`.xlsx`), Word (`.docx`), CSV, and JSON.

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │          React.js + Vite Frontend       │
                      │  - Tailwind CSS / Lucide Icons          │
                      │  - Dual-mode (Mock & Live FastAPI API)  │
                      │  - Stepper & Noise Background UI        │
                      └────────────────────┬────────────────────┘
                                           │ HTTP / JSON (Bearer JWT)
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │          FastAPI Backend (Python 3.11+) │
                      │  - Pydantic v2 Schema Validation        │
                      │  - Sliding Window IP Rate Limiting      │
                      │  - Cryptographic Session Auth Tokens    │
                      │  - Defensive Security Headers           │
                      │  - DOCX Zip Decompression Defense       │
                      │  - CSV / XLSX Formula Injection Defense │
                      └─────────────┬───────────────────────────┘
                                    │
            ┌───────────────────────┼──────────────────────────┐
            ▼                       ▼                          ▼
┌───────────────────────┐ ┌────────────────────┐ ┌───────────────────────┐
│     MySQL 8.0+        │ │ Google Gemini API  │ │  scikit-learn Sim.    │
│  - SQLAlchemy 2.x     │ │  - Structured JSON │ │  - TF-IDF Vectorizer  │
│  - PyMySQL Driver     │ │  - Evidence Quotes │ │  - Cosine Similarity  │
│  - Alembic Migration  │ │  - Uncertainty Det.│ │  - Metadata Boost     │
│  - Zero SQLite Policy │ │  - Zero Hallucinat.│ │  - Client Isolation   │
└───────────────────────┘ └────────────────────┘ └───────────────────────┘
```

---

## Key Features

1. **Strict Uncertainty & Zero-Hallucination Policy**:
   - Never invents owners or due dates: unstated owners remain strictly `null` with state `not_stated`. Unstated deadlines remain `null` and export as blank cells.
   - Verbatim evidence quotes with line numbers are required for all extracted items.
2. **Review Management & Audit Trail**:
   - Items require human review before export (`needs_review`, `accepted`, `rejected`, `merged`).
   - Immutable audit logging in `review_events` recording every edit, merge, split, and status change.
3. **TF-IDF Duplicate Detection**:
   - Identifies candidate duplicate tasks within client isolation boundaries across meeting history.
   - Supports 3 resolution states: `keep_both`, `merged`, `discarded`.
4. **Clarification Question Generator**:
   - Deterministically detects unassigned high-priority tasks and ambiguous items across client history to prepare structured questions for follow-up.
5. **Multi-Format Export Engine**:
   - **Excel (`.xlsx`)**: Tracker-ready with Tasks, Decisions, Risks, Open Questions, and README sheets, auto-filters, amber fills for unstated values, formula injection defense.
   - **CSV**: Configurable column mappings, UTF-8 BOM (`utf-8-sig`), formula injection defense.
   - **Word (`.docx`)**: Formal meeting minutes with Section 1–6 layout and reviewer sign-off block.
   - **JSON**: Full hierarchical export adhering to `schema_version: "1.0"`.
6. **Hardened Security & Production Readiness**:
   - **Zero SQLite Guarantee**: 100% MySQL 8.0+ in production, configurations, migrations, and test harness.
   - **Session Authentication**: Cryptographic HMAC-SHA256 session tokens with configurable shared workspace password.
   - **Rate Limiting**: Sliding-window rate limiter on sensitive endpoints (`/auth/login`, `/meetings`, `/extract`, `/export`).
   - **Defensive Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
   - **Decompression Bomb Defense**: Safe ZIP ratio inspection rejecting maliciously crafted DOCX files.
   - **Data Retention Enforcement**: Automated 90-day retention cleanup routine with manual triggering endpoint.

---

## Quick Start with Docker Compose

To run the complete production stack (MySQL 8.0 + FastAPI backend + React/Nginx frontend):

```bash
# 1. Clone the repository and enter the directory
cd "Client Meeting-to-Action Tracker"

# 2. Configure environment variables (or rely on docker-compose defaults)
export GEMINI_API_KEY="your-gemini-api-key-here"

# 3. Launch all containers
docker compose up --build -d

# 4. Open the application in your browser:
# Frontend: http://localhost (or http://localhost:5173)
# Backend API Docs: http://localhost:8000/docs
# Backend Health Check: http://localhost:8000/api/v1/health
```

---

## Local Development Setup

### 1. Backend (FastAPI + MySQL)

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure .env
cp .env.example .env
# Edit .env with your MySQL credentials and GEMINI_API_KEY

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend (React + Vite)

```bash
cd client-meeting-action-tracker

# Install packages
npm install

# Run Vite dev server
npm run dev
# App will run at http://localhost:5173
```

---

## Running the Automated Test Suite

The backend contains **90 automated tests** covering security, extraction, review management, exports, deduplication, and the full 14-step workflow:

```bash
cd backend
.venv/bin/pytest -v
```

All 90 tests pass with **zero failures** and **zero SQLite usage**.

To run linter and code quality checks:

```bash
# Backend code quality
cd backend
.venv/bin/ruff check app tests

# Frontend production build verification
cd client-meeting-action-tracker
npm run build
```

---

## Automated Database Backup

### Linux / Container / macOS
```bash
MYSQL_PASSWORD=tracker_secret ./scripts/backup_mysql.sh
```

### Windows / Python Cross-Platform
```bash
python backend/app/scripts/backup_db.py --output-dir backups --retention-days 14
```

---

## Security Disclosure & Best Practices

- All spreadsheet and CSV exports neutralize formula injection attempts (cells beginning with `=`, `+`, `-`, `@`, `\t`, `\r` are escaped with a leading single quote `'`).
- Transcripts larger than 12MB or containing ZIP compression expansion ratios greater than 50:1 are rejected immediately.
- The health check endpoint `GET /api/v1/health` verifies database connectivity via `SELECT 1` without ever leaking connection strings, passwords, or internal file paths.

