// =============================================================
// Mock Data — Client Meeting-to-Action Tracker
// =============================================================
// This file is the single source of truth for all demo data.
// Replace API calls with real FastAPI endpoints in production.
// Never invent owners or deadlines — unknowns remain null / "Not stated".

export const MOCK_CLIENTS = [
  { id: 'c1', name: 'Acme Corporation', contact: 'Sarah Chen', email: 'sarah@acme.com' },
  { id: 'c2', name: 'Globex Industries', contact: 'Mark Williams', email: 'm.williams@globex.com' },
  { id: 'c3', name: 'Initech Solutions', contact: 'Priya Patel', email: 'p.patel@initech.io' },
  { id: 'c4', name: 'Umbrella Corp', contact: 'James Novak', email: 'jnovak@umbrellacorp.net' },
  { id: 'c5', name: 'Stark Dynamics', contact: 'Emily Starks', email: 'e.starks@starkdynamics.com' },
];

export const MOCK_TRANSCRIPT_1 = `[00:00:12] Sarah Chen (Acme): Good morning everyone. Let's get started with the Q4 product review.
[00:00:20] Tom Hargreaves (PM): Thanks Sarah. Quick note — we need to finalize the data migration plan before end of month.
[00:00:35] Sarah Chen (Acme): Agreed. Tom, can you take ownership of that?
[00:00:41] Tom Hargreaves (PM): Sure, I'll handle the migration plan and have it ready by November 15th.
[00:01:02] Sarah Chen (Acme): Great. Also, we discussed the API rate-limit issue last week — has that been resolved?
[00:01:15] Dev Lead (Acme): Not yet. We're waiting on the vendor response. It's a risk to the launch timeline.
[00:01:28] Tom Hargreaves (PM): We should flag that as a risk. Emily, can you follow up with the vendor this week?
[00:01:40] Emily Starks (Dev): I'll reach out to them soon.
[00:01:52] Sarah Chen (Acme): Good. One more thing — who is going to draft the user acceptance testing plan?
[00:02:05] Tom Hargreaves (PM): That hasn't been assigned yet. We need someone to own it.
[00:02:18] Sarah Chen (Acme): Let's revisit that in the next meeting. For now, let's keep it open.
[00:02:30] Dev Lead (Acme): We also agreed to remove the legacy reporting module from scope for v1.0.
[00:02:45] Sarah Chen (Acme): Confirmed. Legacy reporting is out of v1.0 scope. That's a decision we're all aligned on.
[00:03:00] Tom Hargreaves (PM): Perfect. Let's wrap up. Tom to complete migration plan by Nov 15, Emily to follow up with vendor, UAT plan still needs an owner.
[00:03:18] Sarah Chen (Acme): Sounds good. Thanks everyone.`;

export const MOCK_TRANSCRIPT_2 = `[00:00:08] Mark Williams (Globex): Thanks for joining. Agenda today is the CRM integration status and security audit findings.
[00:00:22] Dev Team Lead: We've completed the initial CRM data mapping. Next step is the field validation layer.
[00:00:35] Mark Williams (Globex): When can we expect that to be done?
[00:00:42] Dev Team Lead: We should have it ready by end of next week.
[00:00:55] Mark Williams (Globex): Let's call that November 22nd as the deadline. Who is taking point on this?
[00:01:08] Dev Team Lead: I'll assign it to Raj. He has the most context on the field schema.
[00:01:22] Mark Williams (Globex): Good. Now, the security audit flagged three medium-severity issues. The team needs to address those.
[00:01:38] Compliance Officer: We have a regulatory deadline. Those must be resolved before we go live.
[00:01:52] Mark Williams (Globex): Noted. That's a compliance risk. Who owns the security remediation?
[00:02:05] Dev Team Lead: I'll coordinate with the security team. No specific person assigned yet.
[00:02:18] Mark Williams (Globex): Can we clarify the exact regulatory deadline? What date are we working to?
[00:02:30] Compliance Officer: We're still confirming the exact date with legal. I should have an answer by end of week.
[00:02:45] Mark Williams (Globex): OK, let's track that as an open question. Raj to own field validation by Nov 22. Security remediation to be coordinated — owner TBD. Regulatory deadline open.`;

