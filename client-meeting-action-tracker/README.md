# Client Meeting-to-Action Tracker — React.js Frontend

A modern, minimalist SaaS web application for extracting, reviewing, and exporting action items from client meeting transcripts.

Built with **React.js + Vite**, featuring a **ReactBits-inspired** marketing landing page and a clean, high-performance dashboard application. Ready for integration with a **FastAPI + SQLite** backend.

---

## Quick start

```bash
# 1. Move into the project directory
cd client-meeting-action-tracker

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

No backend or external API key is required — the application operates seamlessly with realistic mock data and browser `localStorage` persistence.

---

## Route Architecture

| Route | Page | Purpose |
|---|---|---|
| `/` | **Marketing Landing Page** | Public website with ReactBits-inspired dark charcoal hero, animated text reveals, interactive product preview, feature cards with cursor spotlight, 3-step workflow, benefits, functional FAQ accordion, and dual CTAs. |
| `/app/dashboard` | **Dashboard** | Overview of processed meetings, action item counts, attention-required alerts, and recent meetings table. |
| `/app/new-meeting` | **New Meeting** | Meeting submission form with client selector (+ Add Client modal), transcript text area, file drop zone (.txt, .docx, .pdf, .vtt, .srt with 10 MB limit), and animated extraction simulation. |
| `/app/review/:meetingId` | **Review Items** | Split-screen interface: left panel features line-numbered transcript with verbatim evidence highlighting; right panel features Tasks, Decisions, Risks, and Open Questions tabs with working Accept, Reject, Edit, Merge, and Split actions. |
| `/app/clarification` | **Clarification Queue** | Surfaces items with missing owners or deadlines, displaying transcript quotes and copyable follow-up questions for stakeholders with one-click clipboard action. |
| `/app/duplicates` | **Duplicate Detection** | Side-by-side comparison of candidate duplicate tasks across meetings with similarity scores and working Keep Both, Merge, and Discard actions. |
| `/app/history` | **Meeting History** | Searchable, filterable, and sortable table of meetings with quick Inspection modal and direct links to details and review. |
| `/app/history/:meetingId` | **Meeting Details** | Dedicated meeting inspection page with attendee badges, summary counters, extracted items table, and searchable full transcript viewer. |
| `/app/export` | **Export** | Generates real downloadable files from reviewed items: Excel (`.xlsx`), Word Meeting Minutes (`.docx`), CSV (`.csv`), and structured JSON (`.json`). |
| `/app/settings` | **Settings & Preferences** | Configurable controls for theme/appearance, duplicate detection threshold, date interpretation rules, export column mapping, data retention, and privacy redaction. |
| `/app/profile` | **User Profile** | Editable profile management for name, email, job title, company, and avatar with form validation, toast notifications, and `localStorage` persistence. |
| `*` | **Custom 404** | Accessible error page with "Return Home" and "Go to Dashboard" navigation actions. |

---

## Project Structure

```
client-meeting-action-tracker/
├── public/
├── src/
│   ├── components/
│   │   ├── common/          # Button, Input, Select, Textarea, Modal, Dropdown,
│   │   │                    # Tabs, Badges, States, EvidencePanel, ToastNotification
│   │   ├── landing/         # InteractivePreview, FeatureCard, Accordion, DecryptedText
│   │   └── layout/          # AppLayout, Sidebar, Topbar
│   ├── data/
│   │   └── mockData.js      # Baseline mock meetings, clients, and extracted items
│   ├── pages/
│   │   ├── LandingPage.jsx  # ReactBits-inspired marketing page
│   │   ├── Dashboard.jsx    # SaaS overview dashboard
│   │   ├── NewMeeting.jsx   # Meeting transcript ingestion & extraction
│   │   ├── ReviewItems.jsx  # Split-screen evidence review & action hub
│   │   ├── Clarification.jsx# Missing owner & deadline question generator
│   │   ├── Duplicates.jsx   # Candidate duplicate task review
│   │   ├── MeetingHistory.jsx # Sortable, filterable meetings archive
│   │   ├── MeetingDetails.jsx # Dedicated meeting inspection view
│   │   ├── ExportPage.jsx   # Multi-format local file exporter
│   │   ├── Settings.jsx     # System preferences and extraction thresholds
│   │   ├── Profile.jsx      # User profile management
│   │   └── NotFound.jsx     # Custom 404 error page
│   ├── services/
│   │   └── api.js           # Centralized API service layer with localStorage persistence
│   ├── styles/
│   │   ├── variables.css    # Design tokens & color system
│   │   ├── globals.css      # CSS resets & typography
│   │   ├── components.css   # Reusable component classes
│   │   ├── landing.css      # Dark charcoal aesthetic & ReactBits effects
│   │   └── mobile.css       # Responsive drawer & mobile overrides
│   ├── utils/
│   │   └── userProfile.js   # User profile storage & update event dispatcher
│   ├── App.jsx              # React Router configuration & Suspense code splitting
│   └── main.jsx
├── .env.example
├── package.json
└── README.md
```

---

## Strict AI Uncertainty & Extraction Rules

The frontend strictly enforces the core project rules:
1. **Never Invent Facts**: When an owner or deadline is not stated in the source text, it is explicitly rendered as **"Not stated"** and represented as `null`.
2. **Preserve Vague Phrasing**: Raw date statements like *"by end of week"* or *"soon"* are preserved in `rawDateWording` without guessing specific dates.
3. **Evidence-Backed**: Every extracted task, decision, risk, and question links directly to a verbatim transcript quote with line numbers and speaker attributions.
4. **Low-Confidence Safeguards**: Low-confidence items cannot be auto-accepted and remain in the *Needs Review* state until manually checked.
5. **No Automatic Duplicate Removal**: Candidate duplicates are flagged for human decision (`Keep Both`, `Merge`, or `Discard`).

---

## FastAPI Backend Integration

When the Python FastAPI backend is started:
1. Update `.env`:
   ```bash
   VITE_API_BASE_URL=http://localhost:8000
   VITE_USE_MOCK_DATA=false
   ```
2. The application will route all API requests from `src/services/api.js` to the FastAPI REST endpoints.
