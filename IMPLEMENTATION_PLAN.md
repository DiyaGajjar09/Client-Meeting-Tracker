# Implementation Plan: Client Meeting-to-Action Tracker

**Document version:** 0.1  
**Draft date:** 28 Oct 2026  
**Status:** Draft for implementation planning  
**Target release:** v1.0 — Friday, 8 Jan 2027  
**Source documents:** `PRD-Client-Meeting-to-Action-Tracker.md`, `TRD-Client-Meeting-to-Action-Tracker.md`, `AppFlow-Client-Meeting-to-Action-Tracker.md`, and `RULES.md`

---

## 1. Purpose

This plan converts the product requirements and technical design into a practical, ordered development backlog. It defines phases, task checklists, dependencies, expected outputs, test gates, and release criteria for v1.0.

The primary delivery path is:

**Repository foundation → schemas and ingestion → extraction and verification → database and API → review UI → exports → duplicate detection and history → evaluation and security → UAT → release.**

The PRD's v1.0 scope remains authoritative. Phase 2 and Phase 3 capabilities must not be added to v1.0 without an approved scope change.

## 2. Delivery principles

1. **Never invent meeting facts.** Owners, due dates, priority, status, dependencies, attendees, and other facts must not be guessed.
2. **Evidence first.** Every extracted task, decision, risk, and open question must retain an exact supporting quote and available speaker/line references.
3. **Preserve unknowns.** Unknown values remain `null` in structured data and display as `Not stated` in the UI and relevant exports. Do not use invented defaults.
4. **Human review is mandatory.** Each item must be accepted or rejected before final export. Low-confidence items must never be auto-accepted.
5. **Duplicates are only candidates.** Similarity flags require human action; no task is automatically deleted or merged.
6. **Keep the source safe.** Save the meeting text before extraction where possible. Extraction or provider failures must not destroy the source or usable partial results.
7. **Respect module boundaries.** Streamlit calls FastAPI; only the LLM adapter calls the external provider; verification and export rules are enforced in application code.
8. **Test the failure paths.** Invalid files, malformed LLM output, prompt injection, missing data, and failed exports are required cases, not optional polish.
9. **Work from requirements.** Link implementation issues and pull requests to PRD requirement IDs (`FR-x.y`) and corresponding tests.

## 3. Scope for v1.0

### In scope

- Paste meeting text up to 150,000 characters.
- Upload `.txt`, `.docx`, text-based `.pdf`, `.vtt`, and `.srt` files up to 10 MB.
- Capture client, meeting title, optional meeting date, and optional attendees.
- Normalize speaker labels, preserve line references, clean text, and chunk long transcripts with overlap.
- Extract tasks, decisions, risks, open questions, and only the agreed optional fields supported by the schema.
- Validate LLM output with Pydantic v2 and retry invalid structured output.
- Verify evidence quotes, owners, and dates with deterministic code.
- Preserve `stated`, `implied`, and `not_stated` owner/due-date states, plus confidence and clarification flags.
- Review and edit items; accept, reject, merge, and split items; record human review events.
- Detect possible duplicate tasks for the same client using TF-IDF and cosine similarity.
- Store clients, meetings, items, review events, and extraction runs in MySQL 8.0+.
- Export `.xlsx`, `.csv`, `.docx`, and `.json`.
- Provide New Meeting, Review, Clarify, Duplicates, Export, History, and Settings screens.
- Add automated testing, labelled evaluation data, CI, documentation, and Docker packaging.

### Out of scope for v1.0

- Live meeting recording, meeting bots, audio transcription, or scanned-PDF OCR.
- Direct Jira, Asana, Trello, or other tracker API synchronization.
- Automatic reminders or sending emails.
- Hindi, Gujarati, or other non-English transcript support.
- Application-level user accounts and role-based authorization.
- Embedding-based similarity, auto-learning from corrections, or automatic duplicate removal.

## 4. Team and work allocation

The PRD schedule assumes two full-time developers and two part-time reviewers. Names are intentionally left unassigned; replace the role labels with actual team members during kickoff.

| Role | Primary responsibilities |
|---|---|
| Developer A — Backend / AI | FastAPI, schemas, ingestion, LLM adapter and prompts, extraction pipeline, verification, MySQL services |
| Developer B — UI / Exports | Streamlit screens, review interactions, clarification and duplicate screens, export generation, UI automation |
| Shared engineering | Architecture decisions, API contracts, integration, security, code review, CI, deployment and documentation |
| Reviewer 1 | Help label the meeting dataset, review extraction quality and edge cases, participate in UAT |
| Reviewer 2 | Independently label/evaluate meetings, review output correctness and participate in UAT |
| Product owner / release approver | Decide unresolved product questions, approve acceptance criteria, sign off UAT and release gate |