export const MOCK_MEETINGS = [
  {
    id: 'm1',
    clientId: 'c1',
    clientName: 'Acme Corporation',
    title: 'Q4 Product Review',
    date: '2026-10-15',
    attendees: ['Sarah Chen', 'Tom Hargreaves', 'Emily Starks', 'Dev Lead'],
    transcript: MOCK_TRANSCRIPT_1,
    taskCount: 4,
    outstandingItems: 2,
    lastUpdated: '2026-10-15T14:30:00Z',
    status: 'reviewed',
  },
  {
    id: 'm2',
    clientId: 'c2',
    clientName: 'Globex Industries',
    title: 'CRM Integration Status',
    date: '2026-10-18',
    attendees: ['Mark Williams', 'Dev Team Lead', 'Compliance Officer', 'Raj Kapoor'],
    transcript: MOCK_TRANSCRIPT_2,
    taskCount: 5,
    outstandingItems: 3,
    lastUpdated: '2026-10-18T11:15:00Z',
    status: 'needs_review',
  },
  {
    id: 'm3',
    clientId: 'c3',
    clientName: 'Initech Solutions',
    title: 'Sprint 12 Planning',
    date: '2026-10-20',
    attendees: ['Priya Patel', 'Dev Team', 'QA Lead'],
    transcript: '',
    taskCount: 7,
    outstandingItems: 1,
    lastUpdated: '2026-10-20T16:00:00Z',
    status: 'exported',
  },
  {
    id: 'm4',
    clientId: 'c4',
    clientName: 'Umbrella Corp',
    title: 'Security & Compliance Review',
    date: '2026-10-22',
    attendees: ['James Novak', 'Security Team', 'Legal Counsel'],
    transcript: '',
    taskCount: 3,
    outstandingItems: 3,
    lastUpdated: '2026-10-22T09:45:00Z',
    status: 'needs_review',
  },
  {
    id: 'm5',
    clientId: 'c5',
    clientName: 'Stark Dynamics',
    title: 'Product Roadmap Alignment',
    date: '2026-10-25',
    attendees: ['Emily Starks', 'Product Team', 'Engineering Lead'],
    transcript: '',
    taskCount: 6,
    outstandingItems: 4,
    lastUpdated: '2026-10-25T13:00:00Z',
    status: 'in_progress',
  },
];

// Review items for meeting m1
export const MOCK_REVIEW_ITEMS_M1 = [
  {
    id: 'item-1',
    meetingId: 'm1',
    type: 'task',
    description: 'Finalize the data migration plan',
    owner: 'Tom Hargreaves',
    ownerStatus: 'stated',
    dueDate: '2026-11-15',
    dueDateStatus: 'stated',
    rawDateWording: 'November 15th',
    confidence: 'high',
    reviewStatus: 'accepted',
    evidenceQuote: '"Tom, can you take ownership of that?" ... "Sure, I\'ll handle the migration plan and have it ready by November 15th."',
    evidenceLine: '35–41',
    speaker: 'Tom Hargreaves',
  },
  {
    id: 'item-2',
    meetingId: 'm1',
    type: 'task',
    description: 'Follow up with vendor regarding the API rate-limit issue',
    owner: 'Emily Starks',
    ownerStatus: 'stated',
    dueDate: null,
    dueDateStatus: 'not_stated',
    rawDateWording: 'this week',
    confidence: 'medium',
    reviewStatus: 'needs_review',
    evidenceQuote: '"Emily, can you follow up with the vendor this week?" ... "I\'ll reach out to them soon."',
    evidenceLine: '28–40',
    speaker: 'Emily Starks',
  },
  {
    id: 'item-3',
    meetingId: 'm1',
    type: 'task',
    description: 'Draft the user acceptance testing (UAT) plan',
    owner: null,
    ownerStatus: 'not_stated',
    dueDate: null,
    dueDateStatus: 'not_stated',
    rawDateWording: null,
    confidence: 'low',
    reviewStatus: 'needs_review',
    evidenceQuote: '"Who is going to draft the user acceptance testing plan?" ... "That hasn\'t been assigned yet. We need someone to own it."',
    evidenceLine: '52–65',
    speaker: 'Sarah Chen',
  },
  {
    id: 'item-4',
    meetingId: 'm1',
    type: 'risk',
    description: 'API rate-limit issue is unresolved — risk to launch timeline',
    owner: null,
    ownerStatus: 'not_stated',
    dueDate: null,
    dueDateStatus: 'not_stated',
    rawDateWording: null,
    confidence: 'high',
    reviewStatus: 'needs_review',
    evidenceQuote: '"We\'re waiting on the vendor response. It\'s a risk to the launch timeline."',
    evidenceLine: '15–27',
    speaker: 'Dev Lead',
  },
  {
    id: 'item-5',
    meetingId: 'm1',
    type: 'decision',
    description: 'Legacy reporting module removed from v1.0 scope',
    owner: null,
    ownerStatus: 'not_stated',
    dueDate: null,
    dueDateStatus: 'not_stated',
    rawDateWording: null,
    confidence: 'high',
    reviewStatus: 'accepted',
    evidenceQuote: '"We also agreed to remove the legacy reporting module from scope for v1.0." ... "Confirmed. Legacy reporting is out of v1.0 scope."',
    evidenceLine: '30–45',
    speaker: 'Dev Lead / Sarah Chen',
  },
  {
    id: 'item-6',
    meetingId: 'm1',
    type: 'open_question',
    description: 'Who will own the UAT plan? To be revisited in next meeting.',
    owner: null,
    ownerStatus: 'not_stated',
    dueDate: null,
    dueDateStatus: 'not_stated',
    rawDateWording: null,
    confidence: 'high',
    reviewStatus: 'needs_review',
    evidenceQuote: '"Let\'s revisit that in the next meeting. For now, let\'s keep it open."',
    evidenceLine: '18–30',
    speaker: 'Sarah Chen',
  },
];

