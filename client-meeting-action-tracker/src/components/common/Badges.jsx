export function StatusBadge({ status }) {
  const map = {
    accepted: { label: 'Accepted', cls: 'badge-accepted' },
    rejected: { label: 'Rejected', cls: 'badge-rejected' },
    needs_review: { label: 'Needs Review', cls: 'badge-needs-review' },
    in_progress: { label: 'In Progress', cls: 'badge-info' },
    exported: { label: 'Exported', cls: 'badge-accepted' },
    reviewed: { label: 'Reviewed', cls: 'badge-info' },
    pending: { label: 'Pending', cls: 'badge-needs-review' },
    kept_both: { label: 'Kept Both', cls: 'badge-info' },
    merged: { label: 'Merged', cls: 'badge-accepted' },
    discarded: { label: 'Discarded', cls: 'badge-rejected' },
  };
  const config = map[status] || { label: status, cls: 'badge-neutral' };
  return <span className={`badge ${config.cls}`}>{config.label}</span>;
}

export function ConfidenceBadge({ level }) {
  const map = {
    high: { label: 'High', cls: 'confidence-high' },
    medium: { label: 'Medium', cls: 'confidence-medium' },
    low: { label: 'Low', cls: 'confidence-low' },
  };
  const config = map[level] || { label: level, cls: 'confidence-medium' };
  return <span className={`badge ${config.cls}`}>{config.label}</span>;
}

export function TypeBadge({ type }) {
  const map = {
    task: { label: 'Task', cls: 'badge-info' },
    decision: { label: 'Decision', cls: 'badge-neutral' },
    risk: { label: 'Risk', cls: 'badge-rejected' },
    open_question: { label: 'Open Question', cls: 'badge-needs-review' },
  };
  const config = map[type] || { label: type, cls: 'badge-neutral' };
  return <span className={`badge ${config.cls}`}>{config.label}</span>;
}

export function OwnerStatusLabel({ status }) {
  if (status === 'stated') return null;
  if (status === 'implied')
    return <span className="badge badge-needs-review" style={{ marginLeft: 4, fontSize: 10 }}>implied</span>;
  return <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not stated</span>;
}