Developers should pair on schemas, API contracts, uncertainty rules, and cross-module integration. Avoid having UI and API implementations evolve against different payload shapes.

## 5. Before coding: decisions and dependencies

Resolve or explicitly record the following decisions during Week 1. The plan does not silently assume answers to questions left open in the source documents.

- [ ] **Initial export target:** confirm whether the first Excel/CSV mapping should be generic, Jira, Asana, or another tracker format.
- [ ] **LLM provider and model:** approve Gemini or an alternative provider/model and obtain a test API key and cost limit.
- [ ] **Transcript privacy:** confirm whether meeting text may be sent to the approved provider, under what retention/no-training terms, and whether redaction is required by default.
- [ ] **Access gate:** select host-level shared password or company SSO for v1.0.
- [ ] **Relative-date convention:** approve the documented meaning of phrases such as “next Friday”; keep original wording even when a date is resolved.
- [ ] **Data retention:** confirm the retention period; PRD proposes a 90-day default and deletion of all meeting-related records on request.
- [ ] **Hosting target:** identify the internal server or cloud VM, HTTPS termination, backup approach, and release owner.
- [ ] **Release approver:** identify who signs off the quality gate and v1.0.
- [ ] **Sample data:** confirm 30 cleared/anonymized meetings can be used, with 10 for tuning and 20 held out for final evaluation.
- [ ] **Company calendar:** confirm any holidays that affect the proposed schedule.

If a decision is still open at implementation time, use a documented configuration point or a safe default only where the PRD/TRD already authorizes one; record the unresolved decision and owner. Do not weaken privacy or uncertainty rules to work around delays.

## 6. Repository and development workflow

### 6.1 Initial repository structure

```text
meeting-action-tracker/
├── app/
│   ├── api/                 # FastAPI routes and request handling
│   ├── core/                # Settings, logging, exceptions
│   ├── ingestion/           # Parsers, speaker normalization, line numbering, chunking
│   ├── llm/                 # LLMClient and provider adapters
│   ├── models/              # Pydantic schemas, enums, API payloads
│   ├── verify/              # Quote, owner, date, confidence, consistency checks
│   ├── similarity/          # TF-IDF and duplicate candidate generation
│   ├── export/              # Excel, CSV, Word, JSON exporters
│   └── db/                  # MySQL models, repositories, Alembic migrations
├── ui/                      # Streamlit screens and UI helpers
├── prompts/                 # Versioned extraction and consolidation prompts
├── eval/                    # Labelled meeting data and evaluation scripts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── api/
│   ├── export/
│   └── e2e/
├── .github/workflows/        # CI pipeline
├── README.md
├── .env.example
├── .gitignore
├── pyproject.toml           # Dependencies and Ruff/Black/pytest configuration
├── Dockerfile
└── docker-compose.yml       # Optional local orchestration if needed
```

Keep the TRD's baseline layout. Additional subfolders such as `tests/unit/` may be used to keep the suite organized, but do not add a new framework or service without documenting its impact.

### 6.2 Branching and pull requests

- `main` must remain releasable.
- Use `feature/<requirement-id>-<short-name>` for feature branches and `fix/<short-name>` for fixes.
- Keep commits small and descriptive, for example: `feat(FR-2.6): validate structured LLM output`.
- Every pull request must identify affected requirement IDs, describe behaviour changes, include test evidence, and have at least one reviewer.
- CI must pass before merge: Ruff, Black check, pytest, and applicable API/UI smoke tests.
- Keep `.env` and real secrets out of Git. Commit `.env.example` with placeholder values only.

## 7. Implementation phases and task checklist

## Phase 0 — Kickoff and foundation

**Target:** 2–6 Nov 2026  
**Milestone:** M1 — Foundation ready by Friday, 6 Nov 2026

### Tasks

- [ ] Confirm the decisions and dependencies listed in Section 5; assign an owner and due date to each.
- [ ] Create the GitHub repository and apply branch protection.
- [ ] Add `.gitignore`, README skeleton, licence/ownership information if required, and PR template.
- [ ] Set up Python 3.11+ virtual environment and dependency management.
- [ ] Add pinned or bounded dependencies for FastAPI, Uvicorn, Streamlit, Pydantic v2, Pandas, openpyxl, python-docx, scikit-learn, pytest, Requests, BeautifulSoup, Playwright, Ruff, Black, and python-dotenv as needed.
- [ ] Configure Ruff, Black, pytest, type-checking conventions if adopted, and test coverage reporting.
- [ ] Add GitHub Actions CI for linting, formatting checks, and the initial test suite.
- [ ] Implement configuration loading and `.env.example`; fail safely when required settings are missing.
- [ ] Add structured logging with request/run IDs while ensuring transcript text is never logged.
- [ ] Implement the shared Pydantic enums and models based on the TRD/PRD schema.
- [ ] Write schema tests for valid objects, `null` unknowns, invalid empty-string defaults, enum rejection, and evidence requirements.
- [ ] Create the evaluation labelling guide and collect/anonymize the first 10 sample meetings.
- [ ] Record all remaining design choices in a decisions log.

