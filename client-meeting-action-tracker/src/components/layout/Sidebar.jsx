import { useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, CheckSquare, HelpCircle,
  Copy, History, Download, Settings, ChevronLeft, ChevronRight,
  Zap, User
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/app/new-meeting', label: 'New Meeting', icon: PlusCircle },
  { path: '/app/review/m1', matchPrefix: '/app/review', label: 'Review Items', icon: CheckSquare },
  { path: '/app/clarification', label: 'Clarification', icon: HelpCircle },
  { path: '/app/duplicates', label: 'Duplicates', icon: Copy },
  { path: '/app/history', matchPrefix: '/app/history', label: 'Meeting History', icon: History },
  { path: '/app/export', label: 'Export', icon: Download },
  { path: '/app/settings', label: 'Settings', icon: Settings },
  { path: '/app/profile', label: 'Profile', icon: User },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();

  const isItemActive = (item) => {
    if (item.matchPrefix) {
      return location.pathname.startsWith(item.matchPrefix);
    }
    return location.pathname === item.path;
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo linking to Landing Page or Dashboard */}
        <Link
          to="/"
          className="sidebar-logo"
          style={{ textDecoration: 'none' }}
          title="Return to Public Landing Page"
        >
          <div className="sidebar-logo-icon">
            <Zap size={16} />
          </div>
          <div className="sidebar-logo-text">
            Client Meeting<br />Action Tracker
          </div>
        </Link>

        {/* Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
                onClick={onMobileClose}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
              >
                <Icon className="nav-icon" size={18} />
                <span className="nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer / toggle */}
        <div className="sidebar-footer">
          <button
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            <span className="nav-label" style={{ fontSize: 'var(--font-size-xs)' }}>
              Collapse
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
