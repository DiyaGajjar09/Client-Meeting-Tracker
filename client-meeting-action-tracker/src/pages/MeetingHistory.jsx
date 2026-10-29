import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ExternalLink, Calendar, Filter, RefreshCw, Eye, Users,
  FileText, ArrowUpDown, ArrowUp, ArrowDown, Trash2
} from 'lucide-react';
import { getMeetings, deleteMeeting } from '../services/api.js';
import { LoadingState, EmptyState, ErrorMessage } from '../components/common/States.jsx';
import { StatusBadge } from '../components/common/Badges.jsx';
import { Button, Input, Select } from '../components/common/FormControls.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { useToast } from '../components/common/ToastNotification.jsx';

export default function MeetingHistory() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [inspectMeeting, setInspectMeeting] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMeetings();
      setMeetings(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteMeeting(deleteTarget.id);
      addToast(`Meeting "${deleteTarget.title}" deleted successfully`, 'success');
      setMeetings(prev => prev.filter(m => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      addToast(`Failed to delete meeting: ${e.message}`, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filtered = meetings.filter(m => {
    if (statusFilter && m.status !== statusFilter) return false;
    if (clientFilter && m.clientName !== clientFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.title.toLowerCase().includes(q) || m.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const clients = [...new Set(meetings.map(m => m.clientName))];

  return (
    <div className="page-container animate-fadeIn">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Meeting History</h1>
          <p className="page-subtitle">All processed meetings with their extraction status and outstanding items</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button variant="primary" onClick={() => navigate('/app/new-meeting')}>
            New Meeting
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar" style={{ marginBottom: 'var(--spacing-5)' }}>
        <div className="search-input-wrap">
          <Search className="search-icon" />
          <input
            type="search"
            className="input search-input"
            placeholder="Search meetings…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
        </div>
        <select
          className="select"
          style={{ width: 160 }}
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
        >
          <option value="">All clients</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="select"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="needs_review">Needs Review</option>
          <option value="reviewed">Reviewed</option>
          <option value="in_progress">In Progress</option>
          <option value="exported">Exported</option>
        </select>
        {(search || statusFilter || clientFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(''); setStatusFilter(''); setClientFilter(''); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState message="Loading meeting history…" />
      ) : error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No meetings found"
          description={
            search || statusFilter || clientFilter
              ? 'No meetings match your current filters.'
              : 'No meetings have been processed yet. Submit your first meeting to get started.'
          }
          action={
            !search && !statusFilter && !clientFilter && (
              <Button variant="primary" onClick={() => navigate('/app/new-meeting')}>
                New Meeting
              </Button>
            )
          }
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('clientName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Client {sortField === 'clientName' ? (sortDirection === 'asc' ? <ArrowUp size={12} color="var(--color-accent)" /> : <ArrowDown size={12} color="var(--color-accent)" />) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Meeting Title {sortField === 'title' ? (sortDirection === 'asc' ? <ArrowUp size={12} color="var(--color-accent)" /> : <ArrowDown size={12} color="var(--color-accent)" />) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Date {sortField === 'date' ? (sortDirection === 'asc' ? <ArrowUp size={12} color="var(--color-accent)" /> : <ArrowDown size={12} color="var(--color-accent)" />) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('taskCount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Tasks {sortField === 'taskCount' ? (sortDirection === 'asc' ? <ArrowUp size={12} color="var(--color-accent)" /> : <ArrowDown size={12} color="var(--color-accent)" />) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('outstandingItems')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Outstanding {sortField === 'outstandingItems' ? (sortDirection === 'asc' ? <ArrowUp size={12} color="var(--color-accent)" /> : <ArrowDown size={12} color="var(--color-accent)" />) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(m => (
                  <tr key={m.id}>
                    <td>
                      <span style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>{m.clientName}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/app/history/${m.id}`)}
                        className="btn-ghost"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          textAlign: 'left',
                        }}
                        title="View Full Meeting Details"
                      >
                        {m.title}
                      </button>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {m.date ? new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>{m.taskCount}</td>
                    <td>
                      <span style={{
                        fontWeight: 600,
                        color: m.outstandingItems > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                      }}>
                        {m.outstandingItems}
                      </span>
                    </td>
                    <td><StatusBadge status={m.status} /></td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                      {(m.lastUpdated || m.createdAt) ? new Date(m.lastUpdated || m.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye size={12} />}
                          onClick={() => navigate(`/app/history/${m.id}`)}
                          title="Open Full Meeting Details"
                        >
                          Details
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<ExternalLink size={12} />}
                          onClick={() => navigate(`/app/review/${m.id}`)}
                          title="Open in Review Screen"
                        >
                          Review
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={12} color="var(--color-danger)" />}
                          onClick={() => setDeleteTarget(m)}
                          title="Delete Meeting"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{
            padding: 'var(--spacing-3) var(--spacing-5)',
            borderTop: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
          }}>
            Showing {filtered.length} of {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Inspect Meeting Modal */}
      {inspectMeeting && (
        <Modal
          isOpen={true}
          onClose={() => setInspectMeeting(null)}
          title={`Meeting Details: ${inspectMeeting.title}`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setInspectMeeting(null)}>Close</Button>
              <Button
                variant="primary"
                icon={<ExternalLink size={14} />}
                onClick={() => {
                  const id = inspectMeeting.id;
                  setInspectMeeting(null);
                  navigate(`/app/review/${id}`);
                }}
              >
                Open in Review Items
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)', background: 'var(--color-bg-secondary)', padding: 'var(--spacing-3)', borderRadius: 'var(--radius-base)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Client</div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{inspectMeeting.clientName}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Meeting Date</div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                  {new Date(inspectMeeting.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Status</div>
                <div style={{ marginTop: 2 }}><StatusBadge status={inspectMeeting.status} /></div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Tasks / Outstanding</div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginTop: 2 }}>
                  {inspectMeeting.taskCount} tasks ({inspectMeeting.outstandingItems} awaiting review)
                </div>
              </div>
            </div>

            {inspectMeeting.attendees && inspectMeeting.attendees.length > 0 && (
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Attendees
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {inspectMeeting.attendees.map(a => (
                    <span key={a} className="badge badge-neutral">{a}</span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
                Transcript Preview
              </div>
              <div style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                background: 'var(--color-bg-secondary)',
                padding: 'var(--spacing-3)',
                borderRadius: 'var(--radius-base)',
                maxHeight: 180,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
              }}>
                {inspectMeeting.transcript || 'No transcript text available for this meeting.'}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Delete Meeting Confirmation"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
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
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete <strong>{deleteTarget.title}</strong>?
            </p>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', padding: '8px 12px', borderRadius: 'var(--radius-base)' }}>
              ⚠️ This will remove the raw transcript text, all {deleteTarget.taskCount || 0} associated extracted items, and review audit logs per the retention policy. This action cannot be undone.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