### Deliverables

- Working repository and local development guide.
- CI runs successfully on a clean checkout.
- Shared domain schemas and tests are in place.
- Provider, access, date convention, initial export mapping, and privacy questions have owners or recorded decisions.

### Exit gate

- [ ] A new developer can create the environment and run tests.
- [ ] Pydantic models validate agreed sample objects.
- [ ] No secrets are present in the repository.
- [ ] The team agrees on API payloads before UI and endpoint work proceeds independently.

## Phase 1 — Ingestion and transcript preparation

**Target:** 9–13 Nov 2026  
**Milestone contribution:** first end-to-end input reaches the extraction adapter

### Tasks

- [ ] Implement pasted-text validation with a maximum of 150,000 characters.
- [ ] Implement `.txt` parser and safe UTF-8/encoding error handling.
- [ ] Implement `.docx` text extraction.
- [ ] Implement text-based `.pdf` extraction; reject unreadable/scanned PDFs with a clear message because OCR is out of scope.
- [ ] Implement `.vtt` and `.srt` parsing, preserving speaker turns and source line references where possible.
- [ ] Validate file extension, detected content type where available, readability, and 10 MB upload limit.
- [ ] Return actionable errors for empty, malformed, unreadable, unsupported, or oversized files.
- [ ] Normalize common speaker labels such as `Priya:` and `[00:12:03] Priya` without discarding the association between utterances and speakers.
- [ ] Clean timestamps and filler only where safe; preserve enough source mapping to find evidence in the original transcript.
- [ ] Number normalized lines and retain mappings to source text.
- [ ] Implement token-aware chunking targeting about 6,000 tokens with 500-token overlap; split near speaker turns and do not cut mid-sentence when avoidable.
- [ ] Add tests for empty input, 150,000-character pasted text, 10 MB boundary, malformed files, line mapping, speaker normalization, and chunk boundaries.

### Deliverables

- Reusable ingestion functions under `app/ingestion/`.
- Parser/unit test coverage for all v1.0 formats.
- Normalized transcript representation with line/speaker references.

### Exit gate

- [ ] Supported input formats produce readable normalized text.
- [ ] Unsupported/scanned content fails clearly instead of silently producing empty text.
- [ ] A long transcript is divided into overlapping chunks without losing boundary context.

## Phase 2 — LLM extraction, schema validation, and uncertainty controls

**Target:** 16–20 Nov 2026  
**Milestone:** M2 — Extraction works by Friday, 20 Nov 2026

### Tasks

- [ ] Define the `LLMClient.generate_structured(prompt, schema)` provider-independent interface.
- [ ] Implement the approved Gemini adapter behind the interface; avoid provider-specific details outside `app/llm/`.
- [ ] Store extraction and consolidation prompts as versioned files in `prompts/`.
- [ ] Define the prompt contract: JSON only, schema adherence, exact evidence quotes, null unknowns, no guessing, transcript-as-untrusted-data.
- [ ] Include few-shot examples for missing owner, vague due date, conflicting owners, and reversed/cancelled decisions.
- [ ] Add token counting and configurable warning limits before calls.
- [ ] Add configurable timeout (60 seconds per call), retry/backoff behaviour, and clear final errors after the configured retries.
- [ ] Run chunk-level extraction and collect each structured response with run metadata.
- [ ] Merge overlapping chunk results and remove repeat items introduced by overlap without discarding distinct actions.
- [ ] Run the consolidation pass to detect contradictions, reversed decisions, and later cancellations.
- [ ] Validate every LLM response with the shared Pydantic models; retry invalid JSON/schema output up to two times with validation feedback.
- [ ] Implement code-side quote matching; if evidence similarity is below 85%, mark Low confidence and flag `quote not found` according to the TRD.
- [ ] Verify owner names against the transcript/attendee list; flag unsupported names.
- [ ] Resolve relative dates only when the meeting date is known and the agreed date convention is configured; always keep the raw phrase.
- [ ] Reject or normalize invalid unknown values so `not_stated` fields have `null` values.
- [ ] Enforce that `we`, `the team`, `someone`, and `everyone` are not converted into an individual person's name.
- [ ] Compute confidence in application code using the agreed rules; low-confidence items start in `Needs review`.
- [ ] Add prompt-injection regression cases and assert that transcript instructions cannot modify system rules.
- [ ] Save partial results and the original submitted text on recoverable extraction failures.

### Deliverables

