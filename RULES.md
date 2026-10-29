# Project Rules: Client Meeting-to-Action Tracker

**Document version:** 0.1  
**Draft date:** 28 Oct 2026  
**Applies to:** All code, prompts, tests, UI flows, exports, and project documentation  
**Source of truth:** `PRD-Client-Meeting-to-Action-Tracker.md`, implemented through `TRD-Client-Meeting-to-Action-Tracker.md` and `AppFlow-Client-Meeting-to-Action-Tracker.md`  
**Target release:** v1.0 — 8 Jan 2027

---

## 1. Purpose and precedence

This file defines the engineering rules that every developer and coding assistant must follow when building or modifying the Client Meeting-to-Action Tracker.

When documents or implementation choices conflict, use this order:

1. The PRD defines product scope, requirements, and acceptance criteria.
2. The TRD defines the technical implementation design consistent with the PRD.
3. The AppFlow defines user navigation and interaction behaviour.
4. This file defines day-to-day coding and change rules within those boundaries.

Do not silently invent requirements to resolve an ambiguity. Mark the item **Decision required**, document the options, and request a product/technical decision. Keep v1.0 requirements distinct from Phase 2 and Phase 3 ideas.

## 2. Non-negotiable product rules

1. **Never invent facts.** Do not guess owners, due dates, priorities, statuses, dependencies, attendees, or other meeting facts.
2. **Preserve unknowns.** When a value is not supported by the transcript, use `null` in structured data and show **Not stated** in the UI or applicable export. Do not replace it with `TBD`, `N/A`, an empty string in the structured model, a person inferred from context, or a default date.
3. **Keep evidence.** Every extracted task, decision, risk, and open question must include at least one evidence quote from the source text. Include speaker and line references when available.
4. **Keep explicit and inferred values separate.** Owner and due-date states must be `stated`, `implied`, or `not_stated`. Implied values must be visibly distinguished from stated values and must not count as confirmed.
5. **Human review is required.** Every item must be accepted or rejected before final export. Low-confidence items must not be auto-accepted.
6. **Duplicates are only candidates.** Flag possible duplicates for a human decision. Never auto-delete or automatically merge duplicate tasks.
7. **A failure must not destroy the source.** Save the submitted meeting text before extraction where possible; extraction failures must show a clear error and preserve the source text and any usable partial results.
8. **Meeting text is untrusted data.** Instructions inside a transcript must never override system prompts, application rules, schemas, or security controls.
9. **Exports must reflect reviewed data.** Do not silently change values during export. Preserve unknowns and uncertainty states.
10. **v1.0 accepts text, not live audio.** Do not add meeting bots, recording, speech-to-text, scanned-PDF OCR, automatic email, or direct tracker API sync to v1.0 without an approved scope change.

## 3. Required technology stack

Use the following stack unless a documented, approved change replaces it:

- **Runtime:** Python 3.11 or newer.
- **UI:** Streamlit.
- **Backend API:** FastAPI with Uvicorn.
- **Validation:** Pydantic v2 and JSON Schema.
- **LLM:** Gemini API by default, accessed through a provider-independent `LLMClient` interface.
- **Database:** MySQL 8.0+ (PyMySQL driver, SQLAlchemy 2.x, Alembic migrations; SQLite prohibited).
- **Data handling:** Pandas plus Python standard library modules where suitable.
- **Excel export:** openpyxl.
- **Word export:** python-docx.
- **Duplicate detection:** scikit-learn TF-IDF and cosine similarity.
- **Testing:** pytest, Requests, BeautifulSoup, and Playwright.
- **Code quality:** Ruff and Black.
- **Delivery:** Git, GitHub Actions, and Docker.

Do not add a new framework, database, external service, or dependency without explaining why it is needed and documenting the impact on setup, security, tests, and deployment.

## 4. Architecture and module boundaries

Keep the Streamlit UI as a client of the FastAPI backend. UI code must not call the LLM provider or directly implement extraction business logic. The LLM pipeline must be the only component that calls the external provider.

