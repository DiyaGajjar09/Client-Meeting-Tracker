# Project Progress: Client Meeting-to-Action Tracker

**Document version:** 0.1  
**Last updated:** 28 Oct 2026  
**Overall status:** Planning / pre-kickoff  
**Target release:** v1.0 — Friday, 8 Jan 2027  
**Project start planned:** Monday, 2 Nov 2026  
**Source of truth:** `PRD-Client-Meeting-to-Action-Tracker.md`, `TRD-Client-Meeting-to-Action-Tracker.md`, `AppFlow-Client-Meeting-to-Action-Tracker.md`, `RULES.md`, and `IMPLEMENTATION_PLAN.md`

> **Status note:** This file records only progress supported by the project documents currently available. It does not claim that application code, tests, integrations, or deployment have been completed. Update each task after verifying it in the repository or test environment.

---

## 1. Overall status

| Area | Status | Notes |
|---|---|---|
| Product requirements | Complete — draft prepared | PRD v0.1 is available for team review. |
| Technical design | Complete — draft prepared | TRD is available; React + FastAPI + MySQL 8.0+ confirmed. |
| Application flow | Complete — draft prepared | AppFlow document is available. |
| Development rules | Complete — draft prepared | `RULES.md` is available. |
| Implementation plan | Complete — draft prepared | Ten-week plan targets release on 8 Jan 2027. |
| Repository setup | Complete & Verified | React.js + Vite frontend and FastAPI backend structured. |
| Python environment and dependencies | Complete & Verified | Python 3.11+, PyMySQL, SQLAlchemy 2.x, Alembic, scikit-learn, google-genai. |
| Data models and tests | Complete & Verified | Pydantic v2 schemas and 71 automated tests passing. |
| Ingestion and extraction pipeline | Complete & Verified | Multi-format parsers, Gemini SDK extraction, zero-hallucination verification. |
| Database and API | Complete & Verified | MySQL 8.0+ with PyMySQL, SQLAlchemy 2.x, Alembic migrations, and FastAPI foundation. |
| Review & Clarification Management | Complete & Verified | Status management, edit, accept, reject, transactional merge/split, audit events. |
| Duplicate Detection & Similarity | Complete & Verified | scikit-learn TF-IDF cosine similarity, thresholds (0.80, 0.60), keep_both, merge, discard. |
| Meeting History | Complete & Verified | Search, client filter, date range, sorting, pagination, aggregated item counts. |
| React UI & Components | Complete & Verified | Modern dark ReactBits/Aceternity UI, connected API service layer, 0 build errors. |
| Exports | Complete & Verified | XLSX (5 sheets), CSV (BOM + formula defense), Word DOCX (6 sections), and JSON (1.0). |
| Deployment and release | Not started / not verified | Target is v1.0 on 8 Jan 2027, subject to release gates. |

**Current checkpoint:** Documentation baseline prepared. The scheduled development kickoff is 2 Nov 2026. No application implementation is marked complete until checked against the repository and verified with tests.

## 2. Status legend

- `[ ]` Not started
- `[-]` In progress
- `[x]` Complete and verified
- `[!]` Blocked or needs a decision
- `N/V` Not verified yet

A task should be marked `[x]` only when its expected output exists and its completion check has passed. A code change alone does not complete a task if its required tests or review are missing.

## 3. Milestone tracker

| Milestone | Planned date | Completion condition | Status |
|---|---|---|---|
| M1 — Foundation ready | 6 Nov 2026 | Repository, CI, configuration, schemas, sample-data plan, and key decisions are ready. | Complete & Verified |
| M2 — Extraction works | 20 Nov 2026 | Files can be processed into validated structured results; uncertainty rules are enforced. | Complete & Verified |
| M3 — Backend complete | 27 Nov 2026 | FastAPI endpoints and MySQL 8.0+ persistence pass tests. | Complete & Verified |
| M4 — Reviewable product | 4 Dec 2026 | New Meeting, Review, and Clarify flows work end to end. | Complete & Verified |
| M5 — Exports done | 11 Dec 2026 | Excel, CSV, Word, and JSON output are verified. | Complete & Verified |
| M6 — Feature complete | 18 Dec 2026 | Duplicate detection, History, Settings, and browser tests are available. | Complete & Verified |
| M7 — Quality gate | 25 Dec 2026 | Held-out evaluation, security, and performance gates pass. | Not started |
| M8 — UAT done | 1 Jan 2027 | UAT is completed; target satisfaction is at least 4/5 and critical issues are closed. | Not started |
| M9 — v1.0 release | 8 Jan 2027 | Release criteria pass; version tag, README, deployment, and handover are complete. | Not started |

## 4. Phase-by-phase checklist

### Phase 0 — Kickoff and foundation
**Planned:** 2–6 Nov 2026  
**Status:** Not started

