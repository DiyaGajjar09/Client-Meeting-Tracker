import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, HelpCircle, ExternalLink, Filter, Search } from 'lucide-react';
import { getClarificationItems } from '../services/api.js';
import { LoadingState, EmptyState } from '../components/common/States.jsx';
import { useToast } from '../components/common/ToastNotification.jsx';

export default function Clarification() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    getClarificationItems().then(setItems).finally(() => setLoading(false));
  }, []);

  async function handleCopy(item) {
    try {
      await navigator.clipboard.writeText(item.suggestedQuestion);
      setCopiedId(item.id);
      addToast('Question copied to clipboard', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      addToast('Failed to copy to clipboard', 'error');
    }
  }

  const filteredItems = items.filter(item => {
    const missing = (item.missingField || '').toLowerCase();
    const isOwner = missing.includes('owner') || (item.missingFields || []).includes('owner');
    const isDeadline = missing.includes('deadline') || missing.includes('due') || (item.missingFields || []).includes('deadline');
    const isLowConf = item.confidence === 'low' || missing.includes('confidence');

    if (filterType === 'missing_owner' && !isOwner) return false;
    if (filterType === 'missing_deadline' && !isDeadline) return false;
    if (filterType === 'low_confidence' && !isLowConf) return false;

    if (search) {
      const q = search.toLowerCase();
      const matchDesc = (item.relatedItemDescription || item.description || '').toLowerCase().includes(q);
      const matchMeeting = (item.meetingTitle || '').toLowerCase().includes(q);
      const matchQ = (item.suggestedQuestion || '').toLowerCase().includes(q);
      if (!matchDesc && !matchMeeting && !matchQ) return false;
    }
    return true;
  });

  if (loading) return <div className="page-container"><LoadingState message="Loading clarification items…" /></div>;

  return (
    <div className="page-container animate-fadeIn">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Clarification</h1>
          <p className="page-subtitle">
            Items with missing or ambiguous information that need follow-up. Use the suggested questions to get clarity from stakeholders.
          </p>
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-full)', padding: '5px 12px', fontWeight: 600 }}>
          {filteredItems.length} of {items.length} item{items.length !== 1 ? 's' : ''} shown
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterType('all')}
            className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All Items ({items.length})
          </button>
          <button
            onClick={() => setFilterType('missing_owner')}
            className={`btn btn-sm ${filterType === 'missing_owner' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Missing Owners
          </button>
          <button
            onClick={() => setFilterType('missing_deadline')}
            className={`btn btn-sm ${filterType === 'missing_deadline' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Missing Deadlines
          </button>
          <button
            onClick={() => setFilterType('low_confidence')}
            className={`btn btn-sm ${filterType === 'low_confidence' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Low Confidence
          </button>
        </div>

        <div style={{ position: 'relative', width: 260 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="input input-sm"
            placeholder="Search clarification items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30, width: '100%' }}
          />
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No clarification needed"
          description={search || filterType !== 'all' ? "No items matched your current filter criteria." : "All extracted items have sufficient information. No follow-up questions are required."}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', maxWidth: 880 }}>
          {filteredItems.map(item => (
            <ClarificationCard
              key={item.id}
              item={item}
              copied={copiedId === item.id}
              onCopy={() => handleCopy(item)}
              onOpenReview={() => navigate(`/app/review/${item.meetingId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClarificationCard({ item, copied, onCopy, onOpenReview }) {
  const quote = item.evidenceQuote || (item.evidenceQuotes && item.evidenceQuotes[0]) || '';

  return (
    <div className="card animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
            {item.meetingTitle} {item.meetingDate ? `· ${item.meetingDate}` : ''}
          </div>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
            {item.relatedItemDescription || item.description}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <span
            className="badge badge-needs-review"
            style={{ flexShrink: 0 }}
          >
            Missing: {item.missingField}
          </span>
          <button
            onClick={onOpenReview}
            className="btn btn-ghost btn-sm"
            title="Open in Review"
            style={{ padding: '2px 6px', fontSize: 12 }}
          >
            <ExternalLink size={12} />
            Review
          </button>
        </div>
      </div>

      {/* Evidence */}
      {quote && (
        <div style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          fontStyle: 'italic',
          background: 'rgba(255, 255, 255, 0.03)',
          borderLeft: '2px solid var(--color-accent)',
          padding: '6px 12px',
          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
          marginBottom: 'var(--spacing-4)',
        }}>
          "{quote.replace(/^"|"$/g, '')}"
        </div>
      )}

      {/* Suggested question */}
      <div style={{
        background: 'rgba(14, 165, 233, 0.08)',
        border: '1px solid rgba(14, 165, 233, 0.25)',
        borderRadius: 'var(--radius-base)',
        padding: 'var(--spacing-3) var(--spacing-4)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--spacing-3)',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Suggested follow-up inquiry (Deterministic Template)
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: '#ffffff', fontWeight: 500, lineHeight: 1.5 }}>
            {item.suggestedQuestion}
          </div>
        </div>
        <button
          onClick={onCopy}
          className={`btn ${copied ? 'btn-success' : 'btn-secondary'} btn-sm`}
          style={{ flexShrink: 0, minWidth: 105 }}
          title="Copy question to clipboard"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy question'}
        </button>
      </div>
    </div>
  );
}