- End-to-end extraction pipeline from normalized transcript to validated `MeetingResult`.
- Provider adapter, versioned prompts, validation/verification functions, and mocked-provider tests.
- First 10 tuning meetings can run through the pipeline.

### Exit gate

- [ ] Invalid provider output is retried and then fails clearly if still invalid.
- [ ] Missing owners/dates remain unknown and are not guessed.
- [ ] Every emitted item includes verifiable evidence.
- [ ] Cancellation/reversal and prompt-injection cases pass.

## Phase 3 — MySQL 8.0+ persistence and FastAPI API

**Target:** 23–27 Nov 2026  
**Milestone:** M3 — Backend complete by Friday, 27 Nov 2026

### Tasks

- [x] Create MySQL 8.0+ schema for `clients`, `meetings`, `items`, `review_events`, and `runs` using PyMySQL and SQLAlchemy 2.x declarative models.
- [x] Add Alembic migration versioning (`backend/alembic/`) with `utf8mb4` collation, native `JSON` columns, and `MEDIUMTEXT` for transcripts.
- [x] Implement repository functions (`ClientRepository`, `MeetingRepository`) for creating clients, storing meetings, updating items, and retrieving meeting details.
- [x] Persist raw meeting text before extraction; store structured item payloads as JSON while keeping queryable fields needed for filtering.
- [x] Persist each extraction run's model, prompt version, token counts, latency, and validation result without transcript text in logs.
- [ ] Implement FastAPI endpoints:
  - [ ] `POST /meetings`
  - [ ] `POST /meetings/{id}/extract`
  - [ ] `GET /meetings/{id}`
  - [ ] `PATCH /items/{id}`
  - [ ] `POST /items/{id}/merge`
  - [ ] `POST /items/{id}/split`
  - [ ] `GET /meetings/{id}/duplicates`
  - [ ] `GET /clients/{id}/open-items`
  - [ ] `POST /meetings/{id}/export`
  - [ ] `GET /health`
- [ ] Keep route handlers thin and move business operations into service modules.
- [ ] Validate request and response payloads with Pydantic; use HTTP 422 for invalid payloads, 413 for oversized files, and 502 for exhausted provider failures as specified.
- [ ] Generate a request ID for each request and include it in structured logs.
- [ ] Add API tests using a mocked LLM; do not make routine tests depend on live provider availability.
- [ ] Test transaction behaviour so partial failures do not erase the meeting source or corrupt existing reviewed data.

### Deliverables

- Persisted meetings and items.
- Documented and tested API contracts available through FastAPI/OpenAPI.
- API integration tests for success and failure paths.

### Exit gate

- [ ] Every required endpoint passes request/response contract tests.
- [ ] Database writes persist after application restart.
- [ ] Provider failures retain submitted text and produce a useful error.
- [ ] No transcript text appears in application logs.

## Phase 4 — Streamlit New Meeting, Review, and Clarify screens

**Target:** 30 Nov–4 Dec 2026  
**Milestone:** M4 — Reviewable product by Friday, 4 Dec 2026

### Tasks

- [ ] Create shared API client utilities so the Streamlit UI communicates with FastAPI over HTTP.
- [ ] Implement host-level access assumptions for deployment; do not introduce application user accounts into v1.0.
- [ ] Build the New Meeting screen with client selection/addition, title, optional meeting date, attendees, paste box, file uploader, and Extract action.
- [ ] Show validation feedback and extraction progress; retain the meeting ID and show a clear recovery path if extraction fails.
- [ ] Build Review tabs for Tasks, Decisions, Risks, and Open Questions.
- [ ] Display evidence quote, speaker/line references, confidence, owner/due-date state, and review state on every applicable item.
- [ ] Display missing information with explicit text labels such as `Owner not stated`, `Date not stated`, and `Implied`; never rely on colour alone.
- [ ] Implement inline editing and track whether fields were edited by a human.
- [ ] Implement Accept, Reject, Merge, and Split actions.
- [ ] Persist each review action to `review_events`, including old value, new value, action, and timestamp; use the known reviewer identity if available from the host/context, without inventing a user account.
- [ ] Implement summary counts for tasks, tasks without owner, tasks without date, risks, and open questions.
- [ ] Implement clarification list with missing/ambiguous fields and suggested follow-up questions; allow copying questions without automatic email sending.
- [ ] Add filters specified by the PRD: owner, due date, item type, confidence, and review status.
- [ ] Add transcript evidence highlight when feasible for the P1 evidence-highlighting requirement; if deferred, record the gap explicitly.
- [ ] Ensure low-confidence items cannot be auto-accepted.
- [ ] Add accessible labels, keyboard-friendly navigation, readable contrast, and clear loading/error/empty states.

### Deliverables

- Working New Meeting → Extract → Review → Clarify journey.
- Persisted edits and review history.
- UI tests for main review interactions.

### Exit gate

