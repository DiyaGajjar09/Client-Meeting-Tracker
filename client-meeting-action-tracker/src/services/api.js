// =============================================================
// API Service Layer — Client Meeting-to-Action Tracker
// =============================================================
// All API calls go through this file.
// In mock mode, data is persisted to localStorage for realistic UX
// across page reloads and transitions. Replace with real FastAPI
// endpoints by setting VITE_USE_MOCK_DATA=false and VITE_API_BASE_URL.

import {
  MOCK_MEETINGS,
  MOCK_CLIENTS,
  MOCK_REVIEW_ITEMS_M1,
  MOCK_REVIEW_ITEMS_M2,
  ALL_REVIEW_ITEMS,
  MOCK_CLARIFICATION_ITEMS,
  MOCK_DUPLICATES,
} from '../data/mockData.js';
import { getAuthToken } from './auth.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// ----- Local Storage Helpers -----
function getStorage(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

const STORAGE_KEYS = {
  MEETINGS: 'cmtat_meetings',
  ITEMS: 'cmtat_items',
  CLIENTS: 'cmtat_clients',
  DUPLICATES: 'cmtat_duplicates',
  CLARIFICATIONS: 'cmtat_clarifications',
};

// Initialize default storage if empty
if (typeof window !== 'undefined') {
  if (!localStorage.getItem(STORAGE_KEYS.MEETINGS)) {
    setStorage(STORAGE_KEYS.MEETINGS, MOCK_MEETINGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.ITEMS)) {
    setStorage(STORAGE_KEYS.ITEMS, ALL_REVIEW_ITEMS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CLIENTS)) {
    setStorage(STORAGE_KEYS.CLIENTS, MOCK_CLIENTS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.DUPLICATES)) {
    setStorage(STORAGE_KEYS.DUPLICATES, MOCK_DUPLICATES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CLARIFICATIONS)) {
    setStorage(STORAGE_KEYS.CLARIFICATIONS, MOCK_CLARIFICATION_ITEMS);
  }
}

// ----- Generic fetch wrapper (used when backend is live) -----
async function apiFetch(path, options = {}) {
  const token = getAuthToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ----- Dashboard Stats -----
export async function getDashboardStats() {
  if (USE_MOCK) {
    await delay(250);
    const meetings = getStorage(STORAGE_KEYS.MEETINGS, MOCK_MEETINGS);
    const items = getStorage(STORAGE_KEYS.ITEMS, ALL_REVIEW_ITEMS);

    const tasks = items.filter(i => i.type === 'task');
    const tasksAwaitingReview = tasks.filter(i => i.reviewStatus === 'needs_review').length;
    const tasksMissingOwner = tasks.filter(i => i.ownerStatus === 'not_stated').length;
    const tasksMissingDeadline = tasks.filter(i => i.dueDateStatus === 'not_stated').length;
    const openRisks = items.filter(i => i.type === 'risk' && i.reviewStatus !== 'rejected').length;
    const unansweredQuestions = items.filter(i => i.type === 'open_question' && i.reviewStatus !== 'rejected').length;

    return {
      totalMeetings: meetings.length,
      tasksAwaitingReview,
      tasksMissingOwner,
      tasksMissingDeadline,
      openRisks,
      unansweredQuestions,
    };
  }
  return apiFetch('/api/v1/dashboard/stats');
}

// ----- Meetings -----
export async function getMeetings(params = {}) {
  if (USE_MOCK) {
    await delay(300);
    let meetings = getStorage(STORAGE_KEYS.MEETINGS, MOCK_MEETINGS);
    if (params.clientId) meetings = meetings.filter(m => m.clientId === params.clientId);
    if (params.search) {
      const q = params.search.toLowerCase();
      meetings = meetings.filter(
        m => m.title.toLowerCase().includes(q) || m.clientName.toLowerCase().includes(q)
      );
    }
    return meetings;
  }
  const queryObj = {};
  if (params.clientId) queryObj.client_id = params.clientId;
  if (params.search) queryObj.search = params.search;
  if (params.startDate) queryObj.start_date = params.startDate;
  if (params.endDate) queryObj.end_date = params.endDate;
  if (params.sortBy) queryObj.sort_by = params.sortBy;
  if (params.sortOrder) queryObj.sort_order = params.sortOrder;
  if (params.skip !== undefined) queryObj.skip = params.skip;
  if (params.limit !== undefined) queryObj.limit = params.limit;

  const query = new URLSearchParams(queryObj).toString();
  const res = await apiFetch(`/api/v1/meetings?${query}`);
  const items = res.items || [];
  return items.map(m => ({
    id: m.id,
    clientId: m.client_id,
    clientName: m.client_name,
    title: m.title,
    date: m.meeting_date,
    sourceFilename: m.source_filename,
    attendees: m.attendees || [],
    taskCount: m.task_count ?? 0,
    outstandingItems: m.needs_review_count ?? 0,
    acceptedCount: m.accepted_count ?? 0,
    riskCount: m.risk_count ?? 0,
    questionCount: m.question_count ?? 0,
    status: (m.needs_review_count ?? 0) > 0 ? 'needs_review' : 'reviewed',
    createdAt: m.created_at,
    total: res.total,
  }));
}

export function normalizeItem(it) {
  if (!it) return null;
  // If already normalized or from mock
  if (it.description && it.ownerStatus && it.type) return it;

  const payload = it.payload || {};
  const owner = payload.owner || {};
  const due = payload.due || payload.needed_by || {};
  const firstEv = payload.evidence?.[0] || {};

  return {
    id: it.id,
    meetingId: it.meeting_id || it.meetingId,
    type: it.item_type || it.type,
    description: payload.description || payload.statement || payload.question || '',
    statement: payload.statement || '',
    question: payload.question || '',
    owner: owner.name || null,
    ownerStatus: owner.state || 'not_stated',
    dueDate: due.resolved_date || null,
    dueDateStatus: due.state || 'not_stated',
    rawDateWording: due.raw_text || null,
    priority: payload.priority || null,
    confidence: payload.confidence || it.confidence || 'medium',
    reviewStatus: it.review_status || it.reviewStatus || 'needs_review',
    evidenceQuote: firstEv.quote ? (firstEv.quote.startsWith('"') ? firstEv.quote : `"${firstEv.quote}"`) : 'No quote provided',
    evidenceLine: firstEv.line_start ? `${firstEv.line_start}–${firstEv.line_end || firstEv.line_start}` : null,
    speaker: firstEv.speaker || null,
    clarificationNeeded: payload.clarification_needed || [],
    editedByHuman: it.edited_by_human || false,
    createdAt: it.created_at || new Date().toISOString(),
    payload,
  };
}

export async function getMeetingById(id) {
  if (USE_MOCK) {
    await delay(200);
    const meetings = getStorage(STORAGE_KEYS.MEETINGS, MOCK_MEETINGS);
    const meeting = meetings.find(m => m.id === id);
    if (!meeting) {
      // Fallback to first meeting if not found
      return meetings[0] || MOCK_MEETINGS[0];
    }
    return meeting;
  }
  const res = await apiFetch(`/api/v1/meetings/${id}`);
  return {
    id: res.id,
    clientId: res.client_id,
    clientName: res.client_name,
    title: res.title,
    date: res.meeting_date,
    attendees: res.attendees || [],
    transcript: res.raw_text,
    items: (res.items || []).map(normalizeItem),
    taskCount: res.items?.length || 0,
    outstandingItems: (res.items || []).filter(i => (i.review_status || i.reviewStatus) === 'needs_review').length,
    status: 'needs_review',
    lastUpdated: res.created_at,
  };
}

export async function createMeeting(payload) {
  if (USE_MOCK) {
    await delay(500);
    const meetings = getStorage(STORAGE_KEYS.MEETINGS, MOCK_MEETINGS);
    const newId = `m${Date.now()}`;
    const newMeeting = {
      id: newId,
      ...payload,
      taskCount: 4,
      outstandingItems: 3,
      lastUpdated: new Date().toISOString(),
      status: 'needs_review',
    };
    const updated = [newMeeting, ...meetings];
    setStorage(STORAGE_KEYS.MEETINGS, updated);
    return newMeeting;
  }
  const res = await apiFetch('/api/v1/meetings/json', {
    method: 'POST',
    body: JSON.stringify({
      client_id: payload.clientId,
      title: payload.title,
      meeting_date: payload.date || null,
      attendees: payload.attendees || [],
      text: payload.transcript || '',
    }),
  });
  return {
    id: res.id,
    clientId: res.client_id,
    clientName: res.client_name,
    title: res.title,
    date: res.meeting_date,
    attendees: res.attendees || [],
    transcript: res.raw_text || payload.transcript,
  };
}

export async function deleteMeeting(meetingId) {
  if (USE_MOCK) {
    await delay(200);
    const meetings = getStorage(STORAGE_KEYS.MEETINGS, MOCK_MEETINGS);
    const updatedMeetings = meetings.filter(m => m.id !== meetingId);
    setStorage(STORAGE_KEYS.MEETINGS, updatedMeetings);

    // Also remove associated items per cascade rule
    const allItems = getStorage(STORAGE_KEYS.ITEMS, ALL_REVIEW_ITEMS);
    const updatedItems = allItems.filter(i => i.meetingId !== meetingId);
    setStorage(STORAGE_KEYS.ITEMS, updatedItems);

    return { success: true, id: meetingId };
  }
  return apiFetch(`/api/v1/meetings/${meetingId}`, { method: 'DELETE' });
}

// Simulate AI extraction adhering strictly to uncertainty rules
export async function extractActionItems(meetingId, transcript) {
  if (USE_MOCK) {
    await delay(2500);
    const allItems = getStorage(STORAGE_KEYS.ITEMS, ALL_REVIEW_ITEMS);
    
    // Check if items already exist for this meeting
    let meetingItems = allItems.filter(i => i.meetingId === meetingId);
    
    if (meetingItems.length === 0) {
      // Generate realistic extracted items from the provided transcript following product rules
      // Strictly: never invent owners, never invent dates, evidence quotes retained
      const generated = [
        {
          id: `item-${Date.now()}-1`,
          meetingId,
          type: 'task',
          description: 'Finalize action plan and technical deliverables',
          owner: null,
          ownerStatus: 'not_stated',
          dueDate: null,
          dueDateStatus: 'not_stated',
          rawDateWording: 'as soon as possible',
          confidence: 'medium',
          reviewStatus: 'needs_review',
          evidenceQuote: '"We need to finalize the action plan as soon as possible."',
          evidenceLine: '1–4',
          speaker: 'Discussion Lead',
        },
        {
          id: `item-${Date.now()}-2`,
          meetingId,
          type: 'task',
          description: 'Prepare client status summary and follow-up notes',
          owner: null,
          ownerStatus: 'not_stated',
          dueDate: null,
          dueDateStatus: 'not_stated',
          rawDateWording: null,
          confidence: 'low',
          reviewStatus: 'needs_review',
          evidenceQuote: '"Someone needs to draft the status summary for the stakeholders."',
          evidenceLine: '8–12',
          speaker: 'Participant',
        },
        {
          id: `item-${Date.now()}-3`,
          meetingId,
          type: 'decision',
          description: 'Approved proceeding with current sprint scope and baseline architecture',
          owner: null,
          ownerStatus: 'not_stated',
          dueDate: null,
          dueDateStatus: 'not_stated',
          rawDateWording: null,
          confidence: 'high',
          reviewStatus: 'accepted',
          evidenceQuote: '"Confirmed. We are moving forward with this approach for the next milestone."',
          evidenceLine: '15–18',
          speaker: 'Project Sponsor',
        },
        {
          id: `item-${Date.now()}-4`,
          meetingId,
          type: 'risk',
          description: 'Dependency on external API partner response timeline',
          owner: null,
          ownerStatus: 'not_stated',
          dueDate: null,
          dueDateStatus: 'not_stated',
          rawDateWording: null,
          confidence: 'high',
          reviewStatus: 'needs_review',
          evidenceQuote: '"If the third-party provider doesn\'t respond in time, it will impact our launch."',
          evidenceLine: '22–26',
          speaker: 'Technical Lead',
        },
        {
          id: `item-${Date.now()}-5`,
          meetingId,
          type: 'open_question',
          description: 'Who will sign off on the production deployment criteria?',
          owner: null,
          ownerStatus: 'not_stated',
          dueDate: null,
          dueDateStatus: 'not_stated',
          rawDateWording: null,
          confidence: 'high',
          reviewStatus: 'needs_review',
          evidenceQuote: '"We still don\'t know who has the final sign-off authority on production deployment."',
          evidenceLine: '30–33',
          speaker: 'QA Lead',
        },
      ];

      const updatedItems = [...generated, ...allItems];
      setStorage(STORAGE_KEYS.ITEMS, updatedItems);
      meetingItems = generated;
    }

    return { meetingId, items: meetingItems, extractedAt: new Date().toISOString() };
  }
  const res = await apiFetch(`/api/v1/meetings/${meetingId}/extract`, {
    method: 'POST',
    body: JSON.stringify({ policy: 'preserve_reviewed' }),
  });
  return {
    meetingId,
    runId: res.run_id,
    items: (res.items || []).map(normalizeItem),
    extractedAt: res.created_at || new Date().toISOString(),
    itemsExtracted: res.items_extracted,
  };
}

// ----- Review Items -----
export async function getReviewItems(meetingId) {
  if (USE_MOCK) {
    await delay(300);
    const allItems = getStorage(STORAGE_KEYS.ITEMS, ALL_REVIEW_ITEMS);
    if (!meetingId) return allItems;
    const filtered = allItems.filter(i => i.meetingId === meetingId);
    if (filtered.length === 0) {
      // If none explicitly matched, return MOCK_REVIEW_ITEMS_M1 for demo continuity
      return allItems.filter(i => i.meetingId === 'm1');
    }
    return filtered;
  }
  const res = await apiFetch(`/api/v1/meetings/${meetingId}/items`);
  return (res || []).map(normalizeItem);
}

export async function getAllReviewItems(params = {}) {
  if (USE_MOCK) {
    await delay(300);
    return getStorage(STORAGE_KEYS.ITEMS, ALL_REVIEW_ITEMS);
  }
  const query = new URLSearchParams(params).toString();
  const res = await apiFetch(`/api/v1/items?${query}`);
  return (res || []).map(normalizeItem);
}

export async function updateReviewItem(itemId, updates) {
  if (USE_MOCK) {
    await delay(150);
    const items = getStorage(STORAGE_KEYS.ITEMS, ALL_REVIEW_ITEMS);
    const updated = items.map(it => it.id === itemId ? { ...it, ...updates, updatedAt: new Date().toISOString() } : it);
    setStorage(STORAGE_KEYS.ITEMS, updated);
    return updated.find(it => it.id === itemId);
  }
  const backendPayload = {};
  if (updates.reviewStatus) backendPayload.review_status = updates.reviewStatus;
  if (updates.description !== undefined) backendPayload.description = updates.description;
  if (updates.statement !== undefined) backendPayload.statement = updates.statement;
  if (updates.question !== undefined) backendPayload.question = updates.question;
  if (updates.owner !== undefined) backendPayload.owner_name = updates.owner;
  if (updates.ownerStatus !== undefined) backendPayload.owner_state = updates.ownerStatus;
  if (updates.dueDate !== undefined) backendPayload.resolved_date = updates.dueDate;
  if (updates.dueDateStatus !== undefined) backendPayload.due_date_state = updates.dueDateStatus;
  if (updates.rawDateWording !== undefined) backendPayload.raw_date_wording = updates.rawDateWording;
  if (updates.priority !== undefined) backendPayload.priority = updates.priority;
  if (updates.confidence !== undefined) backendPayload.confidence = updates.confidence;
  if (updates.action) backendPayload.action = updates.action;

  const res = await apiFetch(`/api/v1/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(backendPayload),
  });
  return normalizeItem(res);
}

export async function mergeItems(canonicalId, sourceId, options = {}) {
  if (USE_MOCK) {
    await delay(200);
    const all = getStorage(STORAGE_KEYS.ITEMS, ALL_REVIEW_ITEMS);
    const primary = all.find(i => i.id === canonicalId);
    const secondary = all.find(i => i.id === sourceId);
    if (!primary || !secondary) return null;
    const mergedItem = {
      ...primary,
      id: `item-merged-${Date.now()}`,
      description: options.description || primary.description,
      owner: options.owner !== undefined ? options.owner : primary.owner,
      dueDate: options.dueDate !== undefined ? options.dueDate : primary.dueDate,
      reviewStatus: 'needs_review',
      evidenceQuote: `${primary.evidenceQuote || ''} | ${secondary.evidenceQuote || ''}`,
    };
    const updated = all.filter(i => i.id !== canonicalId && i.id !== sourceId).concat(mergedItem);
    setStorage(STORAGE_KEYS.ITEMS, updated);
    return { canonical_item: mergedItem, source_item: secondary };
  }
  const res = await apiFetch(`/api/v1/items/${canonicalId}/merge`, {
    method: 'POST',
    body: JSON.stringify({
      source_item_id: sourceId,
      preferred_description: options.description || null,
      preferred_owner_name: options.owner || null,
      preferred_due_date: options.dueDate || null,
      combine_evidence: true,
    }),
  });
  return res;
}

export async function splitItem(itemId, subtask1, subtask2) {
  if (USE_MOCK) {
    await delay(200);
    const all = getStorage(STORAGE_KEYS.ITEMS, ALL_REVIEW_ITEMS);
    const original = all.find(i => i.id === itemId);
    if (!original) return null;
    const item1 = {
      ...original,
      id: `item-split-1-${Date.now()}`,
      description: subtask1.description,
      owner: subtask1.owner || null,
      dueDate: subtask1.dueDate || null,
      reviewStatus: 'needs_review',
      evidenceQuote: `${original.evidenceQuote || ''} (Part 1)`,
    };
    const item2 = {
      ...original,
      id: `item-split-2-${Date.now()}`,
      description: subtask2.description,
      owner: subtask2.owner || null,
      dueDate: subtask2.dueDate || null,
      reviewStatus: 'needs_review',
      evidenceQuote: `${original.evidenceQuote || ''} (Part 2)`,
    };
    const updated = all.flatMap(i => i.id === itemId ? [item1, item2] : [i]);
    setStorage(STORAGE_KEYS.ITEMS, updated);
    return { original_item: original, item1, item2 };
  }
  const res = await apiFetch(`/api/v1/items/${itemId}/split`, {
    method: 'POST',
    body: JSON.stringify({
      item1: {
        description: subtask1.description,
        owner_name: subtask1.owner || null,
        due_date: subtask1.dueDate || null,
        priority: subtask1.priority || null,
      },
      item2: {
        description: subtask2.description,
        owner_name: subtask2.owner || null,
        due_date: subtask2.dueDate || null,
        priority: subtask2.priority || null,
      },
    }),
  });
  return res;
}

export async function saveAllReviewItems(items) {
  if (USE_MOCK) {
    setStorage(STORAGE_KEYS.ITEMS, items);
    return items;
  }
}

export async function acceptItem(itemId) {
  return updateReviewItem(itemId, { reviewStatus: 'accepted', action: 'accept' });
}

export async function rejectItem(itemId) {
  return updateReviewItem(itemId, { reviewStatus: 'rejected', action: 'reject' });
}

export async function deleteReviewItem(itemId) {
  if (USE_MOCK) {
    await delay(150);
    const items = getStorage(STORAGE_KEYS.ITEMS, ALL_REVIEW_ITEMS);
    const updated = items.filter(it => it.id !== itemId);
    setStorage(STORAGE_KEYS.ITEMS, updated);
    return { success: true, id: itemId };
  }
  return apiFetch(`/api/v1/items/${itemId}`, { method: 'DELETE' });
}

// ----- Clients -----
export async function getClients() {
  if (USE_MOCK) {
    await delay(150);
    return getStorage(STORAGE_KEYS.CLIENTS, MOCK_CLIENTS);
  }
  const res = await apiFetch('/api/v1/clients');
  return res.items || res;
}

export async function createClient(payload) {
  if (USE_MOCK) {
    await delay(250);
    const clients = getStorage(STORAGE_KEYS.CLIENTS, MOCK_CLIENTS);
    const newClient = { id: `c${Date.now()}`, ...payload };
    const updated = [...clients, newClient];
    setStorage(STORAGE_KEYS.CLIENTS, updated);
    return newClient;
  }
  return apiFetch('/api/v1/clients', { method: 'POST', body: JSON.stringify(payload) });
}

export async function deleteClient(clientId) {
  if (USE_MOCK) {
    await delay(200);
    const clients = getStorage(STORAGE_KEYS.CLIENTS, MOCK_CLIENTS);
    const updated = clients.filter(c => c.id !== clientId);
    setStorage(STORAGE_KEYS.CLIENTS, updated);
    return { success: true, id: clientId };
  }
  return apiFetch(`/api/v1/clients/${clientId}`, { method: 'DELETE' });
}

// ----- Clarification -----
export async function getClarificationItems(clientId) {
  if (USE_MOCK) {
    await delay(250);
    return getStorage(STORAGE_KEYS.CLARIFICATIONS, MOCK_CLARIFICATION_ITEMS);
  }
  let targetClientId = clientId;
  if (!targetClientId) {
    const clients = await getClients();
    targetClientId = clients[0]?.id;
  }
  if (!targetClientId) return [];
  const res = await apiFetch(`/api/v1/clients/${targetClientId}/open-items`);
  return (res.items || []).map(item => ({
    id: item.id,
    meetingId: item.meeting_id,
    meetingTitle: item.meeting_title,
    meetingDate: item.meeting_date,
    type: item.item_type,
    relatedItemDescription: item.description,
    description: item.description,
    missingField: (item.missing_fields || []).join(', ') || 'details',
    missingFields: item.missing_fields || [],
    suggestedQuestion: (item.suggested_questions || [])[0] || `Can someone confirm the details for: "${item.description}"?`,
    suggestedQuestions: item.suggested_questions || [],
    confidence: item.confidence,
    evidenceQuotes: item.evidence_quotes || [],
    owner: item.owner_name,
    ownerStatus: item.owner_state,
    dueDate: item.resolved_date,
    dueDateStatus: item.due_date_state,
  }));
}

// ----- Duplicates -----
export async function getDuplicates(meetingId) {
  if (USE_MOCK) {
    await delay(300);
    return getStorage(STORAGE_KEYS.DUPLICATES, MOCK_DUPLICATES);
  }
  let targetMeetingId = meetingId;
  if (!targetMeetingId) {
    const meetings = await getMeetings();
    targetMeetingId = meetings[0]?.id;
  }
  if (!targetMeetingId) return [];
  const res = await apiFetch(`/api/v1/meetings/${targetMeetingId}/duplicates`);
  return (res || []).map(d => ({
    id: d.id,
    similarityScore: d.similarity_score,
    score: d.similarity_score,
    matchCategory: d.match_category,
    status: d.status || 'pending',
    earlierItem: {
      id: d.candidate_task.id,
      description: d.candidate_task.description,
      meetingTitle: d.candidate_task.meeting_title,
      meetingDate: d.candidate_task.meeting_date,
      owner: d.candidate_task.owner,
      dueDate: d.candidate_task.due_date,
      reviewStatus: d.candidate_task.review_status,
      confidence: d.candidate_task.confidence,
      evidenceQuote: d.candidate_task.evidence_quote,
    },
    newItem: {
      id: d.current_task.id,
      description: d.current_task.description,
      meetingTitle: d.current_task.meeting_title,
      meetingDate: d.current_task.meeting_date,
      owner: d.current_task.owner,
      dueDate: d.current_task.due_date,
      reviewStatus: d.current_task.review_status,
      confidence: d.current_task.confidence,
      evidenceQuote: d.current_task.evidence_quote,
    },
    candidateTask: d.candidate_task,
    currentTask: d.current_task,
  }));
}

export async function resolveDuplicate(dupId, action, options = {}) {
  if (USE_MOCK) {
    await delay(200);
    const dups = getStorage(STORAGE_KEYS.DUPLICATES, MOCK_DUPLICATES);
    const updated = dups.map(d => d.id === dupId ? { ...d, status: action, resolvedAt: new Date().toISOString() } : d);
    setStorage(STORAGE_KEYS.DUPLICATES, updated);
    return updated.find(d => d.id === dupId);
  }
  const actionMap = {
    keep_both: 'keep_both',
    kept_both: 'keep_both',
    merged: 'merged',
    discarded: 'discarded',
    discard: 'discarded',
  };
  const normalizedAction = actionMap[action] || action;
  const meetingId = options.meetingId || 'm1';
  return apiFetch(`/api/v1/meetings/${meetingId}/duplicates/resolve`, {
    method: 'POST',
    body: JSON.stringify({
      item1_id: options.item1Id || dupId.split('_')[1],
      item2_id: options.item2Id || dupId.split('_')[2],
      resolution: normalizedAction,
      canonical_item_id: options.canonicalItemId || null,
    }),
  });
}

// ----- Export -----
export async function exportMeeting(meetingId, options = {}) {
  if (USE_MOCK) {
    await delay(300);
    return { success: true, isMock: true };
  }
  const payload = {
    format: options.format || 'xlsx',
    status_filter: options.statusFilter || 'accepted',
    column_mapping: options.columnMapping || null,
    reviewer_name: options.reviewerName || null,
    include_transcript: options.includeTranscript || false,
  };

  const token = getAuthToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${BASE_URL}/api/v1/meetings/${meetingId}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Export failed: ${res.status}`);
  }

  let filename = `meeting_export.${options.format}`;
  const disposition = res.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);

  return { success: true, filename };
}
