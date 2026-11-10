import { useEffect, type ComponentType } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  DashboardIcon,
  SparklesIcon,
  FileTextIcon,
  GitBranchIcon,
  HistoryIcon,
  SettingsIcon,
  ChevronLeftIcon,
  XIcon,
  TerminalIcon,
} from '../ui/Icons';
import './Sidebar.css';

interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  matchPaths?: string[];
}

const primaryNavItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: DashboardIcon },
  { path: '/start', label: 'AI Interview', icon: SparklesIcon, matchPaths: ['/start', '/practice'] },
  { path: '/rag', label: 'Document & GitHub RAG', icon: FileTextIcon, matchPaths: ['/rag', '/source'] },
  { path: '/github', label: 'GitHub Analysis', icon: GitBranchIcon },
  { path: '/history', label: 'Interview History', icon: HistoryIcon, matchPaths: ['/history', '/results'] },
];

const secondaryNavItems: NavItem[] = [
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

export default function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const location = useLocation();

  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseMobile();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  function isItemActive(item: NavItem): boolean {
    if (item.path === '/') {
      return location.pathname === '/';
    }
    if (item.matchPaths) {
      return item.matchPaths.some(
        (prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)
      );
    }
    return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        id="sidebar-nav"
        aria-label="Primary navigation"
      >
        <div className="sidebar-header">
          <NavLink to="/" className="sidebar-brand" onClick={onCloseMobile}>
            <div className="brand-mark" aria-hidden="true">
              <TerminalIcon size={16} />
            </div>
            {!collapsed && (
              <div className="brand-text-group">
                <span className="brand-name">InterviewPrep</span>
                <span className="brand-tag">AI Platform</span>
              </div>
            )}
          </NavLink>

          <button
            id="sidebar-collapse-toggle"
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeftIcon
              size={15}
              style={{
                transform: collapsed ? 'rotate(180deg)' : 'none',
                transition: 'transform 180ms ease',
              }}
            />
          </button>

          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
          >
            <XIcon size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            {!collapsed && <span className="nav-section-label">Workspace</span>}
            <ul className="nav-list">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={onCloseMobile}
                      className={`nav-link ${active ? 'active' : ''}`}
                      id={`nav-${item.path.replace('/', '') || 'dashboard'}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="nav-icon">
                        <Icon size={17} />
                      </span>
                      {!collapsed && <span className="nav-label">{item.label}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="nav-section nav-section-bottom">
            {!collapsed && <span className="nav-section-label">System</span>}
            <ul className="nav-list">
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={onCloseMobile}
                      className={`nav-link ${active ? 'active' : ''}`}
                      id={`nav-${item.path.replace('/', '')}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="nav-icon">
                        <Icon size={17} />
                      </span>
                      {!collapsed && <span className="nav-label">{item.label}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </aside>
    </>
  );
}