- [ ] A reviewer can complete a sample meeting without developer assistance.
- [ ] All item types and key uncertainty states are visible.
- [ ] Review actions persist correctly and every item has a valid review state.

## Phase 5 — Export generation and validation

**Target:** 7–11 Dec 2026  
**Milestone:** M5 — Exports done by Friday, 11 Dec 2026

### Tasks

- [ ] Implement Excel `.xlsx` export with a `Tasks` worksheet and the required fields: Task ID, Client, Meeting, Task, Owner, Owner status, Due date, Due date as said, Priority, Status, Confidence, Evidence, Clarification needed, and Possible duplicate of.
- [ ] Add `Decisions`, `Risks`, `Open questions`, and `README` worksheets.
- [ ] Freeze the header row, enable filters, set useful column widths, and format dates as `DD-MMM-YYYY`.
- [ ] Apply missing owner/date highlighting and Low confidence styling; ensure colour is accompanied by text/state.
- [ ] Add dropdown validation for operational status and owner status where applicable.
- [ ] Implement CSV export with configurable column mapping and stable column ordering.
- [ ] Ship a generic mapping and default mappings for Jira and Asana if confirmed within scope; otherwise expose those presets as planned defaults pending confirmation and document the decision.
- [ ] Implement Word `.docx` minutes with title block, summary, numbered decisions, action-items table, risks, open questions, and reviewer/date footer.
- [ ] Implement JSON export of the complete structured result, preserving schema field states and null values.
- [ ] Build Export screen with format selection, mapping selection, preview, and download.
- [ ] Enforce that every item has a review decision before final export; reject or explain an incomplete export request.
- [ ] Ensure rejected items are excluded from accepted-task exports while the JSON/export behaviour follows the documented export choice and is clearly labelled.
- [ ] Preserve `Not stated` for applicable display/export cells and `null` in structured JSON where required; never substitute placeholder names or defaults.
- [ ] Add file integrity tests that reopen generated `.xlsx` and `.docx` and assert required sheets, columns, values, formats, and tables.
- [ ] Test CSV quoting/encoding, unusual punctuation, commas/newlines in quotes, and empty values.

### Deliverables

- Export module and UI for Excel, CSV, Word, and JSON.
- Automated tests verifying output contents and structure.

### Exit gate

- [ ] Each format is generated from saved reviewed data, not a new LLM call.
- [ ] Unknown fields remain visible as unknown and no invented value appears in any output.
- [ ] Exports open successfully in supported office tools and match the reviewed records.

## Phase 6 — Similarity, History, Settings, and browser tests

**Target:** 14–18 Dec 2026  
**Milestone:** M6 — Feature complete by Friday, 18 Dec 2026

### Tasks

- [ ] Implement task text normalization for similarity: lowercase, remove punctuation/stop words, retain names and numbers.
- [ ] Build TF-IDF vectors using word unigrams/bigrams and compute cosine similarity for new tasks against earlier tasks for the same client.
- [ ] Apply configurable initial bands: `>= 0.80` likely duplicate, `0.60–0.79` possibly related, below `0.60` ignore; tune on labelled pairs.
- [ ] Add owner/date agreement as a similarity boost only according to the documented method; document the final score calculation.
- [ ] Display candidate pairs side by side and let a reviewer keep both, merge, or discard; never automatically modify/delete a task.
- [ ] Implement History screen with per-client meetings, search, and open tasks/risks/questions.
- [ ] Implement client-level open-item query and filters.
- [ ] Implement Settings screen for approved provider/model, similarity threshold, date convention, and export column mappings.
- [ ] Ensure secrets are set through environment variables or an approved secret store; never reveal an API key in the UI or logs.
- [ ] Implement the health endpoint with application version and safe configuration status; do not expose secret values.
- [ ] Add Playwright end-to-end tests for paste → extract → review → export download and for a saved meeting reopened from History.
- [ ] Add BeautifulSoup checks for expected headings, status labels, and exported HTML where relevant; use it only for markup checks that fit the UI architecture.
- [ ] Capture screenshots/traces for failed Playwright runs in CI.

### Deliverables

- Duplicate candidate review, History, and Settings screens.
- Browser-level smoke tests for core user journeys.

### Exit gate

- [ ] New and historical tasks are compared only within the same client.
- [ ] Duplicate candidates require a human decision.
- [ ] Settings apply to the relevant service safely and persist as designed.
- [ ] Core end-to-end browser flow passes in CI.

## Phase 7 — Evaluation, security, performance, and release candidate

**Target:** 21–25 Dec 2026  
**Milestone:** M7 — Quality gate by Friday, 25 Dec 2026

### Tasks

