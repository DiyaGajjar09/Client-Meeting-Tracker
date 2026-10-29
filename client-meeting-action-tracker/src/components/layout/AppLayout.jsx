import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function AppLayout({ children, searchQuery, onSearchChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <Topbar
        collapsed={collapsed}
        onMobileMenuOpen={() => setMobileOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />
      <main className={`app-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {children}
      </main>
    </div>
  );
}

