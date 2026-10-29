import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar, Users, ArrowLeft, ExternalLink, Download, FileText,
  Search, CheckCircle, AlertTriangle, Lightbulb, HelpCircle, ClipboardList, Trash2
} from 'lucide-react';
import { getMeetingById, getReviewItems, deleteMeeting } from '../services/api.js';
import { LoadingState, EmptyState, ErrorMessage } from '../components/common/States.jsx';
import { StatusBadge, ConfidenceBadge, TypeBadge } from '../components/common/Badges.jsx';
import { Button } from '../components/common/FormControls.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { useToast } from '../components/common/ToastNotification.jsx';

export default function MeetingDetails() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [meeting, setMeeting] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('items'); // 'items' or 'transcript'
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteMeeting = async () => {
    setDeleteLoading(true);
    try {
      await deleteMeeting(meetingId);
      addToast(`Meeting "${meeting?.title || meetingId}" deleted`, 'success');
      navigate('/app/history');
    } catch (e) {
      addToast(`Failed to delete meeting: ${e.message}`, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const mtg = await getMeetingById(meetingId);
        const reviewItems = await getReviewItems(meetingId);
        setMeeting(mtg);
        setItems(reviewItems);
      } catch (err) {
        setError(err.message || 'Meeting record not found');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [meetingId]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingState message="Loading meeting details..." />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="page-container">
        <EmptyState
          icon={Calendar}
          title="Meeting Not Found"
          description={`Could not find any meeting record matching ID: ${meetingId}`}
          action={
            <Button variant="primary" icon={<ArrowLeft size={14} />} onClick={() => navigate('/app/history')}>
              Back to Meeting History
            </Button>
          }
        />
      </div>
    );
  }

  const tasks = items.filter(i => i.type === 'task');
  const decisions = items.filter(i => i.type === 'decision');
  const risks = items.filter(i => i.type === 'risk');
  const questions = items.filter(i => i.type === 'open_question');

  const transcriptLines = (meeting.transcript || '').split('\n');
  const filteredLines = transcriptSearch
    ? transcriptLines.map((line, idx) => ({ line, originalIndex: idx + 1 })).filter(item => item.line.toLowerCase().includes(transcriptSearch.toLowerCase()))
    : transcriptLines.map((line, idx) => ({ line, originalIndex: idx + 1 }));

  return (
    <div className="page-container animate-fadeIn">
      {/* Top breadcrumb & back button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/app/history')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={14} /> Back to Meeting History
        </button>

        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={14} color="var(--color-danger)" />}
            onClick={() => setShowDeleteModal(true)}
            title="Delete this meeting"
            style={{ color: 'var(--color-danger)' }}
          >
            Delete
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => navigate('/app/export')}
          >
            Export Items
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<ExternalLink size={14} />}
            onClick={() => navigate(`/app/review/${meeting.id}`)}
          >
            Open in Review Screen
          </Button>
        </div>
      </div>

      {/* Meeting Header Card */}
      <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              {meeting.clientName}
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
              {meeting.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={14} />
                <span>{new Date(meeting.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <StatusBadge status={meeting.status} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 16px', borderRadius: 'var(--radius-base)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{items.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Extracted Items</div>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(99, 102, 241, 0.06)', padding: '8px 16px', borderRadius: 'var(--radius-base)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-accent)' }}>{tasks.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Tasks</div>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(245, 158, 11, 0.06)', padding: '8px 16px', borderRadius: 'var(--radius-base)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-warning)' }}>
                {tasks.filter(t => t.ownerStatus === 'not_stated').length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Missing Owners</div>
            </div>
          </div>
        </div>

        {/* Attendees */}
        {meeting.attendees && meeting.attendees.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} /> Recorded Attendees ({meeting.attendees.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {meeting.attendees.map(a => (
                <span key={a} className="badge badge-neutral" style={{ fontSize: '12px', padding: '3px 8px' }}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs: Extracted Items vs Transcript */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--spacing-5)' }}>
        <button
          className={`tab ${activeTab === 'items' ? 'active' : ''}`}
          onClick={() => setActiveTab('items')}
          style={{ fontSize: 'var(--font-size-sm)', padding: '10px 16px' }}
        >
          <ClipboardList size={16} /> Extracted Items ({items.length})
        </button>
        <button
          className={`tab ${activeTab === 'transcript' ? 'active' : ''}`}
          onClick={() => setActiveTab('transcript')}
          style={{ fontSize: 'var(--font-size-sm)', padding: '10px 16px' }}
        >
          <FileText size={16} /> Meeting Transcript ({transcriptLines.length} lines)
        </button>
      </div>

      {/* TAB 1: EXTRACTED ITEMS TABLE */}
      {activeTab === 'items' && (
        <div className="card" style={{ padding: 0 }}>
          {items.length === 0 ? (
            <div style={{ padding: 'var(--spacing-8)' }}>
              <EmptyState
                title="No Action Items Found"
                description="This meeting does not have any processed action items yet."
                action={
                  <Button variant="primary" onClick={() => navigate(`/app/review/${meeting.id}`)}>
                    Extract Items Now
                  </Button>
                }
              />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Owner</th>
                    <th>Due Date</th>
                    <th>Confidence</th>
                    <th>Status</th>
                    <th>Evidence Quote</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id}>
                      <td><TypeBadge type={it.type} /></td>
                      <td style={{ fontWeight: 500, maxWidth: 280 }}>{it.description}</td>
                      <td>
                        {it.owner ? (
                          <span>{it.owner}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not stated</span>
                        )}
                        {it.ownerStatus === 'implied' && (
                          <span className="badge badge-needs-review" style={{ fontSize: 9, marginLeft: 4 }}>implied</span>
                        )}
                      </td>
                      <td>
                        {it.dueDate ? (
                          new Date(it.dueDate).toLocaleDateString('en-GB')
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            {it.rawDateWording ? `"${it.rawDateWording}"` : 'Not stated'}
                          </span>
                        )}
                      </td>
                      <td><ConfidenceBadge level={it.confidence} /></td>
                      <td><StatusBadge status={it.reviewStatus} /></td>
                      <td style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontStyle: 'italic', maxWidth: 260 }}>
                        "{it.evidenceQuote}"
                        {it.evidenceLine && <span style={{ marginLeft: 4, color: 'var(--color-text-muted)' }}>· Line {it.evidenceLine}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRANSCRIPT VIEWER */}
      {activeTab === 'transcript' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 'var(--spacing-3) var(--spacing-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="var(--color-text-secondary)" />
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Raw Source Transcript</span>
            </div>
            <div className="search-input-wrap">
              <Search className="search-icon" />
              <input
                type="search"
                className="input search-input"
                placeholder="Search transcript..."
                value={transcriptSearch}
                onChange={e => setTranscriptSearch(e.target.value)}
                style={{ width: 220, fontSize: '12px', padding: '4px 8px 4px 28px' }}
              />
            </div>
          </div>

          <div style={{ padding: 'var(--spacing-4)', maxHeight: 500, overflowY: 'auto' }}>
            {filteredLines.length === 0 ? (
              <div style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                No matching lines found.
              </div>
            ) : (
              filteredLines.map(({ line, originalIndex }) => (
                <div
                  key={originalIndex}
                  style={{
                    display: 'flex',
                    gap: 'var(--spacing-3)',
                    padding: '2px 4px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-xs)',
                    lineHeight: 1.6,
                  }}
                >
                  <span style={{
                    color: 'var(--color-text-muted)',
                    fontFamily: 'monospace',
                    minWidth: 28,
                    textAlign: 'right',
                    userSelect: 'none',
                    fontSize: 11,
                  }}>
                    {originalIndex}
                  </span>
                  <span style={{ color: 'var(--color-text-primary)' }}>
                    {line || ' '}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Delete Meeting Confirmation Modal */}
      {showDeleteModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Meeting"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteMeeting}
                loading={deleteLoading}
                icon={<Trash2 size={13} />}
                style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              >
                Delete Meeting
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
              Are you sure you want to permanently delete <strong>{meeting.title}</strong>?
            </p>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', padding: '8px 12px', borderRadius: 'var(--radius-base)' }}>
              ⚠️ This will remove the raw transcript text, all {items.length} extracted items, and review events. This cannot be undone.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