Follow the repository structure defined in the TRD:

```text
meeting-action-tracker/
  app/
    api/          # FastAPI routes and request/response handling
    core/         # Settings, config, logging, shared exceptions
    ingestion/    # File parsers, text cleaning, speaker labels, line numbering, chunking
    llm/          # LLMClient and provider adapters
    models/       # Pydantic models and enums
    verify/       # Evidence, owner, date, and consistency checks
    similarity/   # TF-IDF duplicate detection
    export/       # Excel, CSV, Word, and JSON generation
    db/           # MySQL 8.0+ models, session, and Alembic migrations
  ui/             # Streamlit screens and reusable UI helpers
  prompts/        # Versioned prompt text files
  eval/           # Labelled meetings and AI evaluation scripts
  tests/          # Unit, integration, and end-to-end tests
  .github/workflows/
  README.md
  .env.example
  Dockerfile
```

Rules:

- Keep HTTP route handlers thin. Put business logic in the relevant application/service modules.
- Keep LLM provider-specific code behind the provider interface; do not couple other modules to Gemini response details.
- Keep schemas and enums in shared model modules so the API, pipeline, and tests use the same definitions.
- Keep file parsing, extraction, verification, deduplication, persistence, and export as separate responsibilities.
- Avoid circular imports and duplicated business rules.
- Do not introduce an alternate frontend or repository layout without approval.

## 5. Python code style

1. Use type hints for public functions, class attributes, API payloads, and returned values.
2. Add docstrings to public functions and classes where behaviour is not self-evident.
3. Use clear names that express the domain concept: `meeting_id`, `review_status`, `resolved_date`, `evidence_quote`.
4. Prefer small functions with a single purpose and explicit inputs/outputs.
5. Use Pydantic models for external input, API request/response payloads, and LLM structured output. Do not trust unvalidated dictionaries from external systems.
6. Use Python `logging` with structured contextual fields instead of `print()` for application logs.
7. Format with Black and lint with Ruff. Tests and CI must pass before merge.
8. Do not swallow exceptions silently. Convert expected errors to clear user/API errors and log safe diagnostics.
9. Avoid mutable default values in models or function arguments. Use Pydantic `default_factory` or a safe equivalent for lists and dictionaries.
10. Do not add secrets, customer transcripts, real client data, or generated export files to source control.

## 6. Domain model and validation rules

Use the agreed model concepts and values from the TRD. Keep names consistent across the UI, database, API, and exports.

### 6.1 Owner and due-date state

Allowed state values:

- `stated` — explicitly supported by the transcript.
- `implied` — strongly suggested but not explicitly stated.
- `not_stated` — no evidence supports a value.

Rules:

- If `state == not_stated`, the corresponding structured value must be `null`.
- Do not use an empty string, `TBD`, `N/A`, or a guessed value to represent an unknown in structured data.
- An implied owner or date must include a note explaining the uncertainty when appropriate, and must be visually distinct in the UI.
- The words “we”, “the team”, “someone”, and “everyone” must not be converted into an individual person.
- If multiple people could own an action, leave the owner unconfirmed and explain the ambiguity rather than selecting one.
- Every owner and due-date value must be traceable to supporting evidence; unsupported values are reset to `not_stated` / `null` by validation.

### 6.2 Evidence

- Preserve the exact source quote; do not rewrite a quote to make it sound clearer.
- Store speaker and source line range when available.
- Check the quote against the original transcript using the verification module.
- If the quote match score is below 85%, mark the item Low confidence and add a `quote not found` warning.
- Never accept a quote generated by the LLM as proof until it has been checked against the source text.

### 6.3 Confidence and review

- Allowed confidence values are `high`, `medium`, and `low`.
- Low-confidence items start in **Needs review** and cannot be included in bulk auto-accept actions.
- The application must preserve whether a person changed a field, and review actions must be auditable.
- Keep extraction confidence separate from review status. A human accepting an item must not silently rewrite its confidence score.

### 6.4 Priority, status, and dependencies