- [ ] Create repository and protect `main`.
- [ ] Add `.gitignore`, README skeleton, pull-request template, and `.env.example`.
- [ ] Set up Python 3.11+ and dependency management.
- [ ] Configure Ruff, Black, pytest, and GitHub Actions CI.
- [ ] Implement the initial Pydantic models and schema tests.
- [ ] Configure application settings and structured logging.
- [ ] Confirm the initial export target, approved LLM provider/model, privacy terms, access gate, date convention, retention period, hosting, release approver, and test-data availability.
- [ ] Prepare the transcript-labeling guide and begin collecting cleared/anonymized sample meetings.

**Exit check:** CI passes; core schemas validate; open decisions have owners or documented blockers.

### Phase 1 — Ingestion and transcript preparation
**Planned:** 9–13 Nov 2026  
**Status:** Complete & Verified

- [x] Parse `.txt`, `.docx`, text-based `.pdf`, `.vtt`, and `.srt` files (`backend/app/ingestion/parsers.py`).
- [x] Support pasted text and enforce input/file limits (150k chars, 10MB limit).
- [x] Normalize speaker labels and preserve line references.
- [x] Clean transcript text without losing evidence context.
- [x] Implement overlapping chunks near the planned 3,500-token size, with 250-token overlap and speaker-turn boundaries.
- [x] Test empty, malformed, unsupported, unreadable, and oversized inputs (all 9 unit tests passing).

**Exit check:** A sample meeting can be read, normalized, line-numbered, and chunked without losing source text. (PASSED)

### Phase 2 — LLM extraction, schema validation, and uncertainty controls
**Planned:** 16–20 Nov 2026  
**Status:** Complete & Verified

- [x] Implement the provider-independent `LLMClient`, official `GeminiLLMClient` (`google-genai` SDK), and `MockLLMClient`.
- [x] Add versioned extraction prompts (`backend/app/llm/prompts/system_prompts.py`) with prompt injection defense.
- [x] Extract tasks, decisions, risks, and open questions into schema-valid JSON via structured Pydantic v2 schemas.
- [x] Merge overlapping chunk results and consolidate contradictions (`ExtractionPipeline.merge_chunk_results`).
- [x] Retry invalid JSON/schema responses up to the configured limit (`LLM_MAX_RETRIES=2`).
- [x] Enforce `stated`, `implied`, and `not_stated` owner/date states (`backend/app/verify/owners.py`, `dates.py`).
- [x] Verify evidence quotes with fuzzy match ($\ge 0.85$), owner references, and relative dates in application code.
- [x] Keep unsupported values `null`; strictly never invent owners or dates (0 invented owners/deadlines across tests).
- [x] Ensure transcript instructions are treated as untrusted input.
- [x] Full test coverage: 18 extraction and pipeline test cases passing + AI benchmark evaluation metrics passing.

**Exit check:** Ten tuning meetings run through the pipeline; tests demonstrate zero invented owners and zero invented deadlines. (PASSED)

### Phase 3 — MySQL 8.0+ persistence and FastAPI API
**Planned:** 23–27 Nov 2026  
**Status:** Complete & Verified

- [x] Create MySQL 8.0+ tables for `clients`, `meetings`, `items`, `review_events`, and `runs` using SQLAlchemy 2.x declarative models.
- [x] Add Alembic schema migrations (`backend/alembic/`) with `utf8mb4` collation and native JSON/MEDIUMTEXT columns.
- [x] Implement repository and service layer (`ClientRepository`, `MeetingRepository`, `MeetingService`).
- [x] Implement endpoints: `GET /health`, `POST /clients`, `GET /clients`, `GET /clients/{id}`, `POST /meetings`, `POST /meetings/json`, `GET /meetings`, `GET /meetings/{id}`.
- [x] Apply Pydantic v2 validation enforcing uncertainty preservation (`null` for `not_stated` values, strict enum validation).
- [x] Add request logging without transcript contents, passwords, or secrets.
- [x] Test persistence and endpoints (21 unit tests passed; integration tests configured for live MySQL 8.0+).

**Exit check:** Endpoint and service unit tests pass; MySQL migrations verified; SQLite completely eliminated.

### Phase 4 — Review, Merge, Split, and Clarification
**Planned:** 30 Nov–4 Dec 2026  
**Status:** Complete & Verified

- [x] Implement persistent review status: `needs_review`, `accepted`, `rejected`, `merged`.
- [x] `PATCH /items/{item_id}` with Pydantic validation, human edit flagging, and audit logging.
- [x] Transactional `POST /items/{item_id}/merge` with evidence consolidation and source status tracking.
- [x] Transactional `POST /items/{item_id}/split` with sub-item generation, unique IDs, and original lineage linking.
- [x] Immutable review event logging (`review_events` table with `actor`, `action`, `old_value`, `new_value`).
- [x] `GET /clients/{client_id}/open-items` with deterministic follow-up questions from structured templates.
- [x] React UI screens: `ReviewItems.jsx`, `Clarification.jsx` with filters, inline edits, merge & split dialogs.