- [ ] Complete the 30-meeting labelled dataset with two-person labelling and resolve disagreements using a documented procedure.
- [ ] Use 10 meetings for prompt/threshold tuning and keep 20 untouched for final evaluation.
- [ ] Implement evaluation scripts for task recall, task precision, owner accuracy, date accuracy, invented-value rate, quote validity, and duplicate-detection F1.
- [ ] Run final extraction evaluation and compare results to PRD targets.
- [ ] Investigate false positives, missed tasks, unsupported owner/date assignments, and invalid quotes; fix prompts or code without contaminating the held-out set.
- [ ] Add regression tests for all eight mandatory release cases listed in the PRD/TRD.
- [ ] Test prompt injection, malformed uploads, oversized files, and secret leakage.
- [ ] Verify transcript redaction behaviour if selected in the approved privacy decision.
- [ ] Verify retention policy, delete-meeting behaviour, and deletion of associated text, items, events, and generated exports under application control.
- [ ] Test LLM timeout, provider outage/rate limit, retry/backoff, partial result saving, and clear error messaging.
- [ ] Measure processing time on a 60-minute transcript; target 90 seconds or less.
- [ ] Measure Review screen load time for 200 items; target 2 seconds or less.
- [ ] Verify core unit-test coverage is at least 80% as required by the PRD.
- [ ] Build Docker image and test a clean local/container startup.
- [ ] Review security configuration, host-level access, HTTPS, backups, and operational logging for the target environment.

### Required metric targets

| Metric | v1.0 target |
|---|---:|
| Task recall | ≥ 90% |
| Task precision | ≥ 85% |
| Invented owner or due date on held-out set | 0 |
| Correct `Not stated` flagging | ≥ 95% |
| Time from paste to export | ≤ 5 minutes in UAT |
| Schema-valid LLM response after retries | ≥ 99% |
| Processing of a 60-minute transcript | ≤ 90 seconds |
| Reviewer satisfaction | ≥ 4/5 |
| Evidence quote validity | ≥ 98% |
| Core unit-test coverage | ≥ 80% |

### Deliverables

- Evaluation report with dataset split, metric calculations, and known limitations.
- Security/performance test results and release-candidate Docker image.

### Exit gate

- [ ] All P0 requirements pass.
- [ ] All eight mandatory release test cases pass.
- [ ] Held-out AI evaluation meets the agreed targets, including zero invented owners/dates.
- [ ] No open critical security/privacy bugs remain.
- [ ] Any unmet target is explicitly reported to the release approver; do not represent a failed target as passed.

## Phase 8 — User acceptance testing and fixes

**Target:** 28 Dec 2026–1 Jan 2027  
**Milestone:** M8 — UAT done by Friday, 1 Jan 2027

### Tasks

- [ ] Recruit 3–5 project/account managers or reviewers for UAT using cleared meeting material.
- [ ] Ask participants to complete a real workflow: create meeting, input transcript, extract, review evidence, resolve gaps, review duplicates, and export.
- [ ] Time the workflow to evaluate the five-minute goal.
- [ ] Collect survey results for usefulness, trust, clarity of uncertainty labels, and ease of export.
- [ ] Record UAT bugs and usability issues with severity and linked requirement IDs.
- [ ] Fix critical/high-severity issues and re-run regression tests.
- [ ] Confirm the app clearly shows when the owner/date is missing or implied and that reviewers understand those labels.
- [ ] Confirm exported Excel/CSV/Word files work in the team's actual workflow.
- [ ] Confirm README, environment setup, user guide, and troubleshooting notes are understandable to a new developer/operator.
- [ ] Obtain product-owner sign-off or record a no-go decision with the outstanding issues.

### Deliverables

- UAT findings and survey summary.
- Approved release candidate or documented blocker list.

### Exit gate

- [ ] Reviewer satisfaction is at least 4/5 or deviations are formally accepted by the release approver.
- [ ] No unresolved critical blocker remains.
- [ ] UAT sign-off is recorded.

## Phase 9 — Release and handover

**Target:** 4–8 Jan 2027  
**Milestone:** M9 — v1.0 release by Friday, 8 Jan 2027

### Tasks

- [ ] Freeze scope; allow only release blockers and approved fixes.
- [ ] Run full CI and all mandatory release tests on the release candidate.
- [ ] Run a deployment smoke test: open app, create a sample meeting, extract, review, export, and reopen History.
- [ ] Confirm production secrets are present in the host secret store and absent from source/control logs.
- [ ] Configure HTTPS and host-level access control.
- [ ] Confirm backup and restore procedure for the MySQL database and appropriate protection for transcript content.
- [ ] Confirm data-retention configuration and meeting deletion behaviour.
- [ ] Finalize `README.md`, `.env.example`, Docker instructions, user guide, troubleshooting guide, known limitations, and release notes.
- [ ] Tag release `v1.0` and publish the changelog.
- [ ] Hand over operational owner, approved LLM configuration, costs/usage monitoring, backup procedure, and support escalation path.
- [ ] Record acceptance results and archive the evaluation report.

