import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export function Dropdown({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="dropdown" ref={ref}>
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div className="dropdown-menu" style={{ [align === 'left' ? 'left' : 'right']: 0 }}>
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ icon, children, onClick, className = '' }) {
  return (
    <button className={`dropdown-item ${className}`} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="dropdown-divider" />;
}