- Extract priority and dependencies only when stated in the transcript.
- Do not let the LLM invent a task status. Review status is application workflow data, not a meeting fact.
- After an item is accepted, the default tracker status may be `Open` as specified by the PRD export design; do not represent that default as a statement made in the meeting.
- Supported tracker status values are `Open`, `In progress`, `Blocked`, and `Done`.

### 6.5 Required item types

The v1.0 review flow must support:

- Tasks
- Decisions
- Risks
- Open questions

Do not add new item types to the v1.0 schema without an approved scope change. Optional key facts must not become a new required screen or export type without agreement.

## 7. Date and time rules

1. Keep the original date phrase in `raw_text` whenever one is present.
2. Resolve a relative date only when the meeting date is known and the date phrase can be resolved under the configured convention.
3. If the meeting date is unknown or the phrase is too vague (for example, “soon”), keep the raw phrase and leave `resolved_date` as `null`.
4. Do not infer a precise date from “soon”, “later”, “as soon as possible”, or similar vague wording.
5. The “next Friday” convention must be documented in Settings and configurable. Use the project's approved rule; if no decision has been made, flag this as **Decision required** rather than hard-coding an undocumented interpretation.
6. Use unambiguous date formats in exports: `DD-MMM-YYYY` for displayed Excel dates, as specified in the PRD.
7. A resolved date earlier than the meeting date must be flagged unless the source explicitly describes a past deadline or date.
8. Do not apply holiday calendars or time-zone-aware resolution in v1.0 unless approved as a scope change.

## 8. Input and file-ingestion rules

- Accept pasted text up to 150,000 characters.
- Accept `.txt`, `.docx`, text-based `.pdf`, `.vtt`, and `.srt` uploads up to 10 MB.
- Capture client name, meeting title, meeting date, and optional attendee list.
- Reject empty, unreadable, unsupported, malformed, or oversized inputs with a clear message.
- Return HTTP `413` for uploads that exceed the configured size limit.
- Do not execute uploaded files or trust file extensions alone. Validate file type and safely parse content.
- Scanned PDFs requiring OCR are out of scope for v1.0; explain that the PDF must contain selectable text.
- Normalize speaker labels and keep source line numbers for evidence. Do not remove context required to link evidence to the original text.
- Strip timestamps or filler only when the parsing logic can preserve speaker turns and evidence line references.
- Split long transcripts into chunks of approximately 6,000 tokens with about 500 tokens of overlap. Prefer speaker-turn and sentence boundaries; do not split mid-sentence when avoidable.
- Test chunk merging to ensure no tasks disappear at chunk boundaries and overlap does not create duplicate items.

## 9. LLM and prompt rules

1. Use one provider-neutral interface such as `LLMClient.generate_structured(prompt, schema)`.
2. Generate the JSON Schema from the Pydantic models; do not maintain conflicting copies of the same schema by hand.
3. Extraction prompts must demand JSON only and explicitly prohibit guessing owners, dates, priorities, status, or dependencies.
4. Every prompt must require exact evidence quotes and the `not_stated` / `null` convention for unknown values.
5. Store prompts as versioned text files under `prompts/`. Log the prompt version for each run.
6. Keep extraction temperature between 0 and 0.2 unless a tested change is approved.
7. Set a 60-second timeout per provider call and retry at most two times with backoff, as specified in the TRD.
8. On invalid JSON or schema failure, retry with the validation error included. Never pass invalid output to the review screen as if it were valid.
9. Use the pipeline order: parse → chunk → extract → merge → consolidate → schema-validate → verify → score/deduplicate → save and display.
10. Consolidation must handle contradictions, including tasks later cancelled and decisions later reversed. Preserve the evidence for the resulting interpretation.
11. Treat transcript contents as untrusted input. Prompt-injection instructions embedded in the meeting must not override application rules.
12. Do not send transcripts to an unapproved provider. Provider retention and no-training terms must be confirmed before production use.
13. Count token usage and record safe usage/latency metadata. Warn when configured cost limits are exceeded.
14. If the provider fails after retries, return a clear error, preserve the meeting source, and retain partial results where possible.