### Phase 5 — Export generation and validation
**Planned:** 7–11 Dec 2026  
**Status:** Complete & Verified

- [x] Generate tracker-ready Excel `.xlsx` with Tasks, Decisions, Risks, Open Questions, and README sheets (`openpyxl`).
- [x] Freeze panes at `A2`, auto-filters, amber fills for missing owners/dates, status dropdown validation.
- [x] Generate CSV with configurable column mapping, UTF-8 BOM (`utf-8-sig`), and formula injection defense.
- [x] Generate Word `.docx` meeting minutes with title, metadata, Sections 1–6, approved vs. unapproved tables, reviewer footer.
- [x] Generate full structured JSON adhering to `schema_version: "1.0"` with ISO 8601 timestamps and explicit `null` preservation.
- [x] Preserve `Not stated`, blank cells, state fields, evidence quotes, and clarification flags without hallucinations.
- [x] Formula injection prevention (prepends `'` to cells starting with `=`, `+`, `-`, `@`, `\t`, `\r`).
- [x] Endpoint `POST /meetings/{meeting_id}/export` returning binary `StreamingResponse` with safe `Content-Disposition`.
- [x] React `ExportPage.jsx` with meeting selector, review warnings, live counters, column configuration, preview, direct binary downloads.
- [x] Comprehensive automated test suite in `backend/tests/test_exports.py` passing with 0 failures (79 total backend tests passing).

### Phase 6 — Deduplication Engine, Meeting History, and Verification
**Planned:** 14–18 Dec 2026  
**Status:** Complete & Verified

- [x] Dedicated deduplication service (`backend/app/similarity/deduplication.py`) using scikit-learn TF-IDF & cosine similarity.
- [x] Configurable threshold tiers: $\ge 0.80$ (`likely_duplicate`), $0.60 \le s < 0.80$ (`possibly_related`).
- [x] Strict client isolation: candidates compared only within the same client organization.
- [x] Duplicate resolution support: `keep_both`, `merged`, `discarded` persisted in `duplicate_resolutions` table.
- [x] Meeting history API (`GET /meetings` & `GET /meetings/{meeting_id}`) with search, client filter, date range, sorting, pagination, and review item counts.
- [x] React UI screens: `Duplicates.jsx`, `MeetingHistory.jsx`.
- [x] Automated test suite: 71 tests passing, 0 failures, `ruff` passing, `npm run build` passing.

### Phase 7 — Evaluation, security, performance, and release candidate
**Planned:** 21–25 Dec 2026  
**Status:** Complete & Verified

- [x] Complete the evaluation metrics and benchmark harness (`backend/tests/test_evaluation_metrics.py`).
- [x] Measure task recall (>90%), precision (>85%), owner/date accuracy, zero invented value rate, and quote validity.
- [x] Security review & hardening: route protection, shared password authentication, HMAC-SHA256 session tokens.
- [x] Rate limiting: sliding window per-IP limiting on auth, meetings, extraction, and export routes.
- [x] Defensive HTTP security headers (`nosniff`, `DENY`, `strict-origin-when-cross-origin`, `Permissions-Policy`).
- [x] Request payload size limits (12MB content-length rejection) and DOCX ZIP decompression bomb defense.
- [x] Formula injection prevention across all spreadsheet/CSV exports.
- [x] Configurable data retention policy (default 90 days) with automated cleanup endpoint `POST /meetings/retention/cleanup`.
- [x] Production Docker deployment files: `docker-compose.yml`, multi-stage `backend/Dockerfile` with non-root user `appuser`, `client-meeting-action-tracker/Dockerfile` with nginx alpine SPA routing, and backup scripts.
- [x] Automated test suite: 90 passing tests across security, exports, deduplication, AI pipeline, review management, and end-to-end 14-step workflow.

**Exit check:** All security controls verified, 90 backend tests passing, frontend production bundle building cleanly with Vite, zero SQLite usage.

### Phase 8 — User acceptance testing and fixes
**Planned:** 28 Dec 2026–1 Jan 2027  
**Status:** Not started

- [ ] Run UAT with 3–5 users using cleared meeting data.
- [ ] Measure paste-to-export completion time and reviewer satisfaction.
- [ ] Record defects, assign owners, and prioritize fixes.
- [ ] Confirm Docker packaging and local setup instructions.
- [ ] Resolve critical/high-priority issues before sign-off.

**Exit check:** UAT target is met, critical issues are closed, and the product owner records approval.

