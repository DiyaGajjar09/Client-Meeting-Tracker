// Button component
export function Button({
  children,
  variant = 'secondary',
  size = '',
  icon,
  loading = false,
  className = '',
  onClick,
  type = 'button',
  disabled = false,
  ...props
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="spinner spinner-sm" style={{ borderTopColor: 'currentColor', borderColor: 'rgba(255,255,255,0.3)' }} />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}

// Input component
export function Input({
  label,
  hint,
  error,
  required,
  className = '',
  id,
  ...props
}) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={inputId}>
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`input ${error ? 'error' : ''} ${className}`}
        {...props}
      />
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

// Select component
export function Select({
  label,
  hint,
  error,
  required,
  children,
  className = '',
  id,
  ...props
}) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={selectId}>
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={`select ${error ? 'error' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

// Textarea component
export function Textarea({
  label,
  hint,
  error,
  required,
  className = '',
  id,
  rows = 6,
  ...props
}) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={textareaId}>
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        className={`textarea ${error ? 'error' : ''} ${className}`}
        {...props}
      />
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