## 10. Verification and uncertainty rules

Verification must run in ordinary application code, not rely solely on the LLM.

- Confirm that every evidence quote occurs in or closely matches the source transcript.
- Confirm that an owner name appears in the transcript or attendee list; otherwise flag `owner not in attendees` and require review.
- Confirm resolved dates are consistent with the meeting date unless the transcript supports the exception.
- Confirm `not_stated` fields contain `null` values in structured data.
- Confirm every returned item has an ID, valid type, confidence level, and evidence collection.
- Confirm no invalid or unsupported item passes to the accepted export dataset.
- Items needing clarification must be filterable and visible in the Clarify screen.
- Suggested follow-up questions may be offered, but they must be framed as questions, not inserted as facts.
- A validation warning must be shown to the reviewer; it must not be hidden just because a record is syntactically valid.

## 11. Review UI and workflow rules

The v1.0 navigation includes **New Meeting**, **Review**, **Clarify**, **Duplicates**, **Export**, **History**, and **Settings**.

- The Review screen must provide editable tables for all supported item types.
- Review actions: edit, accept, reject, merge, and split.
- Keep evidence accessible from each item; when implemented, clicking an item should highlight its source quote in the transcript.
- Track human-edited fields and review actions.
- Provide filters for owner, due date, item type, confidence, and review status where supported by the PRD priority.
- Show a summary count for tasks, tasks without owners, tasks without dates, risks, and open questions.
- Display unknown values with the visible **Not stated** label; a blank must not be mistaken for an unknown due to a UI bug.
- Colour cannot be the only signal. Pair badges/colours with readable text or icons and maintain keyboard-accessible controls and readable contrast.
- The reviewer must make an accept/reject decision for each item before export. The “Accept all non-low confidence” option must leave low-confidence items for explicit review.
- Keep source content intact when a reviewer edits an extracted item.

## 12. Duplicate-detection rules

- Compare tasks only against earlier tasks for the same client.
- For v1.0, use scikit-learn TF-IDF with word 1–2 grams and cosine similarity.
- Initial interpretation: score `>= 0.80` = **Likely duplicate**; `0.60–0.79` = **Possibly related**; below `0.60` = do not flag. Thresholds must remain configurable and be tuned against labelled data.
- Owner and due-date agreement may increase the similarity score only through a documented, tested scoring method.
- Show candidate tasks side by side with their similarity score and relevant task details.
- The reviewer chooses to keep both, merge, or discard a candidate.
- Never automatically delete a task or assume a match is correct.
- Do not add embedding-based matching in v1.0; that is Phase 2.

## 13. Database and persistence rules

Use MySQL 8.0+ (with PyMySQL and SQLAlchemy 2.x) and preserve the following logical tables from the PRD:

- `clients`
- `meetings`
- `items`
- `review_events`
- `runs`

Persistence rules:

- Store the source meeting text and meeting metadata so extraction can be retried without asking the user to upload the content again.
- Store item payloads as schema-valid JSON and keep review status as an explicit field.
- Record review actions with item ID, action, old value, new value, and timestamp; record reviewer identity only as supported by the v1.0 access model.
- Log model name, prompt version, token counts, latency, and validation outcome in the run record.
- Do not store transcript contents in application logs.
- Use parameterized database operations. Do not construct SQL by concatenating user-provided values.
- Apply schema changes through a documented migration or initialization approach; do not silently break existing local data.
- Support the configured retention period, defaulting to 90 days. Deleting a meeting must also remove its text, items, and related stored exports as described in the PRD.
- MySQL 8.0+ is the primary database. Use Alembic for migrations, utf8mb4 collation, and connection pooling. Do not use SQLite anywhere in runtime code, configuration, migrations, or tests.

## 14. API rules

The FastAPI backend is the source of application operations. Maintain the endpoint contracts in the TRD:

| Method | Path | Rule |
|---|---|---|
| `POST` | `/meetings` | Validate metadata and text/file input; create and persist meeting; return meeting ID. |
| `POST` | `/meetings/{id}/extract` | Run extraction and return validated structured result and run ID. |
| `GET` | `/meetings/{id}` | Return meeting metadata, items, and review states. |
| `PATCH` | `/items/{id}` | Validate edited fields and review status; record human edits. |
| `POST` | `/items/{id}/merge` | Merge selected items through an explicit reviewer action. |
| `POST` | `/items/{id}/split` | Split an item according to a validated split specification. |
| `GET` | `/meetings/{id}/duplicates` | Return possible duplicate pairs and similarity scores. |
| `GET` | `/clients/{id}/open-items` | Return open tasks, risks, and questions with supported filters. |
| `POST` | `/meetings/{id}/export` | Generate only a supported export format after review decisions are complete. |
| `GET` | `/health` | Return a safe service liveness/status response. |

Additional API requirements:

- Validate request and response data with Pydantic.
- Return HTTP `422` for invalid request data, `413` for oversized files, and `502` for upstream LLM-provider failure where applicable.
- Include a request ID in every log line and propagate it through relevant processing steps.
- Return useful, non-sensitive error messages. Never return API keys, raw stack traces, secrets, or transcript contents in an error response.
- Keep API response shapes documented and test them. Do not make breaking contract changes without updating the TRD, tests, and UI.

## 15. Export rules

Supported v1.0 formats are `.xlsx`, `.csv`, `.docx`, and `.json`.

- Export data from the reviewed and persisted records, not directly from unvalidated LLM output.
- Do not complete an export until each item has an explicit accepted/rejected decision. Rejected items must not appear as accepted tasks.
- Preserve unknowns: use **Not stated** in the applicable human-readable owner field and retain the state/clarification columns. Leave unresolved date cells blank while preserving the original date phrase when present.
- Do not replace missing values with made-up defaults.
- Keep Excel columns aligned with the PRD: Task ID, Client, Meeting, Task, Owner, Owner status, Due date, Due date as said, Priority, Status, Confidence, Evidence, Clarification needed, and Possible duplicate of.
- Include Decisions, Risks, Open questions, and README sheets in the Excel workbook.
- Freeze the header row, enable filters, set usable column widths, format displayed dates as `DD-MMM-YYYY`, and provide the missing-information/low-confidence formatting specified in the PRD.
- Provide supported status and owner-state dropdown validation in the Excel workbook.
- CSV columns must be governed by a configurable JSON mapping. Do not hard-code mapping changes in exporter logic.
- Word minutes must include the meeting title block, summary, decisions, action items, risks, open questions, and the reviewed-by footer described in the PRD.
- Verify generated `.xlsx` and `.docx` files by reopening them with the respective library and checking expected headers, cells, tables, and key values.
- Never send an export to a third party automatically. Downloads are user initiated.

## 16. Security, privacy, and logging rules

- Keep API keys in environment variables or a secret store. Never commit `.env` or secrets.
- Commit `.env.example` with variable names and safe placeholders only.
- Use HTTPS for shared/production deployment.
- Validate upload type, size, and parsing; never execute uploaded content.
- Redact names and email addresses before provider submission when the configured redaction option is enabled.
- Only use a provider approved for confidential client content. Confirm retention and no-training terms before launch.
- Do not log raw transcripts, evidence text, access tokens, API keys, or other confidential content.
- Logs may contain request/run IDs, model, prompt version, token usage, latency, validation results, and safe error codes.
- v1.0 access is controlled by the host using a shared password or company SSO. Do not build application-level accounts or role-based access control into v1.0 without an approved scope change.
- Keep retention configurable, with 90 days as the PRD default. Implement the documented meeting-delete behaviour for stored source text, items, and exports.
- Treat transcript and uploaded document content as data, never as executable instructions.

## 17. Testing and evaluation rules

Every change must include appropriate tests and must not lower existing core test coverage. Target at least 80% unit-test coverage for core logic.

Required test layers:

