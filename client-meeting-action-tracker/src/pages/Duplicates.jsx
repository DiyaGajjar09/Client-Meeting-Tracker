import { useState, useEffect } from 'react';
import { GitMerge, Trash2, Copy, ChevronRight, AlertTriangle } from 'lucide-react';
import { getDuplicates, resolveDuplicate } from '../services/api.js';
import { LoadingState, EmptyState } from '../components/common/States.jsx';
import { StatusBadge, TypeBadge } from '../components/common/Badges.jsx';
import { Button } from '../components/common/FormControls.jsx';
import { ConfirmDialog } from '../components/common/Modal.jsx';
import { useToast } from '../components/common/ToastNotification.jsx';

export default function Duplicates() {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    getDuplicates().then(setDuplicates).finally(() => setLoading(false));
  }, []);

  async function resolveItem(dup, action) {
    const labelMap = {
      keep_both: 'Kept both items',
      merged: 'Items merged',
      discarded: 'Item discarded',
    };
    const dupId = dup.id;
    setDuplicates(prev =>
      prev.map(d => d.id === dupId ? { ...d, status: action } : d)
    );
    try {
      await resolveDuplicate(dupId, action, {
        meetingId: dup.newItem?.meetingId || dup.currentTask?.meeting_id,
        item1Id: dup.newItem?.id || dup.currentTask?.id,
        item2Id: dup.earlierItem?.id || dup.candidateTask?.id,
      });
      addToast(labelMap[action] || 'Resolved', 'success');
    } catch (e) {
      addToast(`Resolution failed: ${e.message}`, 'error');
    }
    setConfirmDialog(null);
  }

  function handleDiscard(dup) {
    setConfirmDialog({
      title: 'Discard duplicate',
      message: 'This will mark the newer duplicate candidate as discarded. The original item will be kept intact in accordance with data preservation rules. You can still view discarded suggestions.',
      confirmLabel: 'Discard',
      confirmVariant: 'danger',
      onConfirm: () => resolveItem(dup, 'discarded'),
    });
  }

  const pending = duplicates.filter(d => !d.status || d.status === 'pending');
  const resolved = duplicates.filter(d => d.status && d.status !== 'pending');

  if (loading) return <div className="page-container"><LoadingState message="Scanning for duplicates…" /></div>;

  return (
    <div className="page-container animate-fadeIn">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Duplicate Detection</h1>
          <p className="page-subtitle">
            Possible duplicate tasks flagged for human review using TF-IDF cosine similarity. Never automatically merged or deleted.
          </p>
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-full)', padding: '5px 12px', fontWeight: 600 }}>
          {pending.length} pending · {resolved.length} resolved
        </div>
      </div>

      {/* Notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)',
        borderRadius: 'var(--radius-base)', padding: '8px 12px',
        marginBottom: 'var(--spacing-5)',
        fontSize: 'var(--font-size-sm)', color: 'var(--color-info)',
      }}>
        <AlertTriangle size={14} />
        Candidate pairs are isolated strictly within the same client organization. Threshold tiers: ≥ 80% (Likely duplicate), 60–79% (Possibly related).
      </div>

      {duplicates.length === 0 ? (
        <EmptyState
          icon={Copy}
          title="No duplicates found"
          description="No duplicate task candidates were detected across this client's meeting history."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-5)' }}>
          {pending.length > 0 && (
            <section>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--spacing-3)' }}>
                Pending review ({pending.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                {pending.map(dup => (
                  <DuplicateCard
                    key={dup.id}
                    dup={dup}
                    onKeepBoth={() => resolveItem(dup, 'keep_both')}
                    onMerge={() => resolveItem(dup, 'merged')}
                    onDiscard={() => handleDiscard(dup)}
                  />
                ))}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--spacing-3)', marginTop: 'var(--spacing-4)' }}>
                Resolved ({resolved.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                {resolved.map(dup => (
                  <DuplicateCard
                    key={dup.id}
                    dup={dup}
                    resolved
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          confirmVariant={confirmDialog.confirmVariant}
        />
      )}
    </div>
  );
}

function DuplicateCard({ dup, onKeepBoth, onMerge, onDiscard, resolved }) {
  const currentItem = dup.currentItem || dup.newItem || dup.currentTask || {};
  const earlierItem = dup.earlierItem || dup.candidateTask || {};
  const score = dup.similarityScore ?? dup.score ?? 0;
  const scoreColor = score >= 0.80 ? 'var(--color-danger)' : score >= 0.60 ? 'var(--color-warning)' : 'var(--color-text-secondary)';
  const matchCategory = dup.matchCategory || (score >= 0.80 ? 'likely_duplicate' : 'possibly_related');

  return (
    <div className="card" style={{ opacity: resolved ? 0.75 : 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
          <Copy size={16} color="var(--color-text-secondary)" />
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
            {matchCategory === 'likely_duplicate' ? 'Likely Duplicate' : 'Possibly Related Task'}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {currentItem.client || 'Same Client Organization'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Similarity</div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: scoreColor }}>
              {Math.round(score * 100)}%
            </div>
          </div>
          {resolved && <StatusBadge status={dup.status} />}
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 1fr', gap: 'var(--spacing-3)', alignItems: 'stretch', marginBottom: 'var(--spacing-4)' }}>
        <ItemCard item={currentItem} label="Current item" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
          <ChevronRight size={16} />
        </div>
        <ItemCard item={earlierItem} label="Earlier item" />
      </div>

      {/* Actions */}
      {!resolved && (
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-3)' }}>
          <Button variant="secondary" size="sm" icon={<Copy size={12} />} onClick={onKeepBoth}>
            Keep Both
          </Button>
          <Button variant="primary" size="sm" icon={<GitMerge size={12} />} onClick={onMerge}>
            Merge
          </Button>
          <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={onDiscard}>
            Discard candidate
          </Button>
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, label }) {
  const quote = item.evidenceQuote || item.evidence || '';
  const meetingInfo = item.meeting || item.meetingTitle || '';

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-base)',
      padding: 'var(--spacing-3) var(--spacing-4)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--spacing-2)' }}>
        {label}
      </div>
      <div style={{ fontWeight: 500, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-2)', lineHeight: 1.4 }}>
        {item.description}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 'var(--spacing-2)' }}>
        <TypeBadge type={item.type || 'task'} />
        {item.owner ? (
          <span className="badge badge-neutral">{item.owner}</span>
        ) : (
          <span className="badge badge-neutral" style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>No owner</span>
        )}
        {item.dueDate && (
          <span className="badge badge-neutral">Due: {item.dueDate}</span>
        )}
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
        {meetingInfo} {item.meetingDate ? `· ${item.meetingDate}` : ''}
      </div>
      {quote && (
        <div style={{
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          fontStyle: 'italic',
          background: 'rgba(255, 255, 255, 0.02)',
          borderLeft: '2px solid var(--color-accent)',
          padding: '4px 8px',
          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
          lineHeight: 1.5,
        }}>
          "{quote.replace(/^"|"$/g, '')}"
        </div>
      )}
    </div>
  );
}