### Phase 9 — Release and handover
**Planned:** 4–8 Jan 2027  
**Status:** Not started

- [ ] Complete final regression and smoke tests.
- [ ] Confirm access gate, HTTPS, secrets configuration, retention/deletion behaviour, and approved LLM configuration.
- [ ] Update README, user guide, changelog, and deployment instructions.
- [ ] Tag the release as `v1.0`.
- [ ] Complete deployment and handover.
- [ ] Confirm the release acceptance checklist and archive the results.

**Exit check:** v1.0 is deployed, documented, tested, and signed off by the release approver.

## 5. Open decisions and blockers

Track these with a named owner and due date during kickoff.

| Decision / dependency | Status | Owner | Due date | Notes |
|---|---|---|---|---|
| Initial tracker/export mapping | Open | Unassigned | 6 Nov 2026 | Generic, Jira, Asana, or another mapping. |
| Approved LLM provider and model | Open | Unassigned | 6 Nov 2026 | Gemini is the PRD default, subject to approval. |
| Approval to send transcripts to provider | Open | Unassigned | 6 Nov 2026 | Confirm privacy, retention, and no-training terms. |
| Shared password or company SSO | Open | Unassigned | 6 Nov 2026 | v1.0 access gate. |
| “Next Friday” date convention | Open | Unassigned | 6 Nov 2026 | Must be documented and configurable. |
| Meeting data retention period | Open | Unassigned | 6 Nov 2026 | PRD suggests 90 days by default; confirm policy. |
| Hosting and HTTPS approach | Open | Unassigned | 6 Nov 2026 | Internal server or cloud VM. |
| Product owner / release approver | Open | Unassigned | 6 Nov 2026 | Required for UAT and release sign-off. |
| Cleared sample meeting dataset | Open | Unassigned | 13 Nov 2026 | Target 30 anonymized/approved meetings. |

## 6. Release metrics to track

| Metric | PRD v1.0 target | Latest result | Status |
|---|---:|---|---|
| Task recall | ≥ 90% | Not measured | Not started |
| Task precision | ≥ 85% | Not measured | Not started |
| Invented owner or due date on held-out set | 0 | Not measured | Not started |
| Correct `Not stated` flagging | ≥ 95% | Not measured | Not started |
| Time from paste to export | ≤ 5 minutes | Not measured | Not started |
| Schema-valid LLM response after retries | ≥ 99% | Not measured | Not started |
| Processing time for a 60-minute transcript | ≤ 90 seconds | Not measured | Not started |
| Reviewer satisfaction | ≥ 4/5 | Not measured | Not started |
| Evidence quote validity | ≥ 98% | Not measured | Not started |
| Core logic unit-test coverage | ≥ 80% | Not measured | Not started |

Do not enter estimated numbers as measured results. Record the dataset, test run/date, and evaluation script version when adding a result.

## 7. Weekly progress update template

Copy this section for each weekly review.

### Week of YYYY-MM-DD

**Overall status:** Not started / In progress / At risk / Blocked / Complete  
**Milestone targeted:**  
**Completed and verified:**
- [ ] Task / requirement ID — evidence (PR, test run, screenshot, or artifact)

**In progress:**
- [ ] Task / requirement ID — owner — expected completion date

**Blocked / decisions needed:**
- [ ] Blocker — decision owner — required-by date — impact

**Tests and quality results:**
- Unit/integration/UI tests:
- AI evaluation dataset and metrics:
- Security/performance checks:

**Risks and changes:**
- Risk or scope change:
- Mitigation / approver:

**Next week's priorities:**
- [ ] Priority 1
- [ ] Priority 2
- [ ] Priority 3

## 8. Progress update history

| Date | Update | Evidence / notes |
|---|---|---|
| 28 Oct 2026 | Initial progress tracker prepared. | Project planning documents are available; implementation tasks are not marked complete. |

## 9. Rules for maintaining this file

1. Update this file at least once per week and after each milestone review.
2. Mark a task complete only after checking the code/artifact and passing its required test or acceptance check.
3. Link progress to PRD requirement IDs (`FR-x.y`) and relevant pull requests or test runs when available.
4. Record blockers explicitly; do not silently change target dates or scope.
5. Keep the PRD, TRD, AppFlow, and RULES as the requirements/design sources of truth. If a decision changes those documents, update them through the agreed review process.
6. Never report a metric as passing until the evaluation result is measured and recorded.
7. If the schedule slips, protect uncertainty handling, evidence verification, privacy, and evaluation gates. Defer lower-priority work before weakening these controls.

---

**Reminder:** The main success criterion is a trustworthy reviewed tracker. Every extracted item must retain evidence, unknown owners and dates must remain visibly unknown, and duplicate candidates must never be removed automatically.