// Review items for meeting m2
export const MOCK_REVIEW_ITEMS_M2 = [
  {
    id: 'item-7',
    meetingId: 'm2',
    type: 'task',
    description: 'Complete CRM field validation layer',
    owner: 'Raj Kapoor',
    ownerStatus: 'stated',
    dueDate: '2026-11-22',
    dueDateStatus: 'stated',
    rawDateWording: 'November 22nd',
    confidence: 'high',
    reviewStatus: 'needs_review',
    evidenceQuote: '"I\'ll assign it to Raj. He has the most context on the field schema." ... "Let\'s call that November 22nd as the deadline."',
    evidenceLine: '55–68',
    speaker: 'Dev Team Lead / Mark Williams',
  },
  {
    id: 'item-8',
    meetingId: 'm2',
    type: 'task',
    description: 'Address three medium-severity security audit findings',
    owner: null,
    ownerStatus: 'not_stated',
    dueDate: null,
    dueDateStatus: 'not_stated',
    rawDateWording: 'before we go live',
    confidence: 'medium',
    reviewStatus: 'needs_review',
    evidenceQuote: '"The team needs to address those." ... "I\'ll coordinate with the security team. No specific person assigned yet."',
    evidenceLine: '22–37',
    speaker: 'Mark Williams / Dev Team Lead',
  },
  {
    id: 'item-9',
    meetingId: 'm2',
    type: 'risk',
    description: 'Security audit findings must be resolved before go-live — compliance risk',
    owner: null,
    ownerStatus: 'not_stated',
    dueDate: null,
    dueDateStatus: 'not_stated',
    rawDateWording: null,
    confidence: 'high',
    reviewStatus: 'needs_review',
    evidenceQuote: '"We have a regulatory deadline. Those must be resolved before we go live."',
    evidenceLine: '38–51',
    speaker: 'Compliance Officer',
  },
  {
    id: 'item-10',
    meetingId: 'm2',
    type: 'open_question',
    description: 'What is the exact regulatory compliance deadline?',
    owner: 'Compliance Officer',
    ownerStatus: 'implied',
    dueDate: null,
    dueDateStatus: 'not_stated',
    rawDateWording: 'end of week',
    confidence: 'medium',
    reviewStatus: 'needs_review',
    evidenceQuote: '"Can we clarify the exact regulatory deadline?" ... "We\'re still confirming the exact date with legal. I should have an answer by end of week."',
    evidenceLine: '18–31',
    speaker: 'Mark Williams / Compliance Officer',
  },
];

export const ALL_REVIEW_ITEMS = [...MOCK_REVIEW_ITEMS_M1, ...MOCK_REVIEW_ITEMS_M2];

export const MOCK_CLARIFICATION_ITEMS = [
  {
    id: 'cl-1',
    meetingId: 'm1',
    meetingTitle: 'Q4 Product Review — Acme Corporation',
    relatedItemId: 'item-2',
    relatedItemDescription: 'Follow up with vendor regarding the API rate-limit issue',
    missingField: 'Due date',
    evidenceQuote: '"Emily, can you follow up with the vendor this week?" ... "I\'ll reach out to them soon."',
    suggestedQuestion: 'Emily, by when exactly will you follow up with the vendor about the API rate-limit issue?',
  },
  {
    id: 'cl-2',
    meetingId: 'm1',
    meetingTitle: 'Q4 Product Review — Acme Corporation',
    relatedItemId: 'item-3',
    relatedItemDescription: 'Draft the user acceptance testing (UAT) plan',
    missingField: 'Owner',
    evidenceQuote: '"That hasn\'t been assigned yet. We need someone to own it."',
    suggestedQuestion: 'Who will take ownership of drafting the UAT plan, and by when?',
  },
  {
    id: 'cl-3',
    meetingId: 'm2',
    meetingTitle: 'CRM Integration Status — Globex Industries',
    relatedItemId: 'item-8',
    relatedItemDescription: 'Address three medium-severity security audit findings',
    missingField: 'Owner',
    evidenceQuote: '"I\'ll coordinate with the security team. No specific person assigned yet."',
    suggestedQuestion: 'Who specifically will own the security audit remediation, and what is the target completion date?',
  },
  {
    id: 'cl-4',
    meetingId: 'm2',
    meetingTitle: 'CRM Integration Status — Globex Industries',
    relatedItemId: 'item-10',
    relatedItemDescription: 'Exact regulatory compliance deadline',
    missingField: 'Due date',
    evidenceQuote: '"We\'re still confirming the exact date with legal."',
    suggestedQuestion: 'What is the confirmed regulatory compliance deadline that the security findings must be resolved by?',
  },
];

