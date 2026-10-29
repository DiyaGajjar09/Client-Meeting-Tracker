import { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, Edit3, Eye, GitMerge, Scissors,
  Filter, ChevronDown, ChevronUp, AlertTriangle, List, HelpCircle, Lightbulb, ClipboardList,
  Search, Check
} from 'lucide-react';
import { getReviewItems, getMeetingById, updateReviewItem, saveAllReviewItems, getAllReviewItems, mergeItems, splitItem } from '../services/api.js';
import { MOCK_REVIEW_ITEMS_M1, MOCK_MEETINGS, MOCK_TRANSCRIPT_1 } from '../data/mockData.js';
import { StatusBadge, ConfidenceBadge, TypeBadge } from '../components/common/Badges.jsx';
import { Button, Input, Select } from '../components/common/FormControls.jsx';
import { Tabs } from '../components/common/Tabs.jsx';
import { Modal, ConfirmDialog } from '../components/common/Modal.jsx';
import { LoadingState, EmptyState } from '../components/common/States.jsx';
import { EvidencePanel } from '../components/common/EvidencePanel.jsx';
import { useToast } from '../components/common/ToastNotification.jsx';

const TABS = [
  { id: 'task', label: 'Tasks', icon: <ClipboardList size={14} /> },
  { id: 'decision', label: 'Decisions', icon: <Lightbulb size={14} /> },
  { id: 'risk', label: 'Risks', icon: <AlertTriangle size={14} /> },
  { id: 'open_question', label: 'Open Questions', icon: <HelpCircle size={14} /> },
];