### Deliverables

- Tagged v1.0 release, runnable deployment, user/developer documentation, and handover record.

### Exit gate

- [ ] All PRD P0 requirements pass.
- [ ] Mandatory regression tests and export checks pass.
- [ ] Release approver signs off.
- [ ] A new developer can run the app locally in 15 minutes or less, as targeted by the PRD.

## 8. Week-by-week schedule at a glance

| Week | Dates | Main focus | Milestone / exit evidence |
|---|---|---|---|
| 1 | 2–6 Nov | Repository, CI, configuration, schemas, initial sample data, decisions | M1: foundation ready |
| 2 | 9–13 Nov | Parsers, speakers, line numbering, chunking, first LLM adapter/prompt | One sample meeting reaches raw structured LLM output |
| 3 | 16–20 Nov | Merge, consolidation, schema retry, uncertainty/date/evidence checks | M2: extraction works; zero invented owners on tuning sample |
| 4 | 23–27 Nov | MySQL 8.0+, FastAPI routes, run logging, mocked-provider API tests | M3: backend complete |
| 5 | 30 Nov–4 Dec | New Meeting, Review, Clarify, edit/review controls | M4: reviewable product |
| 6 | 7–11 Dec | Excel, CSV, Word, JSON, mapping, export validation | M5: exports done |
| 7 | 14–18 Dec | TF-IDF duplicates, History, Settings, browser tests | M6: feature complete |
| 8 | 21–25 Dec | Held-out evaluation, security, performance, prompt-injection tests | M7: quality gate |
| 9 | 28 Dec–1 Jan | UAT with 3–5 users, fixes, Docker validation | M8: UAT done |
| 10 | 4–8 Jan | Release blockers, release candidate, docs, tag, handover | M9: v1.0 released |

Keep approximately 15% weekly buffer. If extraction is more than three days behind, defer P2 features first; protect uncertainty handling and AI evaluation. Confirm company holidays before relying on this calendar.

## 9. Requirement-to-implementation traceability

| Requirement group | Planned implementation | Key tests / proof |
|---|---|---|
| FR-1 Input and ingestion | `app/ingestion/`, `POST /meetings` | Supported formats; empty/large/unreadable file tests; line/speaker mapping |
| FR-2 Extraction | `app/llm/`, schemas, chunk/merge/consolidation | Mocked pipeline tests; labelled task precision/recall |
| FR-3 Uncertainty | `app/verify/`, owner/date models and Clarify UI | Missing/ambiguous owners; unknown dates; zero invented-value rate |
| FR-4 Review and edit | Review UI, item service/API, `review_events` | Edit, accept/reject, merge/split, audit persistence |
| FR-5 Export | `app/export/` and Export screen | `.xlsx`, `.csv`, `.docx`, `.json` structure and value checks |
| FR-6 Dedup/history | `app/similarity/`, MySQL repositories, History UI | Labelled duplicate-pair scores; history/open-item tests |
| FR-7 Configuration | `app/core/`, Settings, environment variables | Config tests, provider adapter tests, secret scan |
| Security/privacy NFRs | Access gate, redaction choice, retention/deletion, safe logs | Prompt injection, upload validation, log leakage, delete tests |
| Performance/reliability NFRs | Chunking, retry/backoff, partial-result persistence | 60-minute transcript and 200-item UI timing tests |
| Accessibility | Labels, keyboard use, contrast and non-colour signals | Manual accessibility spot checks and UI tests |

Every development issue and pull request should reference the exact FR/NFR identifier from the PRD when one exists. Keep the PRD as the authoritative location for full requirement wording.

## 10. Test strategy and mandatory edge cases

### Test layers

- **Unit:** parsers, chunking, date resolver, schema validation, quote matching, owner/date checks, similarity scoring, and exporters.
- **Integration:** pipeline with mocked LLM, MySQL 8.0+ persistence, review events, and FastAPI endpoints.
- **API:** request validation, response shapes, status codes, upload limits, and error behaviour.
- **Export:** reopen generated Excel/Word files and assert sheet names, headers, values, styles, and tables; check CSV rows and JSON schema.
- **UI end-to-end:** paste/upload → extract → review/edit → accept/reject → export download; history reopen.
- **AI evaluation:** 30 labelled meetings; 10 tuning, 20 untouched test set.
- **Security:** prompt injection, malformed files, oversized files, secret leakage, transcript logging, and access controls.
- **UAT:** timed sessions, survey, and real exported-file review.

### Mandatory release test cases