export const MOCK_DUPLICATES = [
  {
    id: 'dup-1',
    currentItem: {
      id: 'item-4',
      description: 'API rate-limit issue is unresolved — risk to launch timeline',
      meeting: 'Q4 Product Review',
      meetingDate: '2026-10-15',
      client: 'Acme Corporation',
      type: 'risk',
      owner: null,
      evidence: '"We\'re waiting on the vendor response. It\'s a risk to the launch timeline."',
    },
    earlierItem: {
      id: 'item-4-dup',
      description: 'Vendor API rate limiting — potential delay risk for project launch',
      meeting: 'Sprint Planning Review',
      meetingDate: '2026-10-08',
      client: 'Acme Corporation',
      type: 'risk',
      owner: null,
      evidence: '"The vendor API has rate limits that could block our launch date."',
    },
    similarityScore: 0.87,
    status: 'pending', // pending | kept_both | merged | discarded
  },
  {
    id: 'dup-2',
    currentItem: {
      id: 'item-2',
      description: 'Follow up with vendor regarding the API rate-limit issue',
      meeting: 'Q4 Product Review',
      meetingDate: '2026-10-15',
      client: 'Acme Corporation',
      type: 'task',
      owner: 'Emily Starks',
      evidence: '"Emily, can you follow up with the vendor this week?"',
    },
    earlierItem: {
      id: 'item-2-dup',
      description: 'Emily to contact vendor about API throttling issues',
      meeting: 'Technical Sync',
      meetingDate: '2026-10-10',
      client: 'Acme Corporation',
      type: 'task',
      owner: 'Emily Starks',
      evidence: '"Emily, please reach out to the API vendor about the throttling."',
    },
    similarityScore: 0.79,
    status: 'pending',
  },
  {
    id: 'dup-3',
    currentItem: {
      id: 'item-7',
      description: 'Complete CRM field validation layer',
      meeting: 'CRM Integration Status',
      meetingDate: '2026-10-18',
      client: 'Globex Industries',
      type: 'task',
      owner: 'Raj Kapoor',
      evidence: '"I\'ll assign it to Raj. He has the most context on the field schema."',
    },
    earlierItem: {
      id: 'item-7-dup',
      description: 'Raj to implement validation rules for CRM data fields',
      meeting: 'Integration Kickoff',
      meetingDate: '2026-10-12',
      client: 'Globex Industries',
      type: 'task',
      owner: 'Raj Kapoor',
      evidence: '"Raj will build out the field-level validation for the CRM pipeline."',
    },
    similarityScore: 0.73,
    status: 'pending',
  },
];

export const MOCK_DASHBOARD_STATS = {
  totalMeetings: 5,
  tasksAwaitingReview: 6,
  tasksMissingOwner: 3,
  tasksMissingDeadline: 4,
  openRisks: 3,
  unansweredQuestions: 2,
};

export const MOCK_SETTINGS = {
  llm: {
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    temperature: 0.1,
    maxTokens: 4096,
  },
  duplicates: {
    similarityThreshold: 0.70,
    algorithm: 'tfidf_cosine',
  },
  export: {
    includeEvidence: true,
    includeConfidence: true,
    defaultFormat: 'xlsx',
    columnMapping: {
      description: 'Task Description',
      owner: 'Owner',
      dueDate: 'Due Date',
      rawDateWording: 'Original Date Wording',
      confidence: 'Confidence',
      reviewStatus: 'Review Status',
      evidenceQuote: 'Evidence',
    },
  },
  dates: {
    relativeDateConvention: 'next_business_week',
    timezone: 'Europe/London',
    preserveVagueDates: true,
  },
  retention: {
    dataRetentionDays: 90,
    autoDeleteAfterExport: false,
  },
  privacy: {
    redactNames: false,
    redactEmails: true,
    anonymizeTranscripts: false,
  },
};

export const ITEM_TYPES = ['task', 'decision', 'risk', 'open_question'];
export const REVIEW_STATUSES = ['accepted', 'rejected', 'needs_review'];
export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'];
export const OWNER_STATUSES = ['stated', 'implied', 'not_stated'];
export const DATE_STATUSES = ['stated', 'implied', 'not_stated'];

