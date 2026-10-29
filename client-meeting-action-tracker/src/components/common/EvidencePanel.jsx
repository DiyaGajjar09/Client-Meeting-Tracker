export function EvidencePanel({ quote, line, speaker, className = '' }) {
  if (!quote) return null;
  return (
    <div className={`evidence-panel ${className}`}>
      <div className="evidence-panel-label">Evidence</div>
      <div className="evidence-quote">"{quote}"</div>
      {(speaker || line) && (
        <div className="evidence-meta">
          {speaker && <span>{speaker}</span>}
          {speaker && line && <span> · </span>}
          {line && <span>Line {line}</span>}
        </div>
      )}
    </div>
  );
}

