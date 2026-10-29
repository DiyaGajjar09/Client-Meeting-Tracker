import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, HelpCircle, Menu, ChevronDown, User, Settings, LogOut, Info } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownDivider } from '../common/Dropdown.jsx';
import { Modal, ConfirmDialog } from '../common/Modal.jsx';
import { getUserProfile } from '../../utils/userProfile.js';
import { logout } from '../../services/auth.js';
import { useToast } from '../common/ToastNotification.jsx';

export default function Topbar({ collapsed, onMobileMenuOpen, searchQuery, onSearchChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [user, setUser] = useState(getUserProfile());
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useEffect(() => {
    const handleProfileUpdate = () => {
      setUser(getUserProfile());
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, []);

  const getPageTitle = (path) => {
    if (path === '/app/dashboard') return 'Dashboard';
    if (path === '/app/new-meeting') return 'New Meeting';
    if (path.startsWith('/app/review')) return 'Review Items';
    if (path === '/app/clarification') return 'Clarification Queue';
    if (path === '/app/duplicates') return 'Duplicate Detection';
    if (path.startsWith('/app/history/')) return 'Meeting Details';
    if (path === '/app/history') return 'Meeting History';
    if (path === '/app/export') return 'Export Action Items';
    if (path === '/app/settings') return 'Settings & Preferences';
    if (path === '/app/profile') return 'User Profile';
    return 'Client Meeting-to-Action Tracker';
  };

  const title = getPageTitle(location.pathname);
  const sidebarWidth = collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)';

  const getInitials = (name) => {
    if (!name) return 'JD';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = () => {
    setShowSignOutConfirm(false);
    logout();
    addToast('Signed out of session', 'info');
    navigate('/login');
  };

  return (
    <>
      <header
        className="topbar"
        style={{ left: sidebarWidth }}
      >
        <div className="topbar-left">
          {/* Mobile menu button */}
          <button
            className="btn btn-ghost btn-icon"
            onClick={onMobileMenuOpen}
            aria-label="Open navigation menu"
            id="mobile-menu-btn"
          >
            <Menu size={20} />
          </button>

          <span className="topbar-title">{title}</span>
        </div>

        <div className="topbar-right">
          {/* Search */}
          {onSearchChange && (
            <div className="search-input-wrap">
              <Search className="search-icon" />
              <input
                type="search"
                className="input search-input"
                placeholder="Search..."
                value={searchQuery || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Search"
              />
            </div>
          )}

          {/* Help icon */}
          <button
            className="btn btn-ghost btn-icon"
            aria-label="Application Guide and Help"
            onClick={() => setShowHelpModal(true)}
            title="Application Guide"
          >
            <HelpCircle size={18} />
          </button>

          {/* Profile dropdown */}
          <Dropdown
            align="right"
            trigger={
              <button className="profile-btn" aria-label="User account menu">
                <div className="avatar" style={{ background: user.avatarBg || '#4f46e5' }}>
                  {getInitials(user.name)}
                </div>
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                  {user.name}
                </span>
                <ChevronDown size={14} />
              </button>
            }
          >
            <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--color-border)', minWidth: 200 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {user.email}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-accent)', fontWeight: 600, marginTop: 4 }}>
                {user.role}
              </div>
            </div>

            <DropdownItem
              icon={<User size={14} />}
              onClick={() => navigate('/app/profile')}
            >
              View Profile
            </DropdownItem>

            <DropdownItem
              icon={<Settings size={14} />}
              onClick={() => navigate('/app/settings')}
            >
              Account Settings
            </DropdownItem>

            <DropdownDivider />

            <DropdownItem
              icon={<LogOut size={14} />}
              onClick={() => setShowSignOutConfirm(true)}
              className="danger"
            >
              Sign out
            </DropdownItem>
          </Dropdown>
        </div>
      </header>

      {/* Guide / Help Modal */}
      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="Client Meeting-to-Action Tracker — Quick Guide"
        size="md"
        footer={
          <button className="btn btn-primary" onClick={() => setShowHelpModal(false)}>
            Got it
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          <p>
            Welcome to the <strong>Client Meeting-to-Action Tracker</strong>. This application transforms spoken discussions into structured, high-accountability action items without hallucinating facts.
          </p>
          <div style={{ background: 'var(--color-bg-secondary)', padding: '12px', borderRadius: 'var(--radius-base)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
              Key Product Rules:
            </div>
            <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>Zero Guesswork:</strong> If an owner or date wasn't stated, it remains <em>Not stated</em>.</li>
              <li><strong>Evidence Backed:</strong> Click <em>Evidence</em> on any item in Review to highlight the exact transcript quote.</li>
              <li><strong>Human in the Loop:</strong> Accept verified items, edit uncertainties, and merge or split composite tasks.</li>
              <li><strong>Clean Exports:</strong> Export to Excel (.xlsx), Word (.docx), CSV, and JSON anytime.</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Sign Out Confirm Dialog */}
      {showSignOutConfirm && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setShowSignOutConfirm(false)}
          onConfirm={handleSignOut}
          title="Sign out of demo session?"
          message="This will return you to the public marketing page. Your saved demonstration data will remain in your browser storage."
          confirmLabel="Sign out"
          confirmVariant="danger"
        />
      )}
    </>
  );
}
