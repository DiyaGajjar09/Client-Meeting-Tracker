import { InboxIcon, FolderOpen } from 'lucide-react';

export function EmptyState({ icon, title, description, action }) {
  const Icon = icon || InboxIcon;
  return (
    <div className="empty-state">
      <Icon className="empty-state-icon" />
      <div className="empty-state-title">{title}</div>
      {description && <p className="empty-state-description">{description}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{message}</span>
    </div>
  );
}

export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="empty-state">
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'var(--color-danger-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-danger)', marginBottom: 8
      }}>
        <span style={{ fontSize: 24 }}>!</span>
      </div>
      <div className="empty-state-title" style={{ color: 'var(--color-danger)' }}>Something went wrong</div>
      <p className="empty-state-description">{message}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry} style={{ marginTop: 8 }}>
          Try again
        </button>
      )}
    </div>
  );
}