- [ ] A transcript with no owners creates zero invented owners.
- [ ] “We will do it soon” produces owner `Not stated` and preserves `soon` as raw date wording without inventing a calendar date.
- [ ] A relative date resolves according to the approved convention when a meeting date exists and remains unresolved without one.
- [ ] A later cancellation or reversal is reflected in the consolidated result rather than left as an active task/decision.
- [ ] Instructions embedded in a transcript cannot override extraction or security rules.
- [ ] A 100,000-character transcript is processed without dropping items at chunk boundaries.
- [ ] Excel output opens in Excel and LibreOffice with correct columns, values, and formatting.
- [ ] A malformed LLM response is recovered by retry; repeated invalid responses fail clearly and preserve input/partial results.

## 11. Release acceptance checklist

### Product workflow

- [ ] A user can paste or upload a supported transcript, extract results, review them, and export a tracker in five minutes or less during UAT.
- [ ] Every task displays owner and due-date state (`Stated`, `Implied`, or `Not stated`) and an evidence quote.
- [ ] Every item can be accepted or rejected; low-confidence items are not auto-accepted.
- [ ] Clarification gaps and possible duplicates are easy to find.
- [ ] Historical meetings and open items are available per client.

### Data integrity and AI quality

- [ ] No unsupported owner or due date appears on the held-out test set.
- [ ] Unknown values stay `null` in structured data and display as `Not stated` where appropriate.
- [ ] Evidence quotes are checked against the source text.
- [ ] Duplicates are flagged for human choice, never auto-deleted.
- [ ] Exports reflect reviewed data and preserve the documented state labels.

### Engineering and operations

- [ ] All P0 requirements pass.
- [ ] Core unit-test coverage is at least 80%.
- [ ] CI, container build, and deployment smoke test pass.
- [ ] API keys and transcript content are absent from logs and source control.
- [ ] HTTPS, access gate, retention, deletion, backup, and restore plans are verified for the deployment.
- [ ] Documentation and release handover are complete.

## 12. Risks and mitigation during implementation

| Risk | Mitigation / contingency |
|---|---|
| Model invents an owner or date | Evidence-required schema, deterministic verification, strict held-out zero-invention gate; block release if target fails |
| Provider choice or privacy approval is delayed | Keep provider behind `LLMClient`; use mocked tests while approval is pending; do not send real client text until authorized |
| Long transcripts exceed context or lose items | Overlapping chunks, speaker-turn boundaries, merge tests, and 100,000-character regression case |
| Relative dates are inconsistent | Obtain the team's convention in Week 1; preserve raw wording and resolve only when meeting date exists |
| Review workflow is too complex | Demo weekly, test with primary users, prioritize clarity of evidence and uncertainty labels |
| Export mapping is not confirmed | Provide a generic configurable mapping first; avoid direct tracker integrations in v1.0 |
| UAT or holidays reduce available time | Confirm calendar early, retain weekly buffer, defer P2 features before essential safeguards |
| Scope grows into Phase 2 integrations | Require written change approval and an impact assessment for scope, schedule, security, and tests |

## 13. Change-control rules

- The PRD is the source of truth for product scope and acceptance criteria.
- The TRD is the source of truth for architecture and technical contracts, subject to explicitly marked unresolved decisions.
- The AppFlow defines user journeys and screen-level behaviour.
- `RULES.md` defines coding and non-negotiable implementation rules.
- Any proposed change must describe why it is needed, affected requirement IDs, impact on schedule and dependencies, security/privacy implications, and tests to update.
- Do not add Phase 2/3 features merely because they are easy to implement.
- If a metric or release gate cannot be met, report the measured result and ask the release approver to make a documented go/no-go decision; do not mark it as passed.

## 14. Definition of Done for each implementation task

- [ ] Code is merged to `main` through a reviewed pull request.
- [ ] Unit/integration/UI tests relevant to the task are added and passing.
- [ ] Relevant PRD requirement and acceptance criterion are verified.
- [ ] Core test coverage is not lowered below the project target.
- [ ] Documentation and configuration examples are updated when behaviour changes.
- [ ] No secrets are committed and no transcript text is written to logs.
- [ ] Errors are actionable and data is not silently lost.
- [ ] Unknown values remain unknown; no default owner/date is added.

## 15. Final implementation order

For day-to-day execution, take tasks in this order:

1. Foundation, decisions, and schemas.
2. Ingestion and normalized transcript representation.
3. LLM adapter, prompt versioning, extraction, merge, and consolidation.
4. Pydantic validation and deterministic evidence/owner/date checks.
5. MySQL 8.0+ persistence and API contracts.
6. New Meeting, Review, and Clarify UI.
7. Excel, CSV, Word, and JSON exports.
8. Duplicate detection, History, and Settings.
9. Evaluation, security, performance, and failure-path regression tests.
10. UAT, release hardening, deployment, and handover.

**Release target:** v1.0 on **Friday, 8 January 2027**, subject to the acceptance gates above.
