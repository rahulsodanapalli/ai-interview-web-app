import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import './AppLayout.css';

/**
 * Root layout component that wraps all pages.
 * Manages sidebar collapse state and mobile drawer state cleanly without overlapping content.
 */
export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleOpenMobileMenu = useCallback(() => {
    setMobileMenuOpen(true);
  }, []);

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <div
      className={`app-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}
      id="app-layout"
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onToggleCollapse={handleToggleCollapse}
        onCloseMobile={handleCloseMobileMenu}
      />

      <div className="app-main">
        <Header onOpenMobileMenu={handleOpenMobileMenu} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