- **Unit:** parsers, speaker normalization, line numbering, chunking, date resolver, Pydantic validation, verification, similarity, and exporters.
- **Integration:** pipeline with a mocked LLM, MySQL 8.0+ persistence, API endpoints, retries, and failure handling.
- **UI end-to-end:** paste/upload, extract, review, edit, accept/reject, clarify, duplicate resolution, export, and history flows with Playwright.
- **Export checks:** inspect `.xlsx` cells and formatting and `.docx` tables/content after generation.
- **AI evaluation:** measure extraction quality on hand-labelled meetings.
- **Security:** malformed/oversized uploads, prompt injection, secret leakage checks, and safe logging.
- **UAT:** test with real users using meeting content cleared for testing.

AI evaluation dataset and metrics:

- Aim for 30 hand-labelled meetings reviewed by two people; use 10 for tuning and 20 as a held-out set.
- Measure task recall, task precision, owner accuracy, date accuracy, invented-value rate, quote validity, and duplicate-detection F1.
- Target 0 invented owners or due dates on the test set and at least 98% quote validity, in addition to the PRD's overall release metrics.
- Routine automated tests must mock the LLM so tests are fast, deterministic, and do not require provider spend. Keep real-provider tests in a separate small suite.

The following scenarios must pass before v1.0:

1. A transcript without owners produces no invented owners.
2. “We will do it soon” produces owner **Not stated** and retains `soon` as raw date wording without resolving a date.
3. A relative date resolves only when the meeting date is known.
4. A task cancelled later in the meeting is not left open.
5. Prompt-injection text inside a transcript has no effect on application rules.
6. A 100,000-character transcript is processed without dropping items at chunk boundaries.
7. An Excel export opens and has correct columns and formatting.
8. One invalid JSON result is retried; repeated failure ends with a clear error and preserves the source meeting.

## 18. Git, pull requests, and CI

- Keep `main` releasable.
- Use feature branches named `feature/<id>-<short-name>` and fix branches named `fix/<id>-<short-name>`.
- Make small commits with clear messages, for example `feat(extract): validate evidence quotes`.
- Every change must go through a pull request with at least one reviewer.
- Link each pull request to a PRD requirement ID (`FR-x.y`) or a documented defect/task.
- Include test evidence and note any schema, API, prompt, database, or export format changes in the pull request.
- CI must run Ruff, Black checks, pytest with mocked LLM responses, and the agreed Playwright smoke test.
- Block merging when required checks fail.
- Keep `.env` in `.gitignore`; enable secret scanning.
- Release tags follow the project sequence (`v0.1`, `v0.2`, …, `v1.0`) and each release includes a short changelog.

## 19. Definition of Done

A task is complete only when all applicable items below are true:

- [ ] The change meets a documented requirement or approved decision.
- [ ] Types, schemas, and API contracts are updated where needed.
- [ ] Tests are added or updated and pass locally and in CI.
- [ ] Relevant formatting and lint checks pass.
- [ ] Unknown values, evidence, uncertainty states, and review behaviour remain correct.
- [ ] No secrets or transcript text appear in logs or source control.
- [ ] Documentation is updated when setup, behaviour, configuration, API, schema, or export format changes.
- [ ] The change is reviewed and merged through a pull request.

## 20. Change-control rules

- If a requirement is ambiguous, label it **Decision required** and record the chosen decision in the relevant project document before relying on it.
- Changes to v1.0 scope, the structured schema, API contracts, uncertainty rules, export columns, data retention, or provider privacy terms require explicit review.
- Implement Phase 2 and Phase 3 features only after they are scheduled and approved.
- Update the PRD, TRD, AppFlow, tests, and this rules file when a change affects more than one of them.
- Keep requirement-to-test traceability current.

---

## Quick reminder for coding assistants

Before coding, inspect the existing repository and follow its current structure. Read this file, the relevant PRD requirement, and the corresponding TRD/AppFlow section. Make the smallest complete change, preserve all uncertainty and evidence rules, add tests, and report exactly what changed and what remains unresolved. Do not claim tests passed unless they were actually run.