export default function ReviewItems() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const { meetingId: paramMeetingId } = useParams();
  const meetingId = paramMeetingId || searchParams.get('meetingId') || 'm1';

  const [items, setItems] = useState([]);
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('task');
  const [selectedItem, setSelectedItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [mergeTarget, setMergeTarget] = useState(null);
  const [splitTarget, setSplitTarget] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [transcriptHighlight, setTranscriptHighlight] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    owner: '',
    dueDate: '',
    confidence: '',
    status: '',
    search: '',
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [reviewItems, mtg] = await Promise.all([
          getReviewItems(meetingId),
          getMeetingById(meetingId).catch(() => MOCK_MEETINGS[0]),
        ]);
        setItems(reviewItems);
        setMeeting(mtg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [meetingId]);

  // Unique owners for filter dropdown
  const uniqueOwners = Array.from(new Set(items.map(i => i.owner).filter(Boolean)));

  const filteredItems = items.filter(item => {
    if (item.type !== activeTab) return false;
    if (filters.confidence && item.confidence !== filters.confidence) return false;
    if (filters.status && item.reviewStatus !== filters.status) return false;
    
    // Owner filter
    if (filters.owner === 'not_stated' && item.ownerStatus !== 'not_stated') return false;
    if (filters.owner === 'has_owner' && item.ownerStatus === 'not_stated') return false;
    if (filters.owner && filters.owner !== 'not_stated' && filters.owner !== 'has_owner') {
      if (item.owner !== filters.owner) return false;
    }

    // Due date filter
    if (filters.dueDate === 'has_date' && !item.dueDate) return false;
    if (filters.dueDate === 'not_stated' && item.dueDateStatus !== 'not_stated') return false;

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchQuote = item.evidenceQuote?.toLowerCase().includes(q);
      const matchOwner = item.owner?.toLowerCase().includes(q);
      if (!matchDesc && !matchQuote && !matchOwner) return false;
    }
    return true;
  });

  const tabsWithCounts = TABS.map(tab => ({
    ...tab,
    count: items.filter(i => i.type === tab.id).length,
  }));

  // Stats summary
  const totalTasks = items.filter(i => i.type === 'task').length;
  const missingOwner = items.filter(i => i.type === 'task' && i.ownerStatus === 'not_stated').length;
  const missingDate = items.filter(i => i.type === 'task' && i.dueDateStatus === 'not_stated').length;
  const risks = items.filter(i => i.type === 'risk').length;
  const questions = items.filter(i => i.type === 'open_question').length;

  async function updateItem(id, changes) {
    const updated = items.map(it => it.id === id ? { ...it, ...changes } : it);
    setItems(updated);
    await updateReviewItem(id, changes);
    // Also sync all items back to storage
    const all = await getAllReviewItems();
    const synced = all.map(it => it.id === id ? { ...it, ...changes } : it);
    await saveAllReviewItems(synced);
  }

  async function handleAccept(item) {
    if (item.confidence === 'low') {
      addToast('Low-confidence items must remain in "Needs Review" until manually verified/edited.', 'warning');
      return;
    }
    await updateItem(item.id, { reviewStatus: 'accepted' });
    addToast('Item accepted and verified for export.', 'success');
  }

  async function handleReject(item) {
    setConfirmDialog({
      title: 'Reject item',
      message: `Are you sure you want to reject this ${item.type.replace('_', ' ')}? It will be marked as rejected and excluded from final exports.`,
      onConfirm: async () => {
        await updateItem(item.id, { reviewStatus: 'rejected' });
        addToast('Item rejected', 'info');
        setConfirmDialog(null);
        if (selectedItem?.id === item.id) setSelectedItem(null);
      },
    });
  }

  async function handleSaveEdit(updatedItem) {
    const updated = items.map(it => it.id === updatedItem.id ? updatedItem : it);
    setItems(updated);
    await updateReviewItem(updatedItem.id, updatedItem);
    const all = await getAllReviewItems();
    const synced = all.map(it => it.id === updatedItem.id ? updatedItem : it);
    await saveAllReviewItems(synced);
    setEditItem(null);
    addToast('Item updated successfully', 'success');
  }

  // Split Action Implementation
  async function handleConfirmSplit(originalId, subtask1, subtask2) {
    const original = items.find(i => i.id === originalId);
    if (!original) return;

    try {
      await splitItem(originalId, subtask1, subtask2);
      const reloadedItems = await getReviewItems(meetingId);
      setItems(reloadedItems);
      setSplitTarget(null);
      setSelectedItem(null);
      addToast('Task successfully split into two distinct items', 'success');
    } catch (e) {
      addToast(`Split failed: ${e.message}`, 'error');
    }
  }

  // Merge Action Implementation
  async function handleConfirmMerge(primaryId, secondaryId, mergedData) {
    const primary = items.find(i => i.id === primaryId);
    const secondary = items.find(i => i.id === secondaryId);
    if (!primary || !secondary) return;

    try {
      await mergeItems(primaryId, secondaryId, mergedData);
      const reloadedItems = await getReviewItems(meetingId);
      setItems(reloadedItems);
      setMergeTarget(null);
      setSelectedItem(null);
      addToast('Items successfully merged into one reviewed task', 'success');
    } catch (e) {
      addToast(`Merge failed: ${e.message}`, 'error');
    }
  }

  function handleEvidenceView(item) {
    setSelectedItem(item);
    setTranscriptHighlight(item.evidenceQuote);
  }

  // Transcript lines
  const transcript = meeting?.transcript || MOCK_TRANSCRIPT_1;
  const transcriptLines = transcript ? transcript.split('\n') : [];

  if (loading) return <div className="page-container"><LoadingState message="Loading review items…" /></div>;

  return (
    <div className="page-container animate-fadeIn" style={{ padding: 0 }}>
      <div className="review-split-layout" style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', height: 'calc(100vh - var(--topbar-height))', overflow: 'hidden' }}>

        {/* LEFT PANEL: Transcript with speaker labels and line numbers */}
        <div style={{ borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg-primary)' }}>
          <div style={{
            padding: 'var(--spacing-3) var(--spacing-5)',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', display: 'inline-block', opacity: 0.8 }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', opacity: 0.8 }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981', display: 'inline-block', opacity: 0.8 }} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                  Transcript & Evidence Stream
                </div>
              </div>
              <span className="badge badge-neutral" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                {transcriptLines.length} lines
              </span>
            </div>
            {meeting && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>{meeting.title}</strong> · {meeting.clientName} · {new Date(meeting.date).toLocaleDateString('en-GB')}
              </div>
            )}
            {selectedItem && (
              <div style={{ marginTop: 'var(--spacing-2)', fontSize: 'var(--font-size-xs)', color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '5px 10px', borderRadius: 'var(--radius-sm)' }}>
                <Eye size={13} color="var(--color-accent)" />
                <span>Showing evidence for: <strong style={{ color: '#ffffff' }}>{selectedItem.description.slice(0, 50)}…</strong></span>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-4) var(--spacing-5)' }}>
            {transcriptLines.map((line, i) => {
              // Highlight check
              const isHighlighted = selectedItem?.evidenceQuote && (
                line.toLowerCase().includes(selectedItem.evidenceQuote.replace(/^"|"$/g, '').slice(0, 20).toLowerCase()) ||
                (selectedItem.speaker && line.includes(selectedItem.speaker))
              );

              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 'var(--spacing-3)',
                    padding: isHighlighted ? '6px 10px' : '3px 4px',
                    borderRadius: 'var(--radius-sm)',
                    background: isHighlighted ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    borderLeft: isHighlighted ? '3px solid #818cf8' : '3px solid transparent',
                    boxShadow: isHighlighted ? '0 0 15px rgba(99, 102, 241, 0.15)' : 'none',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <span style={{
                    fontSize: 11,
                    color: isHighlighted ? '#818cf8' : 'var(--color-text-muted)',
                    fontFamily: 'monospace',
                    minWidth: 28,
                    textAlign: 'right',
                    lineHeight: 1.6,
                    userSelect: 'none',
                    fontWeight: isHighlighted ? 700 : 400,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{
                    fontSize: 'var(--font-size-xs)',
                    lineHeight: 1.7,
                    color: isHighlighted ? '#ffffff' : 'var(--color-text-secondary)',
                    fontWeight: isHighlighted ? 500 : 400,
                  }}>
                    {line || ' '}
                  </span>
                </div>
              );
            })}
            {transcriptLines.length === 0 && (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic', padding: 'var(--spacing-4)' }}>
                No transcript text provided for this meeting.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Review Items Table / Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg-primary)' }}>
          {/* Summary bar */}
          <div style={{
            padding: 'var(--spacing-3) var(--spacing-5)',
            background: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            gap: 'var(--spacing-5)',
            alignItems: 'center',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}>
            <SummaryChip label="Tasks" value={totalTasks} />
            <SummaryChip label="Missing Owner" value={missingOwner} color="var(--color-warning)" />
            <SummaryChip label="Missing Date" value={missingDate} color="var(--color-warning)" />
            <SummaryChip label="Risks" value={risks} color="var(--color-danger)" />
            <SummaryChip label="Questions" value={questions} color="var(--color-info)" />
          </div>

          {/* Type Tabs */}
          <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-primary)' }}>
            <Tabs tabs={tabsWithCounts} activeTab={activeTab} onTabChange={tab => { setActiveTab(tab); setSelectedItem(null); setTranscriptHighlight(null); }} />
          </div>

          {/* Filter Bar: Item Type, Owner, Due Date, Confidence, Review Status */}
          <div style={{
            padding: 'var(--spacing-3) var(--spacing-4)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            gap: 'var(--spacing-2)',
            flexWrap: 'wrap',
            alignItems: 'center',
            flexShrink: 0,
            background: 'var(--color-bg-primary)',
          }}>
            <Input
              placeholder="Search description, owner…"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              style={{ width: 150, padding: '4px 8px', fontSize: 12 }}
            />
            
            {/* Owner Filter */}
            <select
              className="select"
              style={{ width: 130, padding: '4px 24px 4px 8px', fontSize: 12 }}
              value={filters.owner}
              onChange={e => setFilters(f => ({ ...f, owner: e.target.value }))}
              aria-label="Filter by owner"
            >
              <option value="">All Owners</option>
              <option value="not_stated">Not Stated (Missing)</option>
              <option value="has_owner">Assigned Owner</option>
              {uniqueOwners.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>

            {/* Due Date Filter */}
            <select
              className="select"
              style={{ width: 130, padding: '4px 24px 4px 8px', fontSize: 12 }}
              value={filters.dueDate}
              onChange={e => setFilters(f => ({ ...f, dueDate: e.target.value }))}
              aria-label="Filter by due date"
            >
              <option value="">All Dates</option>
              <option value="has_date">Has Due Date</option>
              <option value="not_stated">Not Stated (Missing)</option>
            </select>

            {/* Confidence Filter */}
            <select
              className="select"
              style={{ width: 110, padding: '4px 24px 4px 8px', fontSize: 12 }}
              value={filters.confidence}
              onChange={e => setFilters(f => ({ ...f, confidence: e.target.value }))}
              aria-label="Filter by confidence"
            >
              <option value="">Confidence</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Status Filter */}
            <select
              className="select"
              style={{ width: 120, padding: '4px 24px 4px 8px', fontSize: 12 }}
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              aria-label="Filter by review status"
            >
              <option value="">All Statuses</option>
              <option value="needs_review">Needs Review</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>

            {(filters.search || filters.owner || filters.dueDate || filters.confidence || filters.status) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ owner: '', dueDate: '', confidence: '', status: '', search: '' })}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Items list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredItems.length === 0 ? (
              <EmptyState
                title={`No ${activeTab.replace('_', ' ')}s found`}
                description={
                  filters.search || filters.owner || filters.dueDate || filters.confidence || filters.status
                    ? 'No items match your active filters. Click "Clear" to reset.'
                    : `No ${activeTab.replace('_', ' ')} items were identified for this meeting.`
                }
              />
            ) : (
              filteredItems.map(item => (
                <ReviewItemRow
                  key={item.id}
                  item={item}
                  isSelected={selectedItem?.id === item.id}
                  onSelect={() => {
                    if (selectedItem?.id === item.id) {
                      setSelectedItem(null);
                      setTranscriptHighlight(null);
                    } else {
                      setSelectedItem(item);
                      setTranscriptHighlight(item.evidenceQuote);
                    }
                  }}
                  onAccept={() => handleAccept(item)}
                  onReject={() => handleReject(item)}
                  onEdit={() => setEditItem({ ...item })}
                  onEvidence={() => handleEvidenceView(item)}
                  onMerge={() => setMergeTarget(item)}
                  onSplit={() => setSplitTarget(item)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editItem && (
        <EditItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Split Modal */}
      {splitTarget && (
        <SplitItemModal
          item={splitTarget}
          onClose={() => setSplitTarget(null)}
          onConfirmSplit={handleConfirmSplit}
        />
      )}

      {/* Merge Modal */}
      {mergeTarget && (
        <MergeItemModal
          item={mergeTarget}
          allItems={items.filter(it => it.id !== mergeTarget.id && it.type === mergeTarget.type)}
          onClose={() => setMergeTarget(null)}
          onConfirmMerge={handleConfirmMerge}
        />
      )}

      {/* Confirm Reject Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel="Reject"
          confirmVariant="danger"
        />
      )}
    </div>
  );
}

function SummaryChip({ label, value, color }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      background: 'rgba(255, 255, 255, 0.04)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
    }}>
      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: color || '#ffffff' }}>{value}</span>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{label}</span>
    </div>
  );
}

function ReviewItemRow({ item, isSelected, onSelect, onAccept, onReject, onEdit, onEvidence, onMerge, onSplit }) {
  return (
    <div
      style={{
        padding: 'var(--spacing-4) var(--spacing-5)',
        borderBottom: '1px solid var(--color-border)',
        background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
        borderLeft: isSelected ? '3px solid var(--color-accent)' : '3px solid transparent',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
      }}
      onClick={onSelect}
    >
      {/* Description & Badges */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
        <div style={{ flex: 1, fontWeight: 500, fontSize: 'var(--font-size-sm)', color: isSelected ? '#ffffff' : 'var(--color-text-primary)', lineHeight: 1.4 }}>
          {item.description}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexShrink: 0 }}>
          <ConfidenceBadge level={item.confidence} />
          <StatusBadge status={item.reviewStatus} />
        </div>
      </div>

      {/* Metadata Fields: Owner & Due Date */}
      <div style={{ display: 'flex', gap: 'var(--spacing-5)', flexWrap: 'wrap', marginBottom: 'var(--spacing-3)' }}>
        <MetaField
          label="Owner"
          value={item.owner || 'Not stated'}
          isNotStated={item.ownerStatus === 'not_stated'}
          isImplied={item.ownerStatus === 'implied'}
        />
        <MetaField
          label="Due date"
          value={item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB') : (item.rawDateWording || 'Not stated')}
          isNotStated={item.dueDateStatus === 'not_stated'}
          subValue={item.rawDateWording && item.dueDate ? `"${item.rawDateWording}"` : null}
        />
      </div>

      {/* Evidence Quote Quote Block */}
      <div style={{
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-secondary)',
        fontStyle: 'italic',
        background: 'rgba(255, 255, 255, 0.03)',
        borderLeft: '2px solid var(--color-accent)',
        padding: '5px 10px',
        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
        marginBottom: 'var(--spacing-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span>"{item.evidenceQuote?.replace(/^"|"$/g, '')}"</span>
        {item.evidenceLine && <span style={{ marginLeft: 6, fontStyle: 'normal', color: 'var(--color-accent)', fontFamily: 'monospace', fontSize: 11, background: 'rgba(99, 102, 241, 0.12)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>Line {item.evidenceLine}</span>}
      </div>

      {/* Working Action Buttons */}
      <div
        style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}
        onClick={e => e.stopPropagation()}
      >
        {item.reviewStatus !== 'accepted' && (
          <Button variant="success" size="sm" icon={<CheckCircle size={12} />} onClick={onAccept}>
            Accept
          </Button>
        )}
        {item.reviewStatus !== 'rejected' && (
          <Button variant="danger" size="sm" icon={<XCircle size={12} />} onClick={onReject}>
            Reject
          </Button>
        )}
        <Button variant="secondary" size="sm" icon={<Edit3 size={12} />} onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" icon={<Eye size={12} />} onClick={onEvidence}>
          Evidence
        </Button>
        <Button variant="ghost" size="sm" icon={<GitMerge size={12} />} onClick={onMerge}>
          Merge
        </Button>
        <Button variant="ghost" size="sm" icon={<Scissors size={12} />} onClick={onSplit}>
          Split
        </Button>
      </div>
    </div>
  );
}

function MetaField({ label, value, isNotStated, isImplied, subValue }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          color: isNotStated ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          fontStyle: isNotStated ? 'italic' : 'normal',
          fontWeight: isNotStated ? 400 : 500,
        }}>
          {value}
        </span>
        {isImplied && (
          <span className="badge badge-needs-review" style={{ fontSize: 9, padding: '1px 4px' }}>implied</span>
        )}
      </div>
      {subValue && (
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{subValue}</div>
      )}
    </div>
  );
}

// Edit Modal
function EditItemModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({ ...item });

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Item"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave(form)}>Save changes</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="textarea"
            rows={3}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
          <div className="form-group">
            <label className="form-label">Owner</label>
            <input
              className="input"
              placeholder="Not stated"
              value={form.owner || ''}
              onChange={e => setForm(f => ({
                ...f,
                owner: e.target.value || null,
                ownerStatus: e.target.value ? 'stated' : 'not_stated',
              }))}
            />
            <span className="form-hint">Leave blank if owner is Not stated</span>
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input
              className="input"
              type="date"
              value={form.dueDate || ''}
              onChange={e => setForm(f => ({
                ...f,
                dueDate: e.target.value || null,
                dueDateStatus: e.target.value ? 'stated' : 'not_stated',
              }))}
            />
            <span className="form-hint">Leave blank if deadline is Not stated</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
          <div className="form-group">
            <label className="form-label">Confidence</label>
            <select
              className="select"
              value={form.confidence}
              onChange={e => setForm(f => ({ ...f, confidence: e.target.value }))}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Review Status</label>
            <select
              className="select"
              value={form.reviewStatus}
              onChange={e => setForm(f => ({ ...f, reviewStatus: e.target.value }))}
            >
              <option value="needs_review">Needs Review</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div>
          <div className="form-label" style={{ marginBottom: 4 }}>Evidence (Read-only reference)</div>
          <EvidencePanel
            quote={item.evidenceQuote}
            line={item.evidenceLine}
            speaker={item.speaker}
          />
        </div>
      </div>
    </Modal>
  );
}

// Working Split Modal
function SplitItemModal({ item, onClose, onConfirmSplit }) {
  const [task1, setTask1] = useState({
    description: `${item.description} (Part A)`,
    owner: item.owner || '',
    dueDate: item.dueDate || '',
  });

  const [task2, setTask2] = useState({
    description: `${item.description} (Part B)`,
    owner: '',
    dueDate: '',
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!task1.description.trim() || !task2.description.trim()) return;
    onConfirmSplit(item.id, task1, task2);
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Split Item into Two Tasks"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<Scissors size={14} />} onClick={handleSubmit}>
            Confirm Split
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Divide this composite action item into two separate, independently trackable items. Both will retain the source evidence quote.
        </p>

        {/* Task 1 */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', padding: 'var(--spacing-3)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 8 }}>
            Sub-task 1
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Description</label>
            <input
              className="input"
              value={task1.description}
              onChange={e => setTask1(t => ({ ...t, description: e.target.value }))}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
            <div className="form-group">
              <label className="form-label">Owner</label>
              <input
                className="input"
                placeholder="Not stated"
                value={task1.owner}
                onChange={e => setTask1(t => ({ ...t, owner: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                className="input"
                type="date"
                value={task1.dueDate}
                onChange={e => setTask1(t => ({ ...t, dueDate: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Task 2 */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', padding: 'var(--spacing-3)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 8 }}>
            Sub-task 2
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Description</label>
            <input
              className="input"
              value={task2.description}
              onChange={e => setTask2(t => ({ ...t, description: e.target.value }))}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
            <div className="form-group">
              <label className="form-label">Owner</label>
              <input
                className="input"
                placeholder="Not stated"
                value={task2.owner}
                onChange={e => setTask2(t => ({ ...t, owner: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                className="input"
                type="date"
                value={task2.dueDate}
                onChange={e => setTask2(t => ({ ...t, dueDate: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// Working Merge Modal
function MergeItemModal({ item, allItems, onClose, onConfirmMerge }) {
  const [selectedSecondaryId, setSelectedSecondaryId] = useState(allItems[0]?.id || '');
  const secondary = allItems.find(i => i.id === selectedSecondaryId);

  const [mergedDescription, setMergedDescription] = useState(
    secondary ? `${item.description} & ${secondary.description}` : item.description
  );
  const [chosenOwner, setChosenOwner] = useState(item.owner || secondary?.owner || '');
  const [chosenDueDate, setChosenDueDate] = useState(item.dueDate || secondary?.dueDate || '');

  // Update merged proposal when selected secondary changes
  useEffect(() => {
    if (secondary) {
      setMergedDescription(`${item.description} and ${secondary.description}`);
      setChosenOwner(item.owner || secondary.owner || '');
      setChosenDueDate(item.dueDate || secondary.dueDate || '');
    }
  }, [selectedSecondaryId, item]);

  function handleMergeSubmit(e) {
    e.preventDefault();
    if (!selectedSecondaryId || !mergedDescription.trim()) return;
    onConfirmMerge(item.id, selectedSecondaryId, {
      description: mergedDescription,
      owner: chosenOwner,
      dueDate: chosenDueDate,
    });
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Merge Items"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={<GitMerge size={14} />}
            onClick={handleMergeSubmit}
            disabled={!selectedSecondaryId}
          >
            Confirm Merge
          </Button>
        </>
      }
    >
      <form onSubmit={handleMergeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Select another item to consolidate with. The merged result combines supporting evidence from both items.
        </p>

        <div className="form-group">
          <label className="form-label">Current Item (Primary)</label>
          <div style={{ background: 'var(--color-bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-base)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
            {item.description}
          </div>
        </div>

        {allItems.length === 0 ? (
          <div style={{ color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)' }}>
            No other {item.type.replace('_', ' ')}s available to merge with.
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Merge With (Secondary)</label>
              <select
                className="select"
                value={selectedSecondaryId}
                onChange={e => setSelectedSecondaryId(e.target.value)}
              >
                {allItems.map(it => (
                  <option key={it.id} value={it.id}>
                    {it.description} ({it.owner || 'No owner'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Consolidated Description</label>
              <textarea
                className="textarea"
                rows={3}
                value={mergedDescription}
                onChange={e => setMergedDescription(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
              <div className="form-group">
                <label className="form-label">Assigned Owner</label>
                <input
                  className="input"
                  placeholder="Not stated"
                  value={chosenOwner}
                  onChange={e => setChosenOwner(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                  className="input"
                  type="date"
                  value={chosenDueDate}
                  onChange={e => setChosenDueDate(e.target.value)}
                />
              </div>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
